import type { Locator, Page } from '@playwright/test'
import { E2E_PURCHASING } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

/**
 * Le back-office sur un ordinateur (1440 × 900 et 1194 × 834), en mode jour et en mode soir :
 * barre latérale, en-têtes de page, tableaux, statuts. Les étapes de la tranche 04 ajoutent
 * chacune leurs cas ici.
 */

test.use(withRole('admin'))

const NAV_LINKS = ['members', 'catalog', 'purchasing', 'inventory', 'slots', 'accounting'] as const

/**
 * Les textes visibles de moins de 14 px ou en majuscules forcées dans `scope` ; dans une cellule
 * de tableau, ceux de moins de 16 px hors badge.
 */
async function findSmallOrCapitalText(page: Page, scope: string): Promise<string[]> {
  return page.evaluate((root) => {
    const found: string[] = []
    const container = document.querySelector(root)
    if (!container) return [`${root} introuvable`]
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim()
      const el = node.parentElement
      if (!text || !el || el.closest('script, style, noscript')) continue
      if (!el.checkVisibility()) continue
      const style = getComputedStyle(el)
      const size = parseFloat(style.fontSize)
      if (size < 14) found.push(`${text} (${style.fontSize})`)
      if (style.textTransform === 'uppercase') found.push(`${text} (uppercase)`)
      if (el.closest('td') && !el.closest('[data-slot="badge"]') && size < 16)
        found.push(`${text} (cellule ${style.fontSize})`)
    }
    return found
  }, scope)
}

/** Passe en mode soir avant que l'application lise son réglage. */
async function setEveningModeBeforeLoad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('app-theme', 'dark')
  })
}

/**
 * Pas de défilement horizontal : ni la page, ni la zone de contenu, ni aucun cadre qui défile de
 * côté (un tableau qui défile seul cacherait une coupure au contrôle de la page).
 */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const offenders = await page.evaluate(() => {
    const found: string[] = []
    const root = document.documentElement
    if (root.scrollWidth > root.clientWidth) found.push('page')
    const inset = document.querySelector('[data-slot="sidebar-inset"]')
    if (inset && inset.scrollWidth > inset.clientWidth) found.push('zone de contenu')
    for (const el of inset?.querySelectorAll('*') ?? []) {
      const overflowX = getComputedStyle(el).overflowX
      if ((overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 1)
        found.push(`${el.getAttribute('data-slot') ?? el.tagName} défile de côté`)
    }
    return found
  })
  expect(offenders, 'défilement horizontal').toEqual([])
}

/** Les boutons, liens, champs et badges coupés ou qui sortent de l'écran. */
async function findCutControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = []
    const width = document.documentElement.clientWidth
    const height = document.documentElement.clientHeight
    for (const el of document.querySelectorAll('button, a, input, [data-slot="badge"]')) {
      if (!(el as HTMLElement).checkVisibility()) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      const name =
        el.getAttribute('data-testid') ?? el.textContent?.trim() ?? el.getAttribute('aria-label')
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
        found.push(`${name} (texte coupé)`)
      if (rect.left < -1 || rect.right > width + 1) found.push(`${name} (hors de l'écran)`)
      // Vertically, a long page scrolls: only the horizontal box is checked there.
      if (rect.height > height * 4) found.push(`${name} (démesuré)`)
    }
    return found
  })
}

