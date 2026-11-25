import { useTranslation } from 'react-i18next'

interface BackOfficePaginationLabels {
  previousLabel: string
  nextLabel: string
  pageOfLabel: string
}

interface UseBackOfficePaginationLabelsInput {
  page: number
  pageCount: number
}

/** The three translated labels `ListPagination` takes, for a back office list. */
export function useBackOfficePaginationLabels({
  page,
  pageCount,
}: UseBackOfficePaginationLabelsInput): BackOfficePaginationLabels {
  const { t } = useTranslation()
  return {
    previousLabel: t('backOffice.pagination.previous'),
    nextLabel: t('backOffice.pagination.next'),
    pageOfLabel: t('backOffice.pagination.pageOf', { page, pageCount }),
  }
}
