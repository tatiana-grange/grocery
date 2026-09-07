/**
 * One source of truth for how a cart quantity is stepped and displayed. The cart always
 * stores a by-weight quantity in kilograms and a unit-sale quantity as a whole piece count;
 * `selectionUnit` / `quantityStepGrams` only shape how the shopper picks it (e.g. a product
 * served in grams, stepping by 100 g). Shared by the shop card quick-add and the cart page.
 */
export interface QuantityPickerProduct {
  saleMode: 'unit' | 'weight'
  selectionUnit: 'g' | 'kg'
  quantityStepGrams: number
}

const round = (value: number) => Number(value.toFixed(3))

/** The picker shows grams (not kilograms) only for a by-weight product served in grams. */
function isGramsPicker(product: QuantityPickerProduct): boolean {
  // `?? 'kg'` / `?? 100` below only bite against an API too old to send the fields.
  return product.saleMode === 'weight' && (product.selectionUnit ?? 'kg') === 'g'
}

/** The +/- step in the cart's own unit: kilograms for weight, whole pieces otherwise. */
export function quantityStep(product: QuantityPickerProduct): number {
  return product.saleMode === 'weight' ? (product.quantityStepGrams ?? 100) / 1000 : 1
}

/** The +/- step in the picker's display unit (grams when the product is served in grams). */
export function pickerStep(product: QuantityPickerProduct): number {
  return isGramsPicker(product) ? (product.quantityStepGrams ?? 100) : quantityStep(product)
}

/** Stored quantity (kg or pieces) → the string shown in the picker, in the product's unit. */
export function formatQuantity(product: QuantityPickerProduct, value: number): string {
  return String(isGramsPicker(product) ? Math.round(value * 1000) : round(value))
}

/** Picker string (grams, kg, or pieces) → the quantity to send to the cart (kg or pieces). */
export function parseQuantity(product: QuantityPickerProduct, text: string): number {
  return round(isGramsPicker(product) ? Number(text) / 1000 : Number(text))
}

/** Display unit shown next to the amount: 'g' / 'kg' for weight, 'piece' otherwise. */
export function selectionUnitLabel(product: QuantityPickerProduct): 'g' | 'kg' | 'piece' {
  return product.saleMode === 'weight' ? (product.selectionUnit ?? 'kg') : 'piece'
}

/** Smallest amount an amount field accepts, in the picker's own unit. */
export function quantityMin(product: QuantityPickerProduct): number {
  if (isGramsPicker(product)) return 1
  return product.saleMode === 'weight' ? 0.001 : 1
}
