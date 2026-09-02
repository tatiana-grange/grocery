import { describe, expect, it } from 'vitest'
import { centsToEur, eurToCents, pricingUnitFor } from '../catalog.util'

describe('catalog money and pricing helpers', () => {
  describe('eurToCents / centsToEur', () => {
    it('rounds euros to integer cents and back', () => {
      // Arrange / Act / Assert
      expect(eurToCents(2.4)).toBe(240)
      expect(eurToCents(2.99)).toBe(299)
      expect(eurToCents(0.1 + 0.2)).toBe(30)
      expect(centsToEur(240)).toBe(2.4)
      expect(centsToEur(241)).toBe(2.41)
    })
  })

  describe('pricingUnitFor', () => {
    it('derives the pricing unit from the sale mode', () => {
      expect(pricingUnitFor('unit')).toBe('piece')
      expect(pricingUnitFor('weight')).toBe('kg')
    })
  })
})
