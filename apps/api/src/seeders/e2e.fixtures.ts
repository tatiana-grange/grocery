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
