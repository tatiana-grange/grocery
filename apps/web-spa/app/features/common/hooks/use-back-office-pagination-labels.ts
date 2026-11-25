import { useTranslation } from 'react-i18next'

interface BackOfficePaginationLabels {
  previousLabel: string
  nextLabel: string
  pageOfLabel: string
}

/** The three translated labels `ListPagination` takes, for a back office list. */
export function useBackOfficePaginationLabels(
  page: number,
  pageCount: number,
): BackOfficePaginationLabels {
  const { t } = useTranslation()
  return {
    previousLabel: t('backOffice.pagination.previous'),
    nextLabel: t('backOffice.pagination.next'),
    pageOfLabel: t('backOffice.pagination.pageOf', { page, pageCount }),
  }
}