/** Le premier titre de la page est en Lora, d'au moins 48 px. */
async function expectPageHead(page: Page): Promise<void> {
  const title = page.locator('h1').first()
  await expect(title).toBeVisible()
  const metrics = await title.evaluate((el) => ({
    family: getComputedStyle(el).fontFamily,
    size: parseFloat(getComputedStyle(el).fontSize),
  }))
  expect(metrics.family).toMatch(/^"?Lora Variable/)
  expect(metrics.size).toBeGreaterThanOrEqual(48)
}

/**
 * Un tableau dans son cadre : bordure de 2 px, coins de 16 px, titres de colonne de 16 px en
 * gras, boutons d'action d'au moins 44 px de haut avec un mot visible.
 */
async function expectTable(frame: Locator): Promise<void> {
  await expect(frame).toBeVisible()
  const metrics = await frame.evaluate((el) => {
    const style = getComputedStyle(el)
    const heads = [...el.querySelectorAll('th')].filter((th) => th.checkVisibility())
    const actions = [...el.querySelectorAll('td a[data-slot="button"], td button')].filter((b) =>
      (b as HTMLElement).checkVisibility(),
    )
    return {
      border: style.borderTopWidth,
      radius: style.borderTopLeftRadius,
      heads: heads
        .filter((th) => th.textContent?.trim())
        .map((th) => ({
          size: parseFloat(getComputedStyle(th).fontSize),
          weight: parseInt(getComputedStyle(th).fontWeight, 10),
        })),
      actions: actions.map((button) => ({
        height: button.getBoundingClientRect().height,
        text: button.textContent?.trim() ?? '',
      })),
    }
  })
  expect(metrics.border).toBe('2px')
  expect(metrics.radius).toBe('16px')
  expect(metrics.heads.length).toBeGreaterThan(0)
  for (const head of metrics.heads) {
    expect(head.size).toBeGreaterThanOrEqual(16)
    expect(head.weight).toBeGreaterThanOrEqual(700)
  }
  for (const action of metrics.actions) {
    expect(action.height).toBeGreaterThanOrEqual(44)
    expect(action.text).not.toBe('')
  }
}

/** Le cadre du premier tableau de la page. */
function firstTableFrame(page: Page): Locator {
  return page.locator('[data-slot="table-container"]:visible').first().locator('..')
}

const SIZES = [
  { name: '1440 × 900', width: 1440, height: 900 },
  { name: '1194 × 834', width: 1194, height: 834 },
] as const
const MODES = ['jour', 'soir'] as const

/** Les contrôles communs à toutes les pages du back-office. */
async function expectCleanPage(page: Page): Promise<void> {
  await expectPageHead(page)
  await expectNoHorizontalScroll(page)
  expect(await findCutControls(page), 'contrôles coupés').toEqual([])
  expect(await findSmallOrCapitalText(page, '[data-slot="sidebar-inset"]')).toEqual([])
}

test.describe('barre latérale', () => {
  test('à 1440 px : bandeau, nom en Lora, six liens avec icône, bouton de distribution', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin/members')
    const sidebar = page.locator('[data-slot="sidebar"]')

    await expect(sidebar.locator('[data-slot="awning-band"]')).toBeVisible()
    const name = sidebar.getByText('Grocery', { exact: true })
    await expect(name).toBeVisible()
    expect(await name.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/^"?Lora Variable/)
    await expect(sidebar.getByText("Gestion de l'épicerie")).toBeVisible()

    for (const link of NAV_LINKS) {
      const item = page.getByTestId(`back-office-nav-${link}`)
      await expect(item).toBeVisible()
      await expect(item.locator('svg')).not.toHaveCount(0)
      const label = item.locator('span').last()
      await expect(label).toBeVisible()
      await expect(label).toHaveText(/\S/)
      expect(await label.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBe(18)
      if (link === 'members') await expect(item).toHaveAttribute('aria-current', 'page')
      else await expect(item).not.toHaveAttribute('aria-current', 'page')
    }
    await expect(sidebar.locator('[aria-current="page"]')).toHaveCount(1)

    const distribution = page.getByTestId('back-office-nav-distribution')
    await expect(distribution).toBeVisible()
    await expect(distribution).toHaveText(/\S/)
    const distributionBox = await distribution.boundingBox()
    const lastLinkBox = await page.getByTestId('back-office-nav-accounting').boundingBox()
    expect(distributionBox!.height).toBeGreaterThanOrEqual(48)
    expect(distributionBox!.y).toBeGreaterThan(lastLinkBox!.y + lastLinkBox!.height)

    await expect(page.locator('[data-slot="sidebar-container"]')).toHaveCSS(
      'border-right-width',
      '2px',
    )
    expect(await findSmallOrCapitalText(page, '[data-slot="sidebar-container"]')).toEqual([])
  })

  test('le lien de la page courante change avec la page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin/catalog')

    await expect(page.getByTestId('back-office-nav-catalog')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(page.getByTestId('back-office-nav-members')).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('le bouton du bureau replie toute la barre, sans rail d’icônes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/admin/members')
    await expect(page.getByTestId('back-office-nav-members')).toBeVisible()

    await page.locator('[data-slot="sidebar-trigger"]').click()

    await expect(page.getByTestId('back-office-nav-members')).not.toBeInViewport()
    await expect(page.locator('[data-slot="sidebar-container"]')).not.toBeInViewport()
  })

  test('sur un téléphone, la barre est cachée et s’ouvre par le bouton', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/admin/members')
    await expect(page.getByTestId('back-office-nav-catalog')).toBeHidden()

    await page.locator('[data-slot="sidebar-trigger"]').click()

    await expect(page.getByTestId('back-office-nav-catalog')).toBeVisible()
  })
})

