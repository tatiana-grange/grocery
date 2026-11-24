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
import type { Product } from '../../catalog/entities/product.entity'
import type { Member } from '../../members/entities/member.entity'
import type { MembershipFee } from '../../members/entities/membership-fee.entity'
import { createMemberData } from '../../members/members.factory'
import { AccountingModule } from '../accounting.module'
import type { ExportName } from '../contracts/accounting.contract'
import {
  insertExpense,
  insertExpenseCancellation,
  insertFeePayment,
  insertReception,
  insertSale,
  insertSaleReversal,
  insertWalletEntry,
} from './accounting-test-data'

/** Reads CSV text into rows of cells: quotes, doubled quotes and line breaks inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\r' && text[i + 1] === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      i++
    } else cell += char
  }
  return rows
}

const HEADERS: Record<ExportName, string[]> = {
  'wallet-movements': [
    'date',
    'recordedAt',
    'entryId',
    'membershipNumber',
    'memberName',
    'reason',
    'paymentMethod',
    'amountEur',
    'handoverId',
    'note',
  ],
  sales: [
    'date',
    'recordedAt',
    'handoverId',
    'kind',
    'reversesHandoverId',
    'membershipNumber',
    'memberName',
    'product',
    'quantity',
    'unitPriceEur',
    'lineTotalEur',
    'costOfGoodsEur',
  ],
  purchases: [
    'date',
    'recordedAt',
    'receptionId',
    'supplierOrderId',
    'supplier',
    'product',
    'receivedQuantity',
    'unitCostEur',
    'lineTotalEur',
  ],
  'membership-fees': [
    'date',
    'recordedAt',
    'paymentId',
    'membershipNumber',
    'memberName',
    'kind',
    'method',
    'amountEur',
    'note',
  ],
  expenses: [
    'date',
    'expenseId',
    'kind',
    'cancelsExpenseId',
    'category',
    'label',
    'paymentMethod',
    'amountEur',
    'reason',
    'recordedBy',
    'recordedAt',
  ],
}

describe('accounting exports (e2e)', () => {
  let em: EntityManager
  let request: TestRequest
  let admin: ReturnType<typeof createSessionFromUser>
  let member: ReturnType<typeof createSessionFromUser>
  let distributor: ReturnType<typeof createSessionFromUser>
  let adminUser: User
  let shopper: Member
  let shopperFee: MembershipFee
  let formulaMember: Member
  let product: Product

  beforeEach(async (context) => {
    const { orm, app } = await initializeTestApp(
      { orm: context.orm },
      { imports: [AccountingModule] },
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
    member = createSessionFromUser((await createMemberData(em, { user: { name: 'Mia' } })).user)
    distributor = createSessionFromUser(
      (await createMemberData(em, { user: { name: 'Dan' }, roles: ['member', 'distributor'] }))
        .user,
    )
    const shopperData = await createMemberData(em, { user: { name: 'Sam Shopper' } })
    shopper = shopperData.member
    shopperFee = shopperData.fee
    formulaMember = (await createMemberData(em, { user: { name: '=SUM(A1)' } })).member
    product = (await createProductData(em, { name: 'Lentils', priceEur: 3 })).product
  })

  async function download(name: string, from = '2026-03-01', to = '2026-03-31') {
    return request.withSession(admin).get(`/admin/accounting/exports/${name}?from=${from}&to=${to}`)
  }

  /** The body of an export as a table, header row split off. */
  async function table(name: ExportName, from?: string, to?: string) {
    const res = await download(name, from, to)
    expect(res.status).toBe(200)
    const [header, ...rows] = parseCsv(res.text)
    return { header, rows, text: res.text as string }
  }

  async function pnl() {
    const res = await request
      .withSession(admin)
      .get('/admin/accounting/profit-and-loss?from=2026-03-01&to=2026-03-31')
    return res.body as {
      salesCents: number
      costOfGoodsSoldCents: number
      membershipFeesCents: number
      expensesTotalCents: number
      expensesByCategory: { category: string; amountCents: number }[]
    }
  }

  const euros = (cents: number) => cents / 100
  const sum = (rows: string[][], column: number) =>
    rows.reduce((total, row) => total + Math.round(Number(row[column]) * 100), 0)

  // March 2026 in Paris: 2026-02-28T23:00:00Z to 2026-03-31T22:00:00Z.
  async function insertSalesData() {
    const inside = await insertSale(em, {
      member: shopper,
      recordedBy: adminUser,
      // 23:30Z is 00:30 the next day in Paris, so its `date` is 2026-03-11.
      at: new Date('2026-03-10T23:30:00Z'),
      lines: [
        { product, quantity: '2', unitPriceCents: 300, unitCostCents: 120 },
        { product, quantity: '1.5', unitPriceCents: 400, unitCostCents: 250 },
      ],
    })
    await insertSale(em, {
      member: shopper,
      recordedBy: adminUser,
      at: new Date('2026-02-28T22:59:59.999Z'),
      lines: [{ product, quantity: '1', unitPriceCents: 999, unitCostCents: 1 }],
    })
    await insertSale(em, {
      member: shopper,
      recordedBy: adminUser,
      at: new Date('2026-03-31T22:00:00.000Z'),
      lines: [{ product, quantity: '1', unitPriceCents: 998, unitCostCents: 1 }],
    })
    return inside
  }

  async function insertWalletData() {
    const at = new Date('2026-03-10T10:00:00Z')
    await insertWalletEntry(em, {
      member: formulaMember,
      reason: 'online_topup',
      amountCents: 5000,
      at,
      paymentMethod: 'online',
    })
    await insertWalletEntry(em, {
      member: shopper,
      reason: 'payment_received',
      amountCents: 3000,
      at: new Date('2026-03-11T10:00:00Z'),
      paymentMethod: 'cash',
      recordedBy: adminUser,
    })
    await insertWalletEntry(em, {
      member: shopper,
      reason: 'refund',
      amountCents: -700,
      at: new Date('2026-03-12T10:00:00Z'),
      paymentMethod: 'cash',
      note: 'Refund, cash back',
    })
    await insertWalletEntry(em, {
      member: shopper,
      reason: 'payment_received',
      amountCents: 9999,
      at: new Date('2026-04-01T10:00:00Z'),
      paymentMethod: 'cash',
    })
    return 5000 + 3000 - 700
  }

  async function insertFeeData() {
    const pay = (
      paidAt: string,
      amountCents: number,
      kind: 'payment' | 'adjustment',
      note?: string,
    ) =>
      insertFeePayment(em, {
        fee: shopperFee,
        recordedBy: adminUser,
        amountCents,
        paidAt: new Date(paidAt),
        kind,
        note,
      })
    await pay('2026-03-05T10:00:00Z', 1000, 'payment', 'Cash, in person')
    await pay('2026-03-06T10:00:00Z', -200, 'adjustment')
    await pay('2026-04-01T10:00:00Z', 777, 'payment')
  }

  async function insertExpenseData() {
    await insertExpense(em, {
      recordedBy: adminUser,
      spentOn: '2026-03-01',
      amountCents: 45000,
      category: 'rent',
      label: 'Rent, "March"',
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
      reason: 'Paid twice',
    })
    await insertExpense(em, {
      recordedBy: adminUser,
      spentOn: '2026-03-31',
      amountCents: 350,
      category: 'bank_fees',
      paymentMethod: 'card',
    })
    await insertExpense(em, {
      recordedBy: adminUser,
      spentOn: '2026-04-01',
      amountCents: 888,
      category: 'other',
    })
  }

  async function insertPurchaseData() {
    await insertReception(em, {
      product,
      quantity: '40',
      unitCostCents: 250,
      at: new Date('2026-03-10T10:00:00Z'),
      supplierName: 'Farm Fresh',
    })
    await insertReception(em, {
      product,
      quantity: '5',
      unitCostCents: 999,
      at: new Date('2026-04-02T10:00:00Z'),
    })
    return 40 * 250
  }

  describe('the sales export', () => {
    it('returns a CSV with its header and one row per handover line in the period', async () => {
      await insertSalesData()

      const { header, rows } = await table('sales')

      expect(header).toEqual(HEADERS.sales)
      expect(rows).toHaveLength(2)
      // Lines of one handover share a time, so their order is not promised: find them by quantity.
      const two = rows.find((row) => row[8] === '2')!
      const oneAndHalf = rows.find((row) => row[8] === '1.5')!
      expect([two[0], two[3], two[4], two[6], two[7]]).toEqual([
        '2026-03-11',
        'handover',
        '',
        'Sam Shopper',
        'Lentils',
      ])
      expect(two.slice(9)).toEqual(['3.00', '6.00', '2.40'])
      expect(oneAndHalf.slice(9)).toEqual(['4.00', '6.00', '3.75'])
    })

    it('writes a reversal with negative quantities, amounts and cost, and names the sale it reverses', async () => {
      const original = await insertSalesData()
      const reversal = await insertSaleReversal(em, {
        sale: original,
        recordedBy: adminUser,
        at: new Date('2026-03-20T10:00:00Z'),
      })

      const { rows } = await table('sales')

      const reversalRows = rows.filter((row) => row[3] === 'reversal')
      expect(reversalRows).toHaveLength(2)
      expect(reversalRows[0][2]).toBe(reversal.handover.id)
      expect(reversalRows[0][4]).toBe(original.handover.id)
      expect(reversalRows.map((row) => row.slice(8)).sort()).toEqual([
        ['-1.5', '4.00', '-6.00', '-3.75'],
        ['-2', '3.00', '-6.00', '-2.40'],
      ])
    })

    it('answers 200 as text/csv with an attachment file name, no byte order mark and CRLF lines', async () => {
      await insertSalesData()

      const res = await download('sales')

      expect(res.status).toBe(200)
      expect(res.headers['content-type']).toBe('text/csv; charset=utf-8')
      expect(res.headers['content-disposition']).toBe(
        'attachment; filename="grocery-sales-2026-03-01-2026-03-31.csv"',
      )
      expect(res.text.startsWith('date,recordedAt,handoverId')).toBe(true)
      expect(res.text.endsWith('\r\n')).toBe(true)
      expect(res.text.split('\r\n')).toHaveLength(4)
    })

    it('has totals that match the P&L: lines are sales, costs are cost of goods sold', async () => {
      await insertSalesData()

      const { rows } = await table('sales')
      const figures = await pnl()

      expect(sum(rows, 10)).toBe(figures.salesCents)
      expect(sum(rows, 11)).toBe(figures.costOfGoodsSoldCents)
      expect(figures.salesCents).toBe(1200)
      expect(figures.costOfGoodsSoldCents).toBe(615)
    })

    it('writes a declined line as a row of 0.00 with no cost', async () => {
      await insertSale(em, {
        member: shopper,
        recordedBy: adminUser,
        at: new Date('2026-03-10T10:00:00Z'),
        lines: [{ product, quantity: '0', unitPriceCents: 300, unitCostCents: 100 }],
      })

      const { rows } = await table('sales')

      expect(rows).toHaveLength(1)
      expect(rows[0].slice(8)).toEqual(['0', '3.00', '0.00', '0.00'])
    })
  })

  describe('the other four exports', () => {
    it('wallet-movements: one row per wallet entry in the period, with a total that matches the rows written', async () => {
      const expectedTotal = await insertWalletData()

      const { header, rows } = await table('wallet-movements')

      expect(header).toEqual(HEADERS['wallet-movements'])
      expect(rows).toHaveLength(3)
      expect(sum(rows, 7)).toBe(expectedTotal)
      const refund = rows.find((row) => row[5] === 'refund')!
      expect(refund[0]).toBe('2026-03-12')
      expect(refund[1]).toBe('2026-03-12T10:00:00.000Z')
      expect(refund.slice(4)).toEqual([
        'Sam Shopper',
        'refund',
        'cash',
        '-7.00',
        '',
        'Refund, cash back',
      ])
    })

    it('purchases: one row per reception line in the period, with a total that matches the rows written', async () => {
      const expectedTotal = await insertPurchaseData()

      const { header, rows } = await table('purchases')

      expect(header).toEqual(HEADERS.purchases)
      expect(rows).toHaveLength(1)
      expect(rows[0].slice(4)).toEqual(['Farm Fresh', 'Lentils', '40', '2.50', '100.00'])
      expect(sum(rows, 8)).toBe(expectedTotal)
    })

    it('membership-fees: payments and adjustments by paid time, matching the P&L', async () => {
      await insertFeeData()

      const { header, rows } = await table('membership-fees')
      const figures = await pnl()

      expect(header).toEqual(HEADERS['membership-fees'])
      expect(rows).toHaveLength(2)
      expect(rows.map((row) => row.slice(5))).toEqual([
        ['payment', 'cash', '10.00', 'Cash, in person'],
        ['adjustment', 'cash', '-2.00', ''],
      ])
      expect(sum(rows, 7)).toBe(figures.membershipFeesCents)
    })

    it('expenses: rows and cancellations in the period, with totals that match the P&L, per category too', async () => {
      await insertExpenseData()

      const { header, rows } = await table('expenses')
      const figures = await pnl()

      expect(header).toEqual(HEADERS.expenses)
      expect(rows).toHaveLength(4)
      expect(sum(rows, 7)).toBe(figures.expensesTotalCents)
      for (const { category, amountCents } of figures.expensesByCategory) {
        const ofCategory = rows.filter((row) => row[4] === category)
        expect(sum(ofCategory, 7)).toBe(amountCents)
      }
      const cancellation = rows.find((row) => row[2] === 'cancellation')!
      expect(cancellation[0]).toBe('2026-03-20')
      expect(cancellation[3]).toEqual(expect.any(String))
      expect(cancellation[3]).not.toBe('')
      expect(cancellation[7]).toBe('-12.00')
      expect(cancellation[8]).toBe('Paid twice')
      expect(cancellation[9]).toBe('Ada Admin')
    })

    it.each(Object.keys(HEADERS) as ExportName[])(
      '%s: answers only the header for an empty period',
      async (name) => {
        const res = await download(name, '2026-06-01', '2026-06-30')

        expect(res.status).toBe(200)
        expect(res.text).toBe(`${HEADERS[name].join(',')}\r\n`)
      },
    )

    it('leaves out a row just outside each bound, for every export', async () => {
      // One row at the very start, one at the very end, one just before and one just after.
      for (const at of [
        '2026-02-28T22:59:59.999Z',
        '2026-02-28T23:00:00.000Z',
        '2026-03-31T21:59:59.999Z',
        '2026-03-31T22:00:00.000Z',
      ]) {
        await insertSale(em, {
          member: shopper,
          recordedBy: adminUser,
          at: new Date(at),
          lines: [{ product, quantity: '1', unitPriceCents: 100, unitCostCents: 50 }],
        })
        await insertWalletEntry(em, {
          member: shopper,
          reason: 'payment_received',
          amountCents: 100,
          at: new Date(at),
          paymentMethod: 'cash',
        })
        await insertFeePayment(em, {
          fee: shopperFee,
          recordedBy: adminUser,
          amountCents: 100,
          paidAt: new Date(at),
        })
        await insertReception(em, { product, quantity: '1', unitCostCents: 100, at: new Date(at) })
      }
      for (const spentOn of ['2026-02-28', '2026-03-01', '2026-03-31', '2026-04-01']) {
        await insertExpense(em, {
          recordedBy: adminUser,
          spentOn,
          amountCents: 100,
          category: 'other',
        })
      }

      for (const name of Object.keys(HEADERS) as ExportName[]) {
        const { rows } = await table(name)
        expect(rows, name).toHaveLength(2)
      }
    })

    it('puts rows in time order', async () => {
      await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-03-20',
        amountCents: 100,
        category: 'other',
      })
      await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-03-02',
        amountCents: 100,
        category: 'other',
      })

      const { rows } = await table('expenses')

      expect(rows.map((row) => row[0])).toEqual(['2026-03-02', '2026-03-20'])
    })
  })

  describe('the spreadsheet guard and the quoting', () => {
    it("writes a member named =SUM(A1) as '=SUM(A1)", async () => {
      await insertWalletData()

      const { text, rows } = await table('wallet-movements')

      expect(rows.some((row) => row[4] === "'=SUM(A1)")).toBe(true)
      expect(text).toContain(",'=SUM(A1),")
    })

    it('quotes a label with a comma and a quote, and doubles the quote', async () => {
      await insertExpenseData()

      const { text, rows } = await table('expenses')

      expect(text).toContain('"Rent, ""March"""')
      expect(rows.some((row) => row[5] === 'Rent, "March"')).toBe(true)
    })

    it('guards a label that starts with a minus sign, and leaves a negative amount alone', async () => {
      await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-03-02',
        amountCents: 100,
        category: 'other',
        label: '- 10 % discount',
      })
      const original = await insertExpense(em, {
        recordedBy: adminUser,
        spentOn: '2026-03-03',
        amountCents: 250,
        category: 'other',
      })
      await insertExpenseCancellation(em, {
        original,
        recordedBy: adminUser,
        spentOn: '2026-03-04',
      })

      const { rows } = await table('expenses')

      expect(rows.some((row) => row[5] === "'- 10 % discount")).toBe(true)
      expect(rows.some((row) => row[7] === '-2.50')).toBe(true)
    })
  })

  describe('access and period', () => {
    it('refuses an unknown export name with 400', async () => {
      const res = await download('everything')

      expect(res.status).toBe(400)
    })

    it('refuses a member and a distributor with 403, and no session with 401', async () => {
      const url = '/admin/accounting/exports/sales?from=2026-03-01&to=2026-03-31'

      const statuses = [
        (await request.withSession(member).get(url)).status,
        (await request.withSession(distributor).get(url)).status,
        (await request.get(url)).status,
      ]

      expect(statuses).toEqual([403, 403, 401])
    })

    it.each([
      ['from after to', 'from=2026-04-01&to=2026-03-01'],
      ['a missing from', 'to=2026-03-01'],
      ['a day that does not exist', 'from=2026-02-30&to=2026-03-01'],
    ])('refuses %s with 400', async (_name, query) => {
      const res = await request.withSession(admin).get(`/admin/accounting/exports/sales?${query}`)

      expect(res.status).toBe(400)
    })
  })
})
