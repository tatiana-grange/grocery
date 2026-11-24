import type { TFunction } from 'i18next'
import { z } from 'zod'

/** Kept in step with `MAX_PLACES` in the API's slot contract. */
export const MAX_PLACES = 200
const MAX_LABEL_LENGTH = 120

export interface SlotFormValues {
  roleLabel: string
  date: string
  startTime: string
  endTime: string
  places: string
}

/**
 * The slot form holds plain text, as the inputs do. The rule across fields (the end is after the
 * start) is checked here, so the form can show it before anything is sent.
 */
export function createSlotFormSchema(t: TFunction) {
  return z
    .object({
      roleLabel: z
        .string()
        .trim()
        .min(1, t('adminParticipation.form.error.roleLabel'))
        .max(MAX_LABEL_LENGTH, t('adminParticipation.form.error.roleLabel')),
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
    .refine((values) => values.endTime > values.startTime, {
      path: ['endTime'],
      message: t('adminParticipation.form.error.endBeforeStart'),
    })
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `yyyy-mm-dd`, in the browser's time zone: what a date input holds. */
export function toDateInput(instant: string): string {
  const date = new Date(instant)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** `hh:mm`, in the browser's time zone: what a time input holds. */
export function toTimeInput(instant: string): string {
  const date = new Date(instant)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** The instant a date and a time name in the browser's time zone. */
export function toInstant(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString()
}
