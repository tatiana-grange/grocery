import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import {
  dayParams,
  EXPENSE_IN_PERIOD,
  FEE_PAID_IN_PERIOD,
  HANDOVER_IN_PERIOD,
  instantParams,
  LINE_COST_CENTS,
  RECEPTION_IN_PERIOD,
  SALE_LINES_FROM,
  SALE_MOVEMENT_REASONS,
  WALLET_ENTRY_IN_PERIOD,
} from './accounting.queries'
import type { ExportName } from './contracts/accounting.contract'
import { type CsvCell, toCsv } from '../../common/csv.util'
import { toParisDay } from '../../common/paris-time.util'
import type { Period } from './period.util'

type Instant = string | Date

/** One export before it is written: its header, then its rows. */
interface ExportTable {
  header: string[]
  rows: CsvCell[][]
}

interface WalletMovementRow {
  id: string
  createdAt: Instant
  membershipNumber: string
  memberName: string
  reason: string
  paymentMethod: string | null
  amountCents: string | number
  handoverId: string | null
  note: string | null
}

interface SaleRow {
  handoverId: string
  createdAt: Instant
  kind: string
  reversesHandoverId: string | null
  membershipNumber: string
  memberName: string
  product: string
  handedQuantity: string
  unitPriceAmountCents: string | number
  lineTotalAmountCents: string | number
  costCents: string | number
}

interface PurchaseRow {
  receptionId: string
  receivedAt: Instant
  supplierOrderId: string
  supplier: string
  product: string
  receivedQuantity: string
  unitCostAmountCents: string | number
  lineTotalCents: string | number
}

interface MembershipFeeRow {
  id: string
  paidAt: Instant
  membershipNumber: string
  memberName: string
  kind: string
  method: string
  amountCents: string | number
  note: string | null
}

interface ExpenseExportRow {
  id: string
  day: string
  kind: string
  cancelsExpenseId: string | null
  category: string
  label: string
  paymentMethod: string
  amountCents: string | number
  reason: string | null
  recordedBy: string
  createdAt: Instant
}

function toTextCell(value: string | null): string | null {
  return value
}

function toAmountCell(value: string | number): { cents: number } {
  return { cents: Number(value) }
}

/** The Paris day and the UTC instant of a row's time: the two leading columns of most exports. */
function toInstantCells(value: Instant): [string, string] {
  const instant = new Date(value)
  return [toParisDay(instant), instant.toISOString()]
}

/**
 * The five CSV exports. They share the period filters and the cost expression of the P&L
 * (`accounting.queries.ts`).
 */
@Injectable()
export class ExportsService {
  constructor(private readonly em: EntityManager) {}

  async build(input: {
    exportName: ExportName
    period: Period
  }): Promise<{ fileName: string; csv: string }> {
    const { header, rows } = await this.read(input.exportName, input.period)
    return {
      fileName: `grocery-${input.exportName}-${input.period.from}-${input.period.to}.csv`,
      csv: toCsv({ header, rows }),
    }
  }

  private read(name: ExportName, period: Period): Promise<ExportTable> {
    switch (name) {
      case 'wallet-movements':
        return this.walletMovements(period)
      case 'sales':
        return this.sales(period)
      case 'purchases':
        return this.purchases(period)
      case 'membership-fees':
        return this.membershipFees(period)
      case 'expenses':
        return this.expenses(period)
    }
  }

  private query<T>(sql: string, params: string[]): Promise<T[]> {
    return this.em.getConnection().execute(sql, params, 'all', this.em.getTransactionContext())
  }

