import type { Locator, Page } from '@playwright/test'
import { E2E_DISTRIBUTION } from '../../api/src/seeders/e2e.fixtures'
import { expect, test, withRole } from '../fixtures'

/**
 * La table de distribution sur une tablette (1194 × 834, puis 768 × 1024) : la recherche reste à
 * gauche, la fiche de l'adhérent suit l'ordre de la maquette, rien ne déborde ni ne se coupe.
 * Les étapes de la tranche 03 ajoutent chacune leurs cas ici.
 */

test.use({ viewport: { width: 1194, height: 834 } })

const FANNY = E2E_DISTRIBUTION.funded.name
const ANNA = E2E_DISTRIBUTION.awaiting.name

const SIZES = [
  { name: '1194 × 834', width: 1194, height: 834 },
  { name: '768 × 1024', width: 768, height: 1024 },
] as const
const SLATE = 'rgb(47, 58, 51)'
const SAGE = 'rgb(78, 107, 74)'
const THEMES = ['clair', 'soir'] as const

/** Pas de défilement horizontal : la page tient dans la largeur de l'écran. */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(widths.scroll, 'défilement horizontal').toBeLessThanOrEqual(widths.client)
}

/**
 * Les commandes (bouton, lien, champ) qui sortent de leur carte ou du cadre de leur tableau, ou
 * de l'écran quand elles n'ont ni l'un ni l'autre, ou dont le texte est coupé. Renvoie le testid
 * ou le texte de chacune.
 */
async function findSpilledControls(page: Page, scope = 'main'): Promise<string[]> {
  return page.evaluate((root) => {
    const found: string[] = []
    const cardSelector =
      '[data-slot="card"], [data-slot="table-container"], [data-slot="dialog-content"], [data-testid^="distribution-order-"], [data-testid^="shop-product-card-"]:not([data-testid="shop-product-card-link"])'
    const view = document.documentElement.clientWidth
    for (const el of document.querySelectorAll(`${root} button, ${root} a, ${root} input`)) {
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
  }, scope)
}

/**
 * Les cadres qui défilent de côté ou cachent ce qui dépasse alors que leur contenu est plus large
 * qu'eux : c'est là qu'une ligne coupée se cachait sur le panier du téléphone.
 */
async function findSidewaysScrollers(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = []
    for (const el of document.querySelectorAll('body *')) {
      if (!(el as HTMLElement).checkVisibility()) continue
      const { overflowX } = getComputedStyle(el)
      if (!['auto', 'scroll', 'hidden'].includes(overflowX)) continue
      // A frame 1 px wide is a visually hidden label (`sr-only`), not a cut line.
      if (el.clientWidth > 1 && el.scrollWidth > el.clientWidth + 1) {
        const name =
          el.getAttribute('data-testid') ?? el.getAttribute('data-slot') ?? el.tagName.toLowerCase()
        found.push(`${name} (${el.scrollWidth} > ${el.clientWidth})`)
      }
    }
    return found
  })
}

/** Les textes visibles de moins de 14 px ou en majuscules forcées. */
async function findSmallOrCapitalText(page: Page): Promise<string[]> {
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
async function setEveningModeBeforeLoad(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('app-theme', 'dark')
  })
}

/** L'élément est assez haut pour un doigt ou un gant : au moins `min` px. */
async function expectTall(locator: Locator, min: number): Promise<void> {
  const box = await locator.boundingBox()
  expect(box, 'élément visible').not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(min)
}

/** Tout ce qui doit être vrai de l'écran affiché, quel qu'il soit. */
async function expectScreenFits(page: Page, label: string): Promise<void> {
  await expectNoHorizontalScroll(page)
  expect(await findSpilledControls(page, 'body'), `${label} : commandes qui sortent`).toEqual([])
  expect(await findSidewaysScrollers(page), `${label} : cadres coupés`).toEqual([])
  expect(await findSmallOrCapitalText(page), `${label} : textes petits ou en capitales`).toEqual([])
}

/** Cherche un adhérent dans la colonne de recherche et ouvre sa fiche. */
async function openMember(page: Page, name: string): Promise<void> {
  await page.goto('/distribution')
  await page.getByTestId('distribution-member-search').fill(name)
  await page.locator('[data-testid^="distribution-member-row-"]').filter({ hasText: name }).click()
  await expect(page.getByTestId('page-distribution-member')).toBeVisible()
}

/** La page d'une commande express avec un produit à une quantité plus grande que le stock. */
async function openExpressOverStock(page: Page): Promise<void> {
  await openMember(page, FANNY)
  await page.getByTestId('distribution-start-express').click()
  await expect(page.getByTestId('page-express-order')).toBeVisible()
  await page.getByTestId('express-product-search').fill(E2E_DISTRIBUTION.readyProductName)
  await page.locator('[data-testid^="express-product-option-"]').first().click()
  await page.getByTestId('express-qty').fill('30')
  await expect(page.getByTestId('express-over-stock')).toBeVisible()
}

