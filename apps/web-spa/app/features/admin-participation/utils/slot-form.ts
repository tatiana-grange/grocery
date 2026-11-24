import { zSlotInput } from '@grocery/openapi-generator/client/zod.gen'
import type { TFunction } from 'i18next'
import { z } from 'zod'

function requireBound(bound: number | null | undefined, name: string): number {
  if (bound == null) throw new Error(`The API slot contract has no bound for ${name}`)
  return bound
}

export const MAX_PLACES = requireBound(zSlotInput.shape.places.maxValue, 'places')
export const MAX_LABEL_LENGTH = requireBound(zSlotInput.shape.roleLabel.maxLength, 'roleLabel')

export interface SlotFormValues {
  roleLabel: string
  date: string
  startTime: string
  endTime: string
  places: string
}

/**
 * The slot form holds plain text, as the inputs do. The rule across fields (the end is after the
 * start) is checked here, so the form can show it before anything is sent. Locked times are sent
 * back unchanged, so they are not checked: a booked slot that crosses midnight stays editable.
 */
export function createSlotFormSchema(t: TFunction, { timesLocked }: { timesLocked: boolean }) {
  return z
    .object({
      roleLabel: z
        .string()
        .trim()
        .min(1, t('adminParticipation.form.error.roleLabel', { max: MAX_LABEL_LENGTH }))
        .max(
          MAX_LABEL_LENGTH,
          t('adminParticipation.form.error.roleLabel', { max: MAX_LABEL_LENGTH }),
        ),
      date: z.string().min(1, t('adminParticipation.form.error.date')),
      startTime: z.string().min(1, t('adminParticipation.form.error.time')),
      endTime: z.string().min(1, t('adminParticipation.form.error.time')),
      places: z
        .string()
        .regex(/^\d+$/, t('adminParticipation.form.error.places', { max: MAX_PLACES }))
        .refine(
          (value) => Number(value) >= 1 && Number(value) <= MAX_PLACES,
          t('adminParticipation.form.error.places', { max: MAX_PLACES }),
        ),
    })
    .refine((values) => timesLocked || values.endTime > values.startTime, {
      path: ['endTime'],
      message: t('adminParticipation.form.error.endBeforeStart'),
    })
}

function padNumber(value: number): string {
  return String(value).padStart(2, '0')
}

/** `yyyy-mm-dd`, in the browser's time zone: what a date input holds. */
export function toDateInput(instant: string): string {
  const date = new Date(instant)
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`
}

/** `hh:mm`, in the browser's time zone: what a time input holds. */
export function toTimeInput(instant: string): string {
  const date = new Date(instant)
  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`
}

/** The instant a date and a time name in the browser's time zone. */
export function toInstant(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString()
}
