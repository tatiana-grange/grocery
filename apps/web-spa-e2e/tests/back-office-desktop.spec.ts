import type { Page } from '@playwright/test'
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
