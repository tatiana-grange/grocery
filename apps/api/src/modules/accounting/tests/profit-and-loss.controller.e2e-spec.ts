import type { EntityManager } from '@mikro-orm/core'
import { beforeEach, describe, expect, it } from 'vitest'
import { initializeTestApp } from '../../../test/helpers/test-app.helper'
import {
  createRequest,
  createSessionFromUser,
  type TestRequest,
} from '../../../test/helpers/test-auth.helper'
import type { User } from '../../auth/auth.entity'
import { createProductData } from '../../catalog/catalog.factory'
import { CatalogModule } from '../../catalog/catalog.module'
import type { Product } from '../../catalog/entities/product.entity'
import { DistributionModule } from '../../distribution/distribution.module'
import { StockMovement } from '../../inventory/entities/stock-movement.entity'
import { InventoryModule } from '../../inventory/inventory.module'
import type { Member } from '../../members/entities/member.entity'
import type { MembershipFee } from '../../members/entities/membership-fee.entity'
import { createMemberData } from '../../members/members.factory'
import { WalletModule } from '../../wallet/wallet.module'
import { AccountingModule } from '../accounting.module'
import type { ProfitAndLoss } from '../contracts/accounting.contract'
import { toParisDay } from '../../../common/paris-time.util'
import {
  insertExpense,
  insertExpenseCancellation,
  insertFeePayment,
  insertReception,
  insertSale,
  insertSaleReversal,
  insertWalletEntry,
} from './accounting-test-data'

