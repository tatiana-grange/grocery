import type { TFunction } from 'i18next'
import { refusalMessage } from '@/features/common/lib/api-error'

/**
 * The sentence for a refusal of a sign-up, a leave or a slot change, or `undefined` when the
 * error is not one the participation screens know how to explain.
 */
export function participationRefusalMessage(error: unknown, t: TFunction): string | undefined {
  return refusalMessage(error, {
    slot_cancelled: t('participation.refusal.slot_cancelled'),
    slot_ended: t('participation.refusal.slot_ended'),
    slot_started: t('participation.refusal.slot_started'),
    slot_full: t('participation.refusal.slot_full'),
    already_signed_up: t('participation.refusal.already_signed_up'),
    overlaps_another_slot: t('participation.refusal.overlaps_another_slot'),
    too_late_to_leave: t('participation.refusal.too_late_to_leave'),
    slot_has_signups: t('participation.refusal.slot_has_signups'),
    places_below_signups: t('participation.refusal.places_below_signups'),
  })
}
