import type { Locator } from '@playwright/test'
import { expect, test, withRole } from '../fixtures'

/**
 * Le thème « marché de quartier » vu par un membre : couleurs, polices, taille du texte et
 * hauteur des zones tactiles. Les valeurs viennent de `packages/ui/src/styles/globals.css`.
 */

const MIN_TOUCH_HEIGHT = 44

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box, 'élément visible').not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT)
}

test.describe('page de connexion (déconnecté)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByTestId('auth-login-submit')).toBeVisible()
  })

  test('papier crème, encre brune, texte de 18 px en Onest', async ({ page }) => {
    const body = page.locator('body')
    await expect(body).toHaveCSS('background-color', 'rgb(247, 241, 227)')
    await expect(body).toHaveCSS('color', 'rgb(43, 36, 28)')
    await expect(body).toHaveCSS('font-size', '18px')
    expect(await body.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(
      /^"?Onest Variable/,
    )
  })

  test('les titres sont en Lora', async ({ page }) => {
    const heading = page.locator('h1, h2, h3').first()
    expect(await heading.evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(
      /^"?Lora Variable/,
    )
  })

  test('aucun texte sous 14 px ni en majuscules forcées', async ({ page }) => {
    const offenders = await page.evaluate(() => {
      const found: string[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim()
        const el = node.parentElement
        if (!text || !el || el.closest('script, style, noscript')) continue
        if (!el.checkVisibility()) continue
        const style = getComputedStyle(el)
        if (parseFloat(style.fontSize) < 14) found.push(`${text} (${style.fontSize})`)
        if (style.textTransform === 'uppercase') found.push(`${text} (uppercase)`)
      }
      return found
    })
    expect(offenders).toEqual([])
  })

  test('bouton, champ et choix du mode font au moins 44 px de haut', async ({ page }) => {
    await expectTouchTarget(page.getByTestId('auth-login-submit'))
    await expectTouchTarget(page.getByTestId('auth-login-identifier'))
    await expectTouchTarget(page.getByTestId('auth-login-mode-email'))
  })
})

test.describe('boutique (membre)', () => {
  test.use(withRole('member'))

  test('recherche et tri font au moins 44 px de haut', async ({ page }) => {
    await page.goto('/shop')
    await expectTouchTarget(page.getByTestId('shop-search'))
    await expectTouchTarget(page.getByTestId('shop-sort'))
  })

  test('le mode soir passe au fond ardoise et au texte crème', async ({ page }) => {
    await page.goto('/shop')
    await page.getByTestId('app-settings-trigger').click()
    await page.getByTestId('app-settings-theme').click()
    const body = page.locator('body')
    await expect(body).toHaveClass(/dark/)
    await expect(body).toHaveCSS('background-color', 'rgb(47, 58, 51)')
    await expect(body).toHaveCSS('color', 'rgb(247, 241, 227)')
  })
})

test.describe('catalogue (admin)', () => {
  test.use(withRole('admin'))

  test('les onglets font au moins 44 px de haut', async ({ page }) => {
    await page.goto('/admin/catalog')
    const tabs = page.locator('[data-testid^="catalog-tab-"]')
    await expect(tabs.first()).toBeVisible()
    for (const tab of await tabs.all()) await expectTouchTarget(tab)
  })
})
