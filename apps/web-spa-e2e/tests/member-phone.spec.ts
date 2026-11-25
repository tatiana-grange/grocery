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
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(widths.scroll, 'défilement horizontal').toBeLessThanOrEqual(widths.client)
}

/**
 * Les commandes (bouton, lien, champ) du contenu qui sortent de leur carte, ou de l'écran quand
 * elles n'ont pas de carte, ou dont le texte est coupé. Renvoie le testid ou le texte de chacune.
 */
async function findSpilledControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = []
    const cardSelector =
      '[data-slot="card"], [data-testid^="shop-product-card-"]:not([data-testid="shop-product-card-link"])'
    const view = document.documentElement.clientWidth
    for (const el of document.querySelectorAll('main button, main a, main input')) {
      if (!(el as HTMLElement).checkVisibility()) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      const name =
        el.getAttribute('data-testid') ?? el.textContent?.trim() ?? el.getAttribute('aria-label')
      const card = el.parentElement?.closest(cardSelector)
      const left = card ? card.getBoundingClientRect().left : 0
      const right = card ? card.getBoundingClientRect().right : view
      if (rect.left < left - 1 || rect.right > right + 1) found.push(`${name} (sort de sa boîte)`)
      if (el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1)
        found.push(`${name} (texte coupé)`)
    }
    return found
  })
}

/** Passe en mode soir avant que l'application lise son réglage. */
async function useEveningMode(page: Page): Promise<void> {
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

test.describe('en-tête du téléphone et menu', () => {
  test.describe('membre', () => {
    test.use(withRole('member'))

    test('le bouton Menu remplace les liens, sans débordement', async ({ page }) => {
      await page.goto('/shop')
      const trigger = page.getByTestId('phone-menu-trigger')
      await expect(trigger).toBeVisible()
      await expect(trigger).toContainText('Menu')
      await expect(page.getByTestId('site-nav-cart')).toBeHidden()
      const header = await page.locator('header').evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
      }))
      expect(header.scroll).toBeLessThanOrEqual(header.client)
    })

    test('le menu propose le thème, les langues et la déconnexion', async ({ page }) => {
      await page.goto('/shop')
      await page.getByTestId('phone-menu-trigger').click()
      await expect(page.getByTestId('phone-menu-theme')).toBeVisible()
      await expect(page.getByTestId('phone-menu-lang-fr')).toBeVisible()
      await expect(page.getByTestId('phone-menu-lang-en')).toBeVisible()
      await expect(page.getByTestId('phone-menu-logout')).toBeVisible()
      await expect(page.getByTestId('phone-menu-admin')).toHaveCount(0)

      await page.getByTestId('phone-menu-theme').click()
      await expect(page.locator('body')).toHaveClass(/dark/)
    })
  })

  // Connexion par le formulaire, comme `auth-logout.spec.ts` : `signOut` révoque la session
  // côté serveur, et la session partagée du rôle membre servirait encore aux specs suivantes.
  test.describe('membre connecté par le formulaire', () => {
    test.use({ storageState: SIGNED_OUT })

    test('se déconnecter depuis le menu mène à la connexion', async ({ page }) => {
      await page.goto('/login')
      await page.getByTestId('auth-login-identifier').fill(E2E_USERS.member)
      await page.getByTestId('auth-login-password').fill(E2E_PASSWORD)
      await page.getByTestId('auth-login-submit').click()
      await expect(page.getByTestId('page-shop')).toBeVisible()

      await page.getByTestId('phone-menu-trigger').click()
      await page.getByTestId('phone-menu-logout').click()
      await expect(page).toHaveURL(/\/login/)
    })
  })

  test.describe('administrateur', () => {
    test.use(withRole('admin'))

    test('le menu mène à l’administration', async ({ page }) => {
      await page.goto('/shop')
      await page.getByTestId('phone-menu-trigger').click()
      await page.getByTestId('phone-menu-admin').click()
      await expect(page).toHaveURL(/\/admin\/members/)
    })
  })
})

