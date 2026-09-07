import { useSyncExternalStore } from 'react'

export const SHOP_VIEWS = ['large', 'compact', 'list'] as const
export type ShopView = (typeof SHOP_VIEWS)[number]

const STORAGE_KEY = 'shop-view'
const DEFAULT_VIEW: ShopView = 'large'

function read(): ShopView {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return SHOP_VIEWS.includes(stored as ShopView) ? (stored as ShopView) : DEFAULT_VIEW
  } catch {
    return DEFAULT_VIEW
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener('storage', callback)
  return () => window.removeEventListener('storage', callback)
}

/**
 * How the shop lays out its product list — persisted per browser, mirroring `useTheme`. It is a
 * display preference, not a filter, so it stays out of the URL (no `?view=` on every shared link).
 */
export function useShopView(): [ShopView, (view: ShopView) => void] {
  const view = useSyncExternalStore(subscribe, read, () => DEFAULT_VIEW)

  const setView = (next: ShopView) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private mode or storage disabled — the choice just won't survive a reload.
    }
    window.dispatchEvent(new Event('storage'))
  }

  return [view, setView]
}