test.describe('distributeur', () => {
  test.use(withRole('distributor'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  for (const size of SIZES) {
    for (const theme of THEMES) {
      test.describe(`${size.name}, mode ${theme}`, () => {
        test.use({ viewport: { width: size.width, height: size.height } })

        test('la table ne déborde pas et garde la recherche à gauche', async ({ page }) => {
          if (theme === 'soir') await setEveningModeBeforeLoad(page)

          // La page d'accueil, avec des résultats de recherche.
          await page.goto('/distribution')
          await page.getByTestId('distribution-member-search').fill('Fanny')
          await expect(page.getByTestId('distribution-search-results')).toContainText(FANNY)
          await expectScreenFits(page, 'accueil')

          // La fiche, défilée jusqu'en bas : la recherche reste en vue sur une tablette large.
          await openMember(page, FANNY)
          await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
          if (size.width >= 1024)
            await expect(page.getByTestId('distribution-member-search')).toBeInViewport()
          await expectScreenFits(page, 'fiche')

          // Le panneau de paiement.
          await page.getByTestId('wallet-record-payment').click()
          await expect(page.getByTestId('insufficient-balance-dialog')).toBeVisible()
          await expectScreenFits(page, 'panneau de paiement')

          // La correction d'un paiement.
          await page.getByTestId('wallet-payment-amount').fill('10')
          await page.getByTestId('wallet-payment-method-cash').click()
          await page.getByTestId('wallet-payment-submit').click()
          await expect(page.getByTestId('insufficient-balance-dialog')).toBeHidden()
          await page
            .locator('[data-testid^="wallet-entry-"]')
            .filter({ hasText: 'Paiement reçu' })
            .first()
            .getByTestId('wallet-correct-open')
            .click()
          await expect(page.getByTestId('wallet-correct-reason')).toBeVisible()
          await expectScreenFits(page, 'correction de paiement')
          await page.keyboard.press('Escape')

          // La vente express, avec une quantité au-dessus du stock.
          await openExpressOverStock(page)
          await expectScreenFits(page, 'vente express')

          // Le ticket d'une remise, avec le panneau d'annulation ouvert.
          await openMember(page, FANNY)
          await page
            .locator('[data-testid^="distribution-order-"]')
            .last()
            .getByTestId('handover-submit')
            .click()
          await expect(page.getByTestId('handover-receipt')).toBeVisible()
          await page.getByTestId('handover-receipt-link').click()
          await expect(page.getByTestId('page-handover-receipt')).toBeVisible()
          await expect(page.getByTestId('distribution-member-search')).toBeVisible()
          await page.getByTestId('handover-reverse').click()
          await expect(page.getByTestId('handover-reverse-reason')).toBeVisible()
          await expectScreenFits(page, 'ticket')
        })
      })
    }
  }

  test('une seule recherche, à gauche, sur chaque page', async ({ page }) => {
    await page.goto('/distribution')
    const layout = page.getByTestId('distribution-layout')

    await expect(layout.locator('[data-slot="awning-band"]')).toBeVisible()
    const family = await page
      .getByTestId('distribution-home-link')
      .evaluate((el) => getComputedStyle(el).fontFamily)
    expect(family).toMatch(/^"?Lora Variable/)

    for (const testId of ['distribution-nav-shop', 'distribution-nav-account', 'nav-logout']) {
      const control = page.getByTestId(testId)
      await expect(control.locator('svg')).toHaveCount(1)
      expect(((await control.textContent()) ?? '').trim().length).toBeGreaterThan(0)
      await expectTall(control, 44)
    }
    const settings = page.getByTestId('app-settings-trigger')
    await expect(settings.locator('svg')).toHaveCount(1)
    await expect(settings).toHaveAttribute('aria-label', /\S/)
    await expect(settings).toHaveAttribute('title', /\S/)

    const field = (await page.getByTestId('distribution-member-search').boundingBox())!
    const home = (await page.getByTestId('page-distribution-home').boundingBox())!
    expect(field.x + field.width).toBeLessThanOrEqual(402)
    expect(home.x).toBeGreaterThanOrEqual(400)

    await page.getByTestId('distribution-member-search').fill('Fanny')
    const fannyRow = page
      .locator('[data-testid^="distribution-member-row-"]')
      .filter({ hasText: FANNY })
    await fannyRow.click()
    await expect(page.getByTestId('page-distribution-member')).toBeVisible()
    await expect(page.getByTestId('distribution-member-search')).toHaveCount(1)
    await expect(page.getByTestId('distribution-search-results')).toHaveCount(1)
    await expect(fannyRow).toHaveAttribute('aria-current', 'page')

    // Un autre adhérent, sans repasser par l'accueil.
    await page.getByTestId('distribution-member-search').fill('Anna')
    const annaRow = page
      .locator('[data-testid^="distribution-member-row-"]')
      .filter({ hasText: ANNA })
    await annaRow.click()
    const annaId = (await annaRow.getAttribute('data-testid'))!.replace(
      'distribution-member-row-',
      '',
    )
    await expect(page).toHaveURL(new RegExp(`/distribution/members/${annaId}$`))
    await expect(page.getByTestId('page-distribution-member')).toContainText(ANNA)
    await expect(annaRow).toHaveAttribute('aria-current', 'page')
    await expect(fannyRow).toHaveCount(0)

    // La vente express garde la recherche et l'adhérent courant.
    await page.getByTestId('distribution-start-express').click()
    await expect(page.getByTestId('page-express-order')).toBeVisible()
    await expect(page.getByTestId('distribution-member-search')).toBeVisible()
    await expect(annaRow).toHaveAttribute('aria-current', 'page')
  })

  test("la fiche suit l'ordre de la maquette", async ({ page }) => {
    await openMember(page, FANNY)

    const title = page.getByRole('heading', { level: 1 })
    const titleStyle = await title.evaluate((el) => ({
      family: getComputedStyle(el).fontFamily,
      size: parseFloat(getComputedStyle(el).fontSize),
    }))
    expect(titleStyle.family).toMatch(/^"?Lora Variable/)
    expect(titleStyle.size).toBeGreaterThanOrEqual(40)

    const balanceBlock = page.getByTestId('distribution-member-balance-block')
    const toHandOver = page.getByTestId('distribution-to-hand-over')
    const actions = page.getByTestId('distribution-actions')
    // The name and the balance share the first row, the name on the left; then the list to hand
    // over, then the actions.
    const nameBox = (await title.boundingBox())!
    const balanceBox = (await balanceBlock.boundingBox())!
    const listBox = (await toHandOver.boundingBox())!
    const actionsBox = (await actions.boundingBox())!
    expect(nameBox.x, 'le nom à gauche du solde').toBeLessThan(balanceBox.x)
    expect(balanceBox.y + balanceBox.height, 'le solde au-dessus de la liste').toBeLessThanOrEqual(
      listBox.y,
    )
    expect(nameBox.y + nameBox.height, 'le nom au-dessus de la liste').toBeLessThanOrEqual(
      listBox.y,
    )
    expect(listBox.y + listBox.height, 'la liste au-dessus des actions').toBeLessThanOrEqual(
      actionsBox.y,
    )

    await expect(balanceBlock).toHaveCSS('background-color', SLATE)

    const submit = page
      .locator('[data-testid^="distribution-order-"]')
      .first()
      .getByTestId('handover-submit')
    const payment = page.getByTestId('wallet-record-payment')
    const express = page.getByTestId('distribution-start-express')
    const widths: number[] = []
    for (const button of [submit, payment, express]) {
      await expectTall(button, 64)
      expect(((await button.textContent()) ?? '').trim().length).toBeGreaterThan(0)
      widths.push((await button.boundingBox())!.width)
    }
    await expect(submit).toHaveCSS('background-color', SAGE)
    expect(widths[0], 'la validation est le bouton le plus large').toBeGreaterThan(
      Math.max(widths[1], widths[2]),
    )
  })

  test("l'avertissement d'un adhérent résilié vient après la liste et avant les actions", async ({
    page,
  }) => {
    await openMember(page, E2E_DISTRIBUTION.ended.name)
    const warning = (await page.getByTestId('distribution-member-status-warning').boundingBox())!
    const list = (await page.getByTestId('distribution-to-hand-over').boundingBox())!
    const actions = (await page.getByTestId('distribution-actions').boundingBox())!
    expect(warning.y).toBeGreaterThanOrEqual(list.y + list.height)
    expect(warning.y + warning.height).toBeLessThanOrEqual(actions.y)
  })

  test('une ligne pas prête garde sa raison dans la même ligne', async ({ page }) => {
    await openMember(page, ANNA)
    const row = page
      .locator('[data-testid^="handover-line-"]')
      .filter({ has: page.getByTestId('distribution-line-not-ready') })
      .filter({ has: page.getByTestId('handover-excluded') })
    await expect(row).toHaveCount(1)
    await expect(row.getByTestId('distribution-line-not-ready')).toBeVisible()
  })

  test('sous 1024 px, la recherche passe au-dessus du contenu', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/distribution')
    const field = (await page.getByTestId('distribution-member-search').boundingBox())!
    const home = (await page.getByTestId('page-distribution-home').boundingBox())!
    expect(field.y + field.height).toBeLessThanOrEqual(home.y)
  })
})

test.describe('administrateur', () => {
  test.use(withRole('admin'))

  test.beforeEach(async ({ resetDb }) => {
    await resetDb()
  })

  for (const size of SIZES) {
    for (const theme of THEMES) {
      test(`le remboursement tient à ${size.name}, mode ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height })
        if (theme === 'soir') await setEveningModeBeforeLoad(page)
        await openMember(page, FANNY)
        await page.getByTestId('wallet-refund-open').click()
        await expect(page.getByTestId('wallet-refund-amount')).toBeVisible()
        await expectScreenFits(page, 'remboursement')
      })
    }
  }
})
