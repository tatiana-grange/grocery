import type { Locator, Page } from '@playwright/test'
import { E2E_PASSWORD, E2E_USERS } from '../env'
import { expect, test, withRole } from '../fixtures'

/**
 * L'espace membre sur un téléphone (390 × 844) : barre d'onglets, en-tête, boutique, panier,
 * textes et pages de connexion. Les étapes de la tranche 02 ajoutent chacune leurs cas ici.
 */

test.use({ viewport: { width: 390, height: 844 } })

const MIN_TOUCH_HEIGHT = 44
const SIGNED_OUT = { cookies: [], origins: [] }

/** Pas de défilement horizontal : la page tient dans la largeur de l'écran. */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(widths.scroll, 'défilement horizontal').toBeLessThanOrEqual(widths.client)
}

/** Les textes visibles de moins de 14 px ou en majuscules forcées. */
export async function findSmallOrCapitalText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
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
}

/** Passe en mode soir avant que l'application lise son réglage. */
export async function useEveningMode(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('app-theme', 'dark')
  })
}

/** Se connecte par le formulaire, comme un vrai membre. */
async function signInThroughForm(page: Page, email: string): Promise<void> {
  await page.goto('/login')
  await page.getByTestId('auth-login-identifier').fill(email)
  await page.getByTestId('auth-login-password').fill(E2E_PASSWORD)
  await page.getByTestId('auth-login-submit').click()
}

async function expectTall(locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  expect(box, 'élément visible').not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(MIN_TOUCH_HEIGHT)
}

const TABS = [
  { name: 'shop', url: /\/shop$/, page: 'page-shop' },
  { name: 'cart', url: /\/cart$/, page: 'page-cart' },
  { name: 'participation', url: /\/participation$/, page: 'page-participation' },
  { name: 'account', url: /\/account$/, page: 'page-account' },
] as const

test.describe('barre d’onglets du téléphone', () => {
  test.describe('membre qui se connecte', () => {
    test.use({ storageState: SIGNED_OUT })

    test('un membre se connecte et passe d’un onglet à l’autre', async ({ page }) => {
      await signInThroughForm(page, E2E_USERS.member)
      await expect(page).toHaveURL(/\/shop/)

      const bar = page.getByTestId('member-tab-bar')
      await expect(bar).toBeVisible()
      await expect(
        page
          .getByRole('navigation', { name: /\S/ })
          .filter({ has: page.getByTestId('tab-bar-shop') }),
      ).toBeVisible()
      await expect(page.locator('[data-slot="awning-band"]')).toBeVisible()

      for (const tab of TABS) {
        const link = page.getByTestId(`tab-bar-${tab.name}`)
        await link.click()
        await expect(page).toHaveURL(tab.url)
        await expect(page.getByTestId(tab.page)).toBeVisible()

        for (const other of TABS) {
          const otherLink = page.getByTestId(`tab-bar-${other.name}`)
          if (other.name === tab.name)
            await expect(otherLink).toHaveAttribute('aria-current', 'page')
          else await expect(otherLink).not.toHaveAttribute('aria-current', 'page')
        }
      }

      for (const tab of TABS) {
        const link = page.getByTestId(`tab-bar-${tab.name}`)
        await expectTall(link)
        await expect(link.locator('svg')).toHaveCount(1)
        const label = link.locator('span.truncate')
        await expect(label).toBeVisible()
        const metrics = await label.evaluate((el) => ({
          size: parseFloat(getComputedStyle(el).fontSize),
          scroll: el.scrollWidth,
          client: el.clientWidth,
        }))
        expect(metrics.size).toBeGreaterThanOrEqual(14)
        expect(metrics.scroll).toBeLessThanOrEqual(metrics.client)
      }
    })
  })

  test.describe('visiteur déconnecté', () => {
    test.use({ storageState: SIGNED_OUT })

    test('trois onglets : boutique, panier, connexion', async ({ page }) => {
      await page.goto('/shop')
      await expect(page.getByTestId('member-tab-bar')).toBeVisible()
      await expect(page.getByTestId('member-tab-bar').locator('a')).toHaveCount(3)
      await expect(page.getByTestId('tab-bar-shop')).toBeVisible()
      await expect(page.getByTestId('tab-bar-cart')).toBeVisible()
      await expect(page.getByTestId('tab-bar-signin')).toBeVisible()
      await expect(page.getByTestId('tab-bar-account')).toHaveCount(0)
    })
  })

  test.describe('membre', () => {
    test.use(withRole('member'))

    test.beforeEach(async ({ resetDb }) => {
      await resetDb()
    })

    test('le compteur du panier et le toast restent au-dessus de la barre', async ({ page }) => {
      await page.goto('/shop')
      await page.locator('[data-testid^="quick-add-submit-"]').first().click()
      await expect(page.getByTestId('tab-bar-cart-count')).toHaveText('1')

      const toast = page.locator('[data-sonner-toast]').first()
      await expect(toast).toBeVisible()
      const barBox = await page.getByTestId('member-tab-bar').boundingBox()
      // The toast slides in: wait for it to come to rest before reading its box.
      await expect
        .poll(async () => {
          const box = await toast.boundingBox()
          return box ? box.y + box.height : Number.POSITIVE_INFINITY
        })
        .toBeLessThanOrEqual(barBox!.y)
    })

    test('le bas de la page de compte reste au-dessus de la barre', async ({ page }) => {
      await page.goto('/account')
      const endButton = page.getByTestId('account-end-open')
      await endButton.scrollIntoViewIfNeeded()
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const buttonBox = await endButton.boundingBox()
      const barBox = await page.getByTestId('member-tab-bar').boundingBox()
      expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(barBox!.y)
    })
  })
})
