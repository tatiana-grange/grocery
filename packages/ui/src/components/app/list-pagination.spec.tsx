import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ListPagination } from './list-pagination'

const baseProps = { page: 2, pageCount: 5, onPageChange: () => {}, testIdPrefix: 'items' }

describe('ListPagination', () => {
  it('keeps today markup without labels: arrows alone and the plain indicator', () => {
    const actualHtml = renderToStaticMarkup(<ListPagination {...baseProps} />)

    expect(actualHtml).not.toContain('Précédent')
    expect(actualHtml).not.toContain('Suivant')
    expect(actualHtml).toMatch(
      /data-testid="items-page-prev"[^>]*><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg><\/button>/,
    )
    expect(actualHtml).toMatch(
      /data-testid="items-page-next"[^>]*><svg[^>]*>(?:<path[^>]*><\/path>)+<\/svg><\/button>/,
    )
    expect(actualHtml).toMatch(/data-testid="items-page-indicator">2 \/ 5</)
    expect(actualHtml).toContain('data-testid="items-page-prev"')
    expect(actualHtml).toContain('data-testid="items-page-next"')
    expect(actualHtml).toContain('data-testid="items-page-indicator"')
  })

  it('shows the count testid when a count is given', () => {
    const actualHtml = renderToStaticMarkup(<ListPagination {...baseProps} count="12 items" />)

    expect(actualHtml).toContain('data-testid="items-count"')
  })

  it('shows the words and the custom indicator when labels are given', () => {
    const actualHtml = renderToStaticMarkup(
      <ListPagination
        {...baseProps}
        previousLabel="Précédent"
        nextLabel="Suivant"
        pageOfLabel="Page 2 / 5"
      />,
    )

    expect(actualHtml).toContain('Précédent')
    expect(actualHtml).toContain('Suivant')
    expect(actualHtml).toContain('Page 2 / 5')
  })
})
