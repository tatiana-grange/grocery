import { toast } from '@grocery/ui/components/primitives/sonner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { handleMutationError } from '@/features/common/lib/api-error'

/**
 * A write against the cart: adding, updating, or removing a line. Every one of them refetches
 * the cart afterwards and reports a failure the same way, so only the messages are per-call.
 *
 * The refetch happens on failure too. A rejected write means the screen and the server already
 * disagree — a conflict says so outright — and the shopper should see what the cart really
 * holds rather than the value that was refused.
 */
export function useCartMutation<TVariables = void>(
  mutationFn: (variables: TVariables) => Promise<unknown>,
  messages: { success?: string; conflict?: string } = {},
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const refetchCart = () => void queryClient.invalidateQueries({ queryKey: ['cart'] })

  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (messages.success) toast.success(messages.success)
      refetchCart()
    },
    onError: (error) => {
      refetchCart()
      handleMutationError(error, toast.error, {
        conflict: messages.conflict ?? t('common.conflict'),
        fallback: t('cart.toasts.error'),
      })
    },
  })
}
