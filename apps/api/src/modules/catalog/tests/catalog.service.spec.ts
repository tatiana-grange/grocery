import { describe, expect, it } from 'vitest'
import {
  centsToEur,
  eurToCents,
  pricingUnitFor,
  quantityStepGramsFor,
  selectionUnitFor,
} from '../catalog.util'
import type { Product } from '../entities/product.entity'

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

  describe('by-weight quantity picker', () => {
    it('falls back to kilograms in 100 g steps when the product sets nothing', () => {
      const product = {} as Product
      expect(selectionUnitFor(product)).toBe('kg')
      expect(quantityStepGramsFor(product)).toBe(100)
    })

    it('uses the product overrides when present', () => {
      const product = { selectionUnit: 'g', quantityStepGrams: 250 } as Product
      expect(selectionUnitFor(product)).toBe('g')
      expect(quantityStepGramsFor(product)).toBe(250)
    })
  })
})