for (const size of SIZES) {
  for (const mode of MODES) {
    test.describe(`adhérents à ${size.name}, mode ${mode}`, () => {
      test.beforeEach(async ({ page, resetDb }) => {
        await resetDb()
        await page.setViewportSize({ width: size.width, height: size.height })
        if (mode === 'soir') await setEveningModeBeforeLoad(page)
      })

      test('la liste : en-tête, cadre, statut en mots, actions et pagination', async ({ page }) => {
        await page.goto('/admin/members')
        await expect(page.getByTestId('members-row-name').first()).toBeVisible()

        await expectTable(firstTableFrame(page))
        await expectCleanPage(page)
        expect(
          (await page.getByTestId('members-search').boundingBox())!.height,
        ).toBeGreaterThanOrEqual(52)

        const pendingRow = page
          .locator('tr', { has: page.getByTestId('member-status-pending') })
          .first()
        const badge = pendingRow.getByTestId('member-status-pending')
        await expect(badge).toHaveText('En attente')
        await expect(badge).toHaveCSS('background-color', 'rgb(233, 196, 106)')
        await expect(pendingRow.getByTestId('members-row-review')).toHaveText('Examiner')

        await expect(page.getByTestId('members-page-prev')).toHaveText(/\S/)
        await expect(page.getByTestId('members-page-next')).toHaveText(/\S/)
        await expect(page.getByTestId('members-page-indicator')).toContainText('1 /')
      })

      test('l’onglet « tous » : une ligne active propose « Ouvrir »', async ({ page }) => {
        await page.goto('/admin/members?status=all')
        await expect(page.getByTestId('members-row-name').first()).toBeVisible()

        await expectTable(firstTableFrame(page))
        await expectCleanPage(page)
        const activeRow = page
          .locator('tr', { has: page.getByTestId('member-status-active') })
          .first()
        await expect(activeRow.getByTestId('members-row-review')).toHaveText('Ouvrir')
      })

      test('la fiche d’un adhérent', async ({ page }) => {
        await page.goto('/admin/members')
        await page.getByTestId('members-row-review').first().click()
        await expect(page.getByTestId('page-member-detail')).toBeVisible()

        await expectCleanPage(page)
      })
    })
  }
}

for (const size of SIZES) {
  for (const mode of MODES) {
    test.describe(`catalogue à ${size.name}, mode ${mode}`, () => {
      test.beforeEach(async ({ page, resetDb }) => {
        await resetDb()
        await page.setViewportSize({ width: size.width, height: size.height })
        if (mode === 'soir') await setEveningModeBeforeLoad(page)
      })

      for (const tab of ['products', 'suppliers', 'categories'] as const) {
        test(`l’onglet ${tab}`, async ({ page }) => {
          await page.goto(`/admin/catalog?tab=${tab}`)
          await expect(page.getByTestId(`catalog-tab-${tab}`)).toHaveAttribute(
            'aria-selected',
            'true',
          )
          await expect(firstTableFrame(page).locator('tbody tr').first()).toBeVisible()

          await expectTable(firstTableFrame(page))
          await expectCleanPage(page)
        })
      }

      test('la fiche d’un produit et le formulaire d’un nouveau produit', async ({ page }) => {
        await page.goto('/admin/catalog')
        await page.getByTestId('product-row-open').first().click()
        await expect(page.getByTestId('product-detail-name')).toBeVisible()
        await expectCleanPage(page)

        await page.goto('/admin/catalog/products/new')
        await expect(page.getByTestId('page-product-form')).toBeVisible()
        await expectCleanPage(page)
      })

      test('un fournisseur archivé porte le mot « Archivé »', async ({ page }) => {
        // The page never asks for archived suppliers, so the answer is changed on its way:
        // the first supplier comes back archived, as the API would send it.
        await page.route(
          (url) => url.pathname === '/api/admin/suppliers',
          async (route) => {
            const response = await route.fetch()
            const body = await response.json()
            body.data[0].archivedAt = '2026-01-01T00:00:00.000Z'
            await route.fulfill({ response, json: body })
          },
        )
        await page.goto('/admin/catalog?tab=suppliers')

        const row = page.locator('[data-testid^="supplier-row-"]').first()
        await expect(row).toContainText('Archivé')
        await expectCleanPage(page)
      })
    })
  }
}