test.describe('ordinateur et tablette', () => {
  test.describe('membre à 1440 px', () => {
    test.use({ ...withRole('member'), viewport: { width: 1440, height: 900 } })

    test('les liens du bureau portent une icône et un texte, sans barre d’onglets', async ({
      page,
    }) => {
      await page.goto('/shop')
      await expect(page.getByTestId('member-tab-bar')).toBeHidden()
      await expect(page.getByTestId('phone-menu-trigger')).toBeHidden()
      for (const id of [
        'site-nav-cart',
        'site-nav-participation',
        'site-nav-account',
        'nav-logout',
      ]) {
        const link = page.getByTestId(id)
        await expect(link.locator('svg')).toHaveCount(1)
        await expect(link).toHaveText(/\S/)
      }
    })
  })

  test.describe('visiteur à 1440 px', () => {
    test.use({ storageState: SIGNED_OUT, viewport: { width: 1440, height: 900 } })

    test('le lien de connexion porte une icône', async ({ page }) => {
      await page.goto('/shop')
      const link = page.getByTestId('site-nav-signin')
      await expect(link.locator('svg')).toHaveCount(1)
      await expect(link).toHaveText(/\S/)
    })
  })

  test.describe('administrateur à 768 px', () => {
    test.use({ ...withRole('admin'), viewport: { width: 768, height: 1024 } })

    test('les commandes du bureau sont là et rien ne déborde', async ({ page }) => {
      await page.goto('/shop')
      await expect(page.getByTestId('member-tab-bar')).toBeHidden()
      await expect(page.getByTestId('phone-menu-trigger')).toBeHidden()
      await expect(page.getByTestId('site-nav-cart')).toBeVisible()
      await expect(page.getByTestId('site-nav-admin')).toBeVisible()
      await expect(page.getByTestId('app-settings-trigger')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })
})

test.describe('boutique et panier à 390 px', () => {
  test.use(withRole('member'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  async function expectFits(page: Page): Promise<void> {
    await expectNoHorizontalScroll(page)
    expect(await findSpilledControls(page)).toEqual([])
  }

  for (const mode of ['clair', 'soir'] as const) {
    test(`rien ne déborde à 390 px (mode ${mode})`, async ({ page }) => {
      if (mode === 'soir') await useEveningMode(page)

      await page.goto('/shop')
      const grid = page.getByTestId('shop-product-grid')
      await expect(grid).toBeVisible()
      await expect(grid).toHaveAttribute('data-view', 'large')
      await expectFits(page)

      await page.getByTestId('shop-product-card-link').first().click()
      await expect(page.getByTestId('page-shop-product-detail')).toBeVisible()
      await expectFits(page)

      await page.goto('/shop')
      await page.getByTestId('shop-search').fill('Pommes Golden')
      await page.getByTestId('shop-search').press('Enter')
      const card = page.getByTestId('shop-product-grid').locator('> *').filter({
        hasText: 'Pommes Golden',
      })
      await card.locator('[data-testid^="quick-add-submit-"]').click()
      await expect(card.locator('[data-testid^="quick-add-quantity-"]')).toBeVisible()
      await expectFits(page)

      await page.goto('/cart')
      await expect(page.locator('[data-testid^="cart-line-"]').first()).toBeVisible()
      await expectFits(page)
    })
  }

  test('chaque carte garde un bouton Ajouter d’au moins 48 px', async ({ page }) => {
    await page.goto('/shop')
    await expect(page.getByTestId('shop-product-grid')).toBeVisible()

    const add = page.locator('[data-testid^="quick-add-submit-"]').first()
    await expect(add).toBeVisible()
    await expect(add).toHaveText('Ajouter')
    const box = await add.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(48)

    await expect(page.getByRole('link', { name: 'Choisir les options' }).first()).toBeVisible()
  })
})
