/**
 * Pure fixture constants shared by the API's `E2eSeeder` and the `@grocery/web-spa-e2e`
 * package (which imports this file by relative path). Keep it import-free so it loads under
 * Playwright's TypeScript loader without dragging in MikroORM or the entities. This is the
 * single source of truth for the E2E accounts, password and search names.
 */

/**
 * The users the web-spa E2E suite (`apps/web-spa-e2e`) signs in as. Every account shares
 * `E2E_PASSWORD`. `auth.setup.ts` logs `admin`, `member` and `pending` in once and saves
 * their session.
 */
export const E2E_USERS = {
  admin: { email: 'admin@e2e.local', name: 'Ada Admin' },
  member: { email: 'member@e2e.local', name: 'Milo Member' },
  pending: { email: 'pending@e2e.local', name: 'Perry Pending' },
  banned: { email: 'banned@e2e.local', name: 'Ben Banned' },
  /** Active member the résiliation journey signs in as and terminates (revokes its sessions). */
  resign: { email: 'resign@e2e.local', name: 'Rosa Resign' },
  /** Active member the password-change journey signs in as (that flow rotates the session). */
  pwtest: { email: 'pwtest@e2e.local', name: 'Percy Password' },
  /** Lot 4: holds `member,distributor` — runs a distribution, reaches no admin screen. */
  distributor: { email: 'distributor@e2e.local', name: 'Dina Distributor' },
} as const

export type E2eUserKey = keyof typeof E2E_USERS

export const E2E_PASSWORD = 'Password123!'

/** A seeded active member whose name the members-list search spec looks for. */
export const E2E_SEARCH_MEMBER_NAME = 'Zelda Searchable'

/** Barcode on the seeded "Farine T65" product, so the shop's search-by-barcode spec has one. */
export const E2E_PRODUCT_BARCODE = '3760123456789'

/**
 * Lot 3 purchasing fixtures: a dedicated supplier with pending pre-orders, isolated from
 * "Ferme des Prés" so the aggregation / reception / stock specs never collide with the
 * cart / checkout / catalog specs.
 */
export const E2E_PURCHASING = {
  supplierName: 'Fournisseur Achats E2E',
  /** unit-sold, pre-order. Two members pre-order it → aggregation sums to 5. */
  unitProductName: 'Légumes précommande E2E',
  /** by-weight, pre-order, 10% tolerance — the discrepancy spec leans on this band. */
  weightProductName: 'Fromage précommande E2E',
  /** archived before aggregation runs — exercises the "skipped, and why" path (FR-003). */
  archivedProductName: 'Conserves précommande E2E (archivé)',
} as const

/**
 * Lot 4 distribution fixtures: a dedicated supplier, products already in stock, and four
 * members each parked in one of the states the table has to handle. Isolated from the lot 2
 * and lot 3 fixtures so the distribution specs never collide with cart, checkout, catalog,
 * or aggregation.
 */
export const E2E_DISTRIBUTION = {
  supplierName: 'Fournisseur Distribution E2E',
  /** Unit-sold, pre-ordered by the funded member, already received — the happy path. */
  readyProductName: 'Pommes distribution E2E',
  /** By-weight and in stock, so the scale input and FR-012 get exercised. */
  weightProductName: 'Comté distribution E2E',
  /** In stock with a barcode — what the express spec scans. */
  expressProductName: 'Miel distribution E2E',
  expressBarcode: '3761111111118',
  /** Pre-ordered and never received — the "not ready" path. */
  awaitingProductName: 'Poireaux distribution E2E',
  /** Active, funded, holding a ready pre-order and an in-store order. */
  funded: { email: 'funded@e2e.local', name: 'Fanny Funded', balanceEur: 60 },
  /** Active with a zero balance and a ready order — the refusal then pay-then-retry path. */
  broke: { email: 'broke@e2e.local', name: 'Bruno Broke' },
  /** Holds a pre-order whose goods have not arrived. */
  awaiting: { email: 'awaiting@e2e.local', name: 'Anna Awaiting' },
  /** Terminated, holding an order — the handover must be refused (FR-005). */
  ended: { email: 'ended@e2e.local', name: 'Elio Ended' },
} as const

/** First names for the extra members that fill the paginated list (page size is 20). */
export const FILLER_FIRST_NAMES = [
  'Alice',
  'Bruno',
  'Carla',
  'David',
  'Elsa',
  'Femi',
  'Gaia',
  'Hugo',
  'Ines',
  'Jonas',
  'Kenza',
  'Liam',
  'Maya',
  'Noah',
  'Olga',
  'Paul',
  'Rita',
  'Sami',
  'Tara',
  'Umar',
  'Vera',
  'Waris',
  'Xena',
  'Yann',
  'Zoe',
] as const
