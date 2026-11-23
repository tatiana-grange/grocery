import { HttpStatus } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { conflict, refusal } from './refusal'

describe('conflict', () => {
  it('keeps statusCode and message in the body, plus the extra fields', () => {
    const error = conflict('Nothing to do', { skippedLines: 2 })

    expect(error.getStatus()).toBe(HttpStatus.CONFLICT)
    expect(error.getResponse()).toEqual({
      statusCode: HttpStatus.CONFLICT,
      message: 'Nothing to do',
      skippedLines: 2,
    })
  })
})

describe('refusal', () => {
  it('adds the code next to the message', () => {
    const error = refusal('already_reversed', 'Already reversed', { handoverId: 'h1' })

    expect(error.getResponse()).toEqual({
      statusCode: HttpStatus.CONFLICT,
      message: 'Already reversed',
      code: 'already_reversed',
      handoverId: 'h1',
    })
  })
})