  private async walletMovements(period: Period): Promise<ExportTable> {
    const rows = await this.query<WalletMovementRow>(
      `select we."id", we."createdAt", m."membershipNumber", u."name" as "memberName",
              we."reason", we."paymentMethod", we."amountCents", we."handoverId", we."note"
         from "walletEntry" we
         join "member" m on m."id" = we."memberId"
         join "user" u on u."id" = m."userId"
        where ${WALLET_ENTRY_IN_PERIOD}
        order by we."createdAt", we."id"`,
      instantParams(period),
    )
    return {
      header: [
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
      rows: rows.map((row): CsvCell[] => [
        ...toInstantCells(row.createdAt),
        toTextCell(row.id),
        toTextCell(row.membershipNumber),
        toTextCell(row.memberName),
        toTextCell(row.reason),
        toTextCell(row.paymentMethod),
        toAmountCell(row.amountCents),
        toTextCell(row.handoverId),
        toTextCell(row.note),
      ]),
    }
  }

  private async sales(period: Period): Promise<ExportTable> {
    const rows = await this.query<SaleRow>(
      `select h."id" as "handoverId", h."createdAt", h."kind", h."reversesHandoverId",
              m."membershipNumber", u."name" as "memberName", ol."productNameSnapshot" as "product",
              hl."handedQuantity", hl."unitPriceAmountCents", hl."lineTotalAmountCents",
              coalesce(${LINE_COST_CENTS}, 0) as "costCents"
         from ${SALE_LINES_FROM}
         join "orderLine" ol on ol."id" = hl."orderLineId"
         join "member" m on m."id" = h."memberId"
         join "user" u on u."id" = m."userId"
         left join "stockMovement" sm
           on sm."handoverLineId" = hl."id" and ${SALE_MOVEMENT_REASONS}
        where ${HANDOVER_IN_PERIOD}
        order by h."createdAt", h."id", hl."createdAt", hl."id"`,
      instantParams(period),
    )
    return {
      header: [
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
      rows: rows.map((row): CsvCell[] => [
        ...toInstantCells(row.createdAt),
        toTextCell(row.handoverId),
        toTextCell(row.kind),
        toTextCell(row.reversesHandoverId),
        toTextCell(row.membershipNumber),
        toTextCell(row.memberName),
        toTextCell(row.product),
        Number(row.handedQuantity),
        toAmountCell(row.unitPriceAmountCents),
        toAmountCell(row.lineTotalAmountCents),
        toAmountCell(row.costCents),
      ]),
    }
  }

  private async purchases(period: Period): Promise<ExportTable> {
    const rows = await this.query<PurchaseRow>(
      `select r."id" as "receptionId", r."receivedAt", r."supplierOrderId", s."name" as "supplier",
              p."name" as "product", rl."receivedQuantity", rl."unitCostAmountCents",
              round(rl."receivedQuantity" * rl."unitCostAmountCents") as "lineTotalCents"
         from "receptionLine" rl
         join "reception" r on r."id" = rl."receptionId"
         join "supplierOrder" so on so."id" = r."supplierOrderId"
         join "supplier" s on s."id" = so."supplierId"
         join "supplierOrderLine" sol on sol."id" = rl."supplierOrderLineId"
         join "product" p on p."id" = sol."productId"
        where ${RECEPTION_IN_PERIOD}
        order by r."receivedAt", r."id", rl."id"`,
      instantParams(period),
    )
    return {
      header: [
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
      rows: rows.map((row): CsvCell[] => [
        ...toInstantCells(row.receivedAt),
        toTextCell(row.receptionId),
        toTextCell(row.supplierOrderId),
        toTextCell(row.supplier),
        toTextCell(row.product),
        Number(row.receivedQuantity),
        toAmountCell(row.unitCostAmountCents),
        toAmountCell(row.lineTotalCents),
      ]),
    }
  }

  private async membershipFees(period: Period): Promise<ExportTable> {
    const rows = await this.query<MembershipFeeRow>(
      `select mp."id", mp."paidAt", m."membershipNumber", u."name" as "memberName", mp."kind",
              mp."method", mp."amountCents", mp."note"
         from "membershipPayment" mp
         join "membershipFee" f on f."id" = mp."feeId"
         join "member" m on m."id" = f."memberId"
         join "user" u on u."id" = m."userId"
        where ${FEE_PAID_IN_PERIOD}
        order by mp."paidAt", mp."id"`,
      instantParams(period),
    )
    return {
      header: [
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
      rows: rows.map((row): CsvCell[] => [
        ...toInstantCells(row.paidAt),
        toTextCell(row.id),
        toTextCell(row.membershipNumber),
        toTextCell(row.memberName),
        toTextCell(row.kind),
        toTextCell(row.method),
        toAmountCell(row.amountCents),
        toTextCell(row.note),
      ]),
    }
  }

  private async expenses(period: Period): Promise<ExportTable> {
    // `to_char` hands the day back as text: a `date` column would come back as a JS Date.
    const rows = await this.query<ExpenseExportRow>(
      `select e."id", to_char(e."spentOn", 'YYYY-MM-DD') as "day", e."kind", e."cancelsExpenseId",
              e."category", e."label", e."paymentMethod", e."amountCents", e."reason",
              u."name" as "recordedBy", e."createdAt"
         from "expense" e
         join "user" u on u."id" = e."recordedByUserId"
        where ${EXPENSE_IN_PERIOD}
        order by e."spentOn", e."createdAt", e."id"`,
      dayParams(period),
    )
    return {
      header: [
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
      rows: rows.map((row): CsvCell[] => [
        toTextCell(row.day),
        toTextCell(row.id),
        toTextCell(row.kind),
        toTextCell(row.cancelsExpenseId),
        toTextCell(row.category),
        toTextCell(row.label),
        toTextCell(row.paymentMethod),
        toAmountCell(row.amountCents),
        toTextCell(row.reason),
        toTextCell(row.recordedBy),
        new Date(row.createdAt).toISOString(),
      ]),
    }
  }
}
