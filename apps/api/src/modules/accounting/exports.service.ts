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
  SALE_MOVEMENT_REASONS,
  WALLET_ENTRY_IN_PERIOD,
} from './accounting.queries'
import type { ExportName } from './contracts/accounting.contract'
import { type CsvCell, toCsv } from './csv.util'
import { type Period, toParisDay } from './period.util'

type Row = Record<string, unknown>

/** A quantity from the database (`'1.500'`, `'-2.000'`) as a plain decimal (`1.5`, `-2`). */
function plainQuantity(value: unknown): number {
  return Number(value)
}

/** Text, or an empty cell when the database holds null. */
function text(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

function amount(value: unknown): { cents: number } {
  return { cents: Number(value) }
}

/** The Paris day and the UTC instant of a row's time: the two leading columns of most exports. */
function when(value: unknown): [string, string] {
  const instant = new Date(value as string | Date)
  return [toParisDay(instant), instant.toISOString()]
}

/**
 * The five CSV exports. Each reads its rows for one period with bound parameters, in time order
 * (day, time, id), and writes them with the CSV writer. The period filters and the cost
 * expression come from `accounting.queries.ts`, the file the P&L reads too.
 */
@Injectable()
export class ExportsService {
  constructor(private readonly em: EntityManager) {}

  async build(p: {
    exportName: ExportName
    period: Period
  }): Promise<{ fileName: string; csv: string }> {
    const { header, rows } = await this.read(p.exportName, p.period)
    return {
      fileName: `grocery-${p.exportName}-${p.period.from}-${p.period.to}.csv`,
      csv: toCsv({ header, rows }),
    }
  }

  private read(name: ExportName, period: Period): Promise<{ header: string[]; rows: CsvCell[][] }> {
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

  private query(sql: string, params: string[]): Promise<Row[]> {
    return this.em.getConnection().execute(sql, params, 'all', this.em.getTransactionContext())
  }

  private async walletMovements(period: Period) {
    const rows = await this.query(
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
      rows: rows.map((r): CsvCell[] => [
        ...when(r.createdAt),
        text(r.id),
        text(r.membershipNumber),
        text(r.memberName),
        text(r.reason),
        text(r.paymentMethod),
        amount(r.amountCents),
        text(r.handoverId),
        text(r.note),
      ]),
    }
  }

  private async sales(period: Period) {
    const rows = await this.query(
      `select h."id" as "handoverId", h."createdAt", h."kind", h."reversesHandoverId",
              m."membershipNumber", u."name" as "memberName", ol."productNameSnapshot" as "product",
              hl."handedQuantity", hl."unitPriceAmountCents", hl."lineTotalAmountCents",
              coalesce(${LINE_COST_CENTS}, 0) as "costCents"
         from "handoverLine" hl
         join "handover" h on h."id" = hl."handoverId"
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
      rows: rows.map((r): CsvCell[] => [
        ...when(r.createdAt),
        text(r.handoverId),
        text(r.kind),
        text(r.reversesHandoverId),
        text(r.membershipNumber),
        text(r.memberName),
        text(r.product),
        plainQuantity(r.handedQuantity),
        amount(r.unitPriceAmountCents),
        amount(r.lineTotalAmountCents),
        amount(r.costCents),
      ]),
    }
  }

  private async purchases(period: Period) {
    const rows = await this.query(
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
      rows: rows.map((r): CsvCell[] => [
        ...when(r.receivedAt),
        text(r.receptionId),
        text(r.supplierOrderId),
        text(r.supplier),
        text(r.product),
        plainQuantity(r.receivedQuantity),
        amount(r.unitCostAmountCents),
        amount(r.lineTotalCents),
      ]),
    }
  }

  private async membershipFees(period: Period) {
    const rows = await this.query(
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
      rows: rows.map((r): CsvCell[] => [
        ...when(r.paidAt),
        text(r.id),
        text(r.membershipNumber),
        text(r.memberName),
        text(r.kind),
        text(r.method),
        amount(r.amountCents),
        text(r.note),
      ]),
    }
  }

  private async expenses(period: Period) {
    // `to_char` hands the day back as text: a `date` column would come back as a JS Date.
    const rows = await this.query(
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
      rows: rows.map((r): CsvCell[] => [
        text(r.day),
        text(r.id),
        text(r.kind),
        text(r.cancelsExpenseId),
        text(r.category),
        text(r.label),
        text(r.paymentMethod),
        amount(r.amountCents),
        text(r.reason),
        text(r.recordedBy),
        new Date(r.createdAt as string | Date).toISOString(),
      ]),
    }
  }
}