for (const size of SIZES) {
  for (const mode of MODES) {
    test.describe(`comptabilité à ${size.name}, mode ${mode}`, () => {
      test.beforeEach(async ({ page, resetDb }) => {
        await resetDb()
        await page.setViewportSize({ width: size.width, height: size.height })
        if (mode === 'soir') await setEveningModeBeforeLoad(page)
      })

      test('le compte de résultat', async ({ page }) => {
        await page.goto('/admin/accounting')
        await expect(page.getByTestId('pnl-result')).toBeVisible()

        await expectTable(firstTableFrame(page))
        await expectCleanPage(page)
      })

      test('les dépenses', async ({ page }) => {
        await page.goto('/admin/accounting/expenses')
        await expect(page.getByTestId('page-expenses')).toBeVisible()
        await expect(firstTableFrame(page).locator('tbody tr').first()).toBeVisible()

        await expectTable(firstTableFrame(page))
        await expectCleanPage(page)
      })
    })
  }
}

test.describe('achats, stock et créneaux à 1440 × 900, mode jour', () => {
  test.beforeEach(async ({ page, resetDb }) => {
    await resetDb()
    await page.setViewportSize({ width: 1440, height: 900 })
  })

  test('achats : une commande fournisseur, son détail envoyé et la liste', async ({ page }) => {
    await page.goto('/admin/catalog?tab=suppliers')
    await page
      .getByTestId(`supplier-row-${E2E_PURCHASING.supplierName}`)
      .getByTestId('supplier-aggregate')
      .click()
    await expect(page.getByTestId('page-supplier-order-detail')).toBeVisible()
    await expect(page.getByTestId('supplier-order-skipped')).toBeVisible()
    await expectTable(firstTableFrame(page))
    await expectCleanPage(page)

    await page.getByTestId('supplier-order-send').click()
    await expect(page.getByTestId('supplier-order-status')).toHaveText('Envoyée')
    await expect(page.getByTestId('reception-submit')).toBeVisible()
    await expectCleanPage(page)

    await page.goto('/admin/purchasing')
    await expect(page.getByTestId('page-supplier-orders-list')).toBeVisible()
    await expect(page.locator('[data-testid^="supplier-orders-row-"]').first()).toBeVisible()
    await expectTable(firstTableFrame(page))
    await expectCleanPage(page)
  })

  test('stock : la liste et la fiche d’un produit', async ({ page }) => {
    await page.goto('/admin/inventory')
    await expect(page.getByTestId('stock-row-open').first()).toBeVisible()
    await expectTable(firstTableFrame(page))
    await expectCleanPage(page)

    await page.getByTestId('stock-row-open').first().click()
    await expect(page.getByTestId('page-stock-detail')).toBeVisible()
    await expect(page.getByTestId('stock-detail-on-hand')).toHaveCSS('border-top-width', '2px')
    await expect(page.getByTestId('stock-detail-cost')).toHaveCSS('border-top-width', '2px')
    await expectCleanPage(page)
  })

  test('créneaux : la liste et la fiche d’un créneau', async ({ page }) => {
    await page.goto('/admin/slots')
    await expect(page.getByTestId('row-open').first()).toBeVisible()
    await expectTable(firstTableFrame(page))
    await expectCleanPage(page)

    await page.getByTestId('row-open').first().click()
    await expect(page.getByTestId('page-slot-detail')).toBeVisible()
    await expect(page.getByTestId('slot-detail-count')).toHaveCSS('border-top-width', '2px')
    await expectCleanPage(page)
  })
})