describe('profit and loss (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let admin: ReturnType<typeof createSessionFromUser>
  let member: ReturnType<typeof createSessionFromUser>
  let distributor: ReturnType<typeof createSessionFromUser>
  let adminUser: User
  let shopper: Member
  let shopperFee: MembershipFee
  let product: Product

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      {
        imports: [
          AccountingModule,
          DistributionModule,
          WalletModule,
          InventoryModule,
          CatalogModule,
        ],
      },
    )
    context.app = app
    em = orm.em.fork()
    request = createRequest(app)

    const adminData = await createMemberData(em, {
      user: { name: 'Ada Admin' },
      roles: ['member', 'admin'],
    })
    adminUser = adminData.user
    admin = createSessionFromUser(adminUser)
    const memberData = await createMemberData(em, { user: { name: 'Mia Member' } })
    member = createSessionFromUser(memberData.user)
    const distributorData = await createMemberData(em, {
      user: { name: 'Dan Distributor' },
      roles: ['member', 'distributor'],
    })
    distributor = createSessionFromUser(distributorData.user)
    const shopperData = await createMemberData(em, { user: { name: 'Sam Shopper' } })
    shopper = shopperData.member
    shopperFee = shopperData.fee
    product = (await createProductData(em, { name: 'Lentils', priceEur: 3 })).product
  })

  async function pnl(from: string, to: string): Promise<ProfitAndLoss> {
    const res = await request
      .withSession(admin)
      .get(`/admin/accounting/profit-and-loss?from=${from}&to=${to}`)
    expect(res.status).toBe(200)
    return res.body as ProfitAndLoss
  }

  function sale(
    at: string,
    priceCents: number,
    extra: { cost?: number; movementAt?: string } = {},
  ) {
    return insertSale(em, {
      member: shopper,
      recordedBy: adminUser,
      at: new Date(at),
      movementAt: extra.movementAt ? new Date(extra.movementAt) : undefined,
      lines: [
        {
          product,
          quantity: '1',
          unitPriceCents: priceCents,
          unitCostCents: extra.cost ?? 0,
        },
      ],
    })
  }

  // March 2026 in Paris runs from 2026-02-28T23:00:00Z to 2026-03-31T22:00:00Z (the clocks
  // change on the 29th).
  const MARCH = ['2026-03-01', '2026-03-31'] as const

  describe('sales and cost of goods sold', () => {
    it('counts a sale just inside both bounds and leaves out one just outside', async () => {
      await sale('2026-02-28T22:59:59.999Z', 1000, { cost: 10 })
      await sale('2026-02-28T23:00:00.000Z', 200, { cost: 20 })
      await sale('2026-03-31T21:59:59.999Z', 300, { cost: 30 })
      await sale('2026-03-31T22:00:00.000Z', 4000, { cost: 40 })

      const result = await pnl(...MARCH)

      expect(result.salesCents).toBe(500)
      expect(result.costOfGoodsSoldCents).toBe(50)
      expect(result.grossMarginCents).toBe(450)
    })

    it('counts a sale and its cost on the handover time, even when the stock movement is a few milliseconds later', async () => {
      await sale('2026-03-31T21:59:59.998Z', 500, {
        cost: 120,
        movementAt: '2026-03-31T22:00:00.003Z',
      })

      const march = await pnl(...MARCH)
      const april = await pnl('2026-04-01', '2026-04-30')

      expect(march).toMatchObject({ salesCents: 500, costOfGoodsSoldCents: 120 })
      expect(april).toMatchObject({ salesCents: 0, costOfGoodsSoldCents: 0 })
    })

    it('lowers sales and cost of goods sold by the same amounts when a handover is reversed in the period', async () => {
      const original = await sale('2026-03-10T10:00:00Z', 800, { cost: 300 })
      await sale('2026-03-11T10:00:00Z', 200, { cost: 50 })
      await insertSaleReversal(em, {
        sale: original,
        recordedBy: adminUser,
        at: new Date('2026-03-12T10:00:00Z'),
      })

      const result = await pnl(...MARCH)

      expect(result.salesCents).toBe(200)
      expect(result.costOfGoodsSoldCents).toBe(50)
    })

    it('counts a sale in its own period and its reversal in the later one', async () => {
      const original = await sale('2026-03-10T10:00:00Z', 800, { cost: 300 })
      await insertSaleReversal(em, {
        sale: original,
        recordedBy: adminUser,
        at: new Date('2026-04-02T10:00:00Z'),
      })

      const march = await pnl(...MARCH)
      const april = await pnl('2026-04-01', '2026-04-30')

      expect(march).toMatchObject({ salesCents: 800, costOfGoodsSoldCents: 300 })
      expect(april).toMatchObject({ salesCents: -800, costOfGoodsSoldCents: -300 })
    })

    it('rounds the cost of a sale by weight to the cent, per row', async () => {
      await insertSale(em, {
        member: shopper,
        recordedBy: adminUser,
        at: new Date('2026-03-10T10:00:00Z'),
        lines: [{ product, quantity: '1.333', unitPriceCents: 600, unitCostCents: 250 }],
      })

      const result = await pnl(...MARCH)

      // 1.333 kg at 250 cents is 333.25 cents of cost, 799.8 cents of sales.
      expect(result.costOfGoodsSoldCents).toBe(333)
      expect(result.salesCents).toBe(800)
    })

    it('rounds half a cent away from zero, and a reversal to the exact opposite', async () => {
      const original = await insertSale(em, {
        member: shopper,
        recordedBy: adminUser,
        at: new Date('2026-03-10T10:00:00Z'),
        lines: [{ product, quantity: '0.5', unitPriceCents: 100, unitCostCents: 101 }],
      })
      const before = await pnl(...MARCH)
      await insertSaleReversal(em, {
        sale: original,
        recordedBy: adminUser,
        at: new Date('2026-03-11T10:00:00Z'),
      })

      const after = await pnl(...MARCH)

      expect(before.costOfGoodsSoldCents).toBe(51)
      expect(after.costOfGoodsSoldCents).toBe(0)
    })

    it('writes a declined line as a sale of 0 with no cost', async () => {
      await insertSale(em, {
        member: shopper,
        recordedBy: adminUser,
        at: new Date('2026-03-10T10:00:00Z'),
        lines: [{ product, quantity: '0', unitPriceCents: 300, unitCostCents: 100 }],
      })

      const result = await pnl(...MARCH)

      expect(result).toMatchObject({ salesCents: 0, costOfGoodsSoldCents: 0 })
    })

    it('changes no figure when goods are received in the period', async () => {
      await insertReception(em, {
        product,
        quantity: '40',
        unitCostCents: 250,
        at: new Date('2026-03-10T10:00:00Z'),
      })

      const result = await pnl(...MARCH)

      expect(result).toMatchObject({
        salesCents: 0,
        costOfGoodsSoldCents: 0,
        resultCents: 0,
      })
    })
  })

  describe('membership fees', () => {
    it('counts payments and adjustments by the time they were paid, with both bounds', async () => {
      const pay = (
        paidAt: string,
        amountCents: number,
        kind: 'payment' | 'adjustment' = 'payment',
      ) =>
        insertFeePayment(em, {
          fee: shopperFee,
          recordedBy: adminUser,
          amountCents,
          paidAt: new Date(paidAt),
          kind,
        })
      await pay('2026-02-28T22:59:59.999Z', 9000)
      await pay('2026-02-28T23:00:00.000Z', 1000)
      await pay('2026-03-15T12:00:00.000Z', -200, 'adjustment')
      await pay('2026-03-31T21:59:59.999Z', 500)
      await pay('2026-03-31T22:00:00.000Z', 7000)

      const result = await pnl(...MARCH)

      expect(result.membershipFeesCents).toBe(1300)
    })
  })

  describe('expenses', () => {
    it('sums by category, lists all six categories, and nets a cancelled expense to 0', async () => {
      await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-03-01',
        amountCents: 45000,
        category: 'rent',
      })
      const mistake = await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-03-05',
        amountCents: 1200,
        category: 'insurance',
      })
      await insertExpenseCancellation(em, {
        original: mistake,
        recordedBy: adminUser,
        spentOn: '2026-03-20',
      })
      await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-03-31',
        amountCents: 350,
        category: 'bank_fees',
      })
      await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-02-28',
        amountCents: 999,
        category: 'other',
      })
      await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-04-01',
        amountCents: 888,
        category: 'other',
      })

      const result = await pnl(...MARCH)

      expect(result.expensesByCategory).toEqual([
        { category: 'rent', amountCents: 45000 },
        { category: 'insurance', amountCents: 0 },
        { category: 'utilities', amountCents: 0 },
        { category: 'equipment', amountCents: 0 },
        { category: 'bank_fees', amountCents: 350 },
        { category: 'other', amountCents: 0 },
      ])
      expect(result.expensesTotalCents).toBe(45350)
    })

    it('counts an expense in its own period and its cancellation in the later one', async () => {
      const original = await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-03-10',
        amountCents: 700,
        category: 'utilities',
      })
      await insertExpenseCancellation(em, {
        original,
        recordedBy: adminUser,
        spentOn: '2026-04-03',
      })

      const march = await pnl(...MARCH)
      const april = await pnl('2026-04-01', '2026-04-30')

      expect(march.expensesTotalCents).toBe(700)
      expect(april.expensesTotalCents).toBe(-700)
    })
  })

  describe('the result', () => {
    it('is sales plus fees minus cost of goods sold minus expenses', async () => {
      await sale('2026-03-10T10:00:00Z', 10000, { cost: 6000 })
      await insertFeePayment(em, {
        fee: shopperFee,
        recordedBy: adminUser,
        amountCents: 1000,
        paidAt: new Date('2026-03-12T10:00:00Z'),
      })
      await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-03-15',
        amountCents: 2500,
        category: 'rent',
      })

      const result = await pnl(...MARCH)

      expect(result).toMatchObject({
        from: '2026-03-01',
        to: '2026-03-31',
        salesCents: 10000,
        costOfGoodsSoldCents: 6000,
        grossMarginCents: 4000,
        membershipFeesCents: 1000,
        expensesTotalCents: 2500,
        resultCents: 10000 + 1000 - 6000 - 2500,
      })
    })

    it('is all zeros for an empty period, with all six categories', async () => {
      const result = await pnl('2026-06-01', '2026-06-30')

      expect(result).toMatchObject({
        salesCents: 0,
        costOfGoodsSoldCents: 0,
        grossMarginCents: 0,
        membershipFeesCents: 0,
        expensesTotalCents: 0,
        resultCents: 0,
      })
      expect(result.expensesByCategory).toHaveLength(6)
      expect(result.expensesByCategory.every((row) => row.amountCents === 0)).toBe(true)
    })

    it('changes no figure for a top-up, a payment received, a payment correction or a refund (pnl-ignores-wallet)', async () => {
      await sale('2026-03-10T10:00:00Z', 1000, { cost: 400 })
      const baseline = await pnl(...MARCH)
      const at = new Date('2026-03-11T10:00:00Z')
      await insertWalletEntry(em, {
        member: shopper,
        reason: 'online_topup',
        amountCents: 5000,
        at,
        paymentMethod: 'online',
      })
      await insertWalletEntry(em, {
        member: shopper,
        reason: 'payment_received',
        amountCents: 3000,
        at,
        paymentMethod: 'cash',
      })
      await insertWalletEntry(em, {
        member: shopper,
        reason: 'payment_correction',
        amountCents: -3000,
        at,
        paymentMethod: 'cash',
      })
      await insertWalletEntry(em, {
        member: shopper,
        reason: 'refund',
        amountCents: -700,
        at,
        paymentMethod: 'cash',
      })
      await insertWalletEntry(em, {
        member: shopper,
        reason: 'handover_charge',
        amountCents: -1000,
        at,
      })
      await insertWalletEntry(em, {
        member: shopper,
        reason: 'handover_reversal',
        amountCents: 1000,
        at,
      })

      const result = await pnl(...MARCH)

      expect(result).toEqual(baseline)
    })
  })

  describe('access and period', () => {
    it('refuses a member and a distributor with 403, and no session with 401', async () => {
      const url = '/admin/accounting/profit-and-loss?from=2026-03-01&to=2026-03-31'

      const statuses = [
        (await request.withSession(member).get(url)).status,
        (await request.withSession(distributor).get(url)).status,
        (await request.get(url)).status,
      ]

      expect(statuses).toEqual([403, 403, 401])
    })

    it.each([
      ['from after to', 'from=2026-04-01&to=2026-03-01'],
      ['a missing to', 'from=2026-03-01'],
      ['a day that does not exist', 'from=2026-02-30&to=2026-03-01'],
    ])('refuses %s with 400', async (_name, query) => {
      const res = await request.withSession(admin).get(`/admin/accounting/profit-and-loss?${query}`)

      expect(res.status).toBe(400)
    })

    it('answers one day when from equals to', async () => {
      await sale('2026-03-10T10:00:00Z', 300)

      const result = await pnl('2026-03-10', '2026-03-10')

      expect(result.salesCents).toBe(300)
    })
  })

  describe('through the real distribution code path', () => {
    it('counts both rows of an express sale and its reversal, and nets to 0', async () => {
      await em
        .persist(
          Object.assign(new StockMovement(), {
            product,
            quantity: '10',
            unitCostAmountCents: 200,
            currency: 'EUR',
            reason: 'reception',
          }),
        )
        .flush()
      await insertWalletEntry(em, {
        member: shopper,
        reason: 'payment_received',
        amountCents: 6000,
        paymentMethod: 'cash',
        at: new Date(),
      })
      const sold = await request
        .withSession(distributor)
        .post(`/distribution/members/${shopper.id}/express-orders`)
        .send({ lines: [{ productId: product.id, quantity: 2 }] })
      expect(sold.status).toBe(201)
      const today = toParisDay(new Date())

      const afterSale = await pnl(today, today)
      const reversed = await request
        .withSession(distributor)
        .post(`/distribution/handovers/${sold.body.id}/reversal`)
        .send({ note: 'Rung up by mistake' })
      expect(reversed.status).toBe(201)
      const afterReversal = await pnl(today, today)

      expect(afterSale).toMatchObject({ salesCents: 600, costOfGoodsSoldCents: 400 })
      expect(afterReversal).toMatchObject({
        salesCents: 0,
        costOfGoodsSoldCents: 0,
        resultCents: 0,
      })
    })
  })
})
