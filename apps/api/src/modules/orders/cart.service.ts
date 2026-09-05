import { EntityManager, LockMode, UniqueConstraintViolationException } from '@mikro-orm/core'
import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { Product } from '../catalog/entities/product.entity'
import { Member } from '../members/entities/member.entity'
import type { AddCartLineInput, UpdateCartLineInput } from './contracts/cart.contract'
import { CartLine } from './entities/cart-line.entity'
import { Cart } from './entities/cart.entity'

@Injectable()
export class CartService {
  constructor(private readonly em: EntityManager) {}

  async getOrCreateCart(userId: string): Promise<Cart> {
    const member = await this.requireMember(userId)
    return this.loadCartWithLines(member)
  }

  /**
   * Adds a product to the cart, or increases quantity when the same product + ordering mode
   * is already a line (FR-008/FR-010). `orderingMode` must be one the product actually offers.
   */
  async addLine(userId: string, input: AddCartLineInput): Promise<Cart> {
    const member = await this.requireMember(userId)
    const product = await this.em.findOne(
      Product,
      { id: input.productId, archivedAt: null },
      { populate: ['prices'] },
    )
    if (!product) throw new NotFoundException('Product not found')
    if (product.orderingMode !== 'both' && product.orderingMode !== input.orderingMode) {
      throw new ConflictException('This product does not offer that ordering type')
    }
    this.assertQuantity(product, input.quantity)

    try {
      return await this.addLineToCart(member, product, input)
    } catch (error) {
      if (!(error instanceof UniqueConstraintViolationException)) throw error
      // The member had no cart yet and two adds raced to create it — the loser's insert hits
      // the cart's unique (member) constraint with an unhandled 500. Retry once: the cart now
      // exists, so the lock inside addLineToCart serialises us against it like any other add.
      return this.addLineToCart(member, product, input)
    }
  }

  private async addLineToCart(
    member: Member,
    product: Product,
    input: AddCartLineInput,
  ): Promise<Cart> {
    return this.em.transactional(async (em) => {
      // Lock the cart row so two concurrent adds of the same line serialise: without this both
      // readers can see no matching line, both insert one, and the second violates the unique
      // (cart, product, orderingMode) constraint with an unhandled 500 instead of merging.
      const cart = await this.loadCartWithLines(member, em, LockMode.PESSIMISTIC_WRITE)
      const existing = cart.lines
        .getItems()
        .find((line) => line.product.id === product.id && line.orderingMode === input.orderingMode)

      if (existing) {
        existing.quantity = this.addQuantity(existing.quantity, input.quantity)
      } else {
        const line = new CartLine()
        line.cart = cart
        line.product = product
        line.orderingMode = input.orderingMode
        line.quantity = input.quantity.toFixed(3)
        cart.lines.add(line)
        em.persist(line)
      }

      await em.flush()
      return cart
    })
  }

  async updateLine(userId: string, lineId: string, input: UpdateCartLineInput): Promise<Cart> {
    const member = await this.requireMember(userId)
    const cart = await this.loadCartWithLines(member)
    const line = cart.lines.getItems().find((item) => item.id === lineId)
    if (!line) throw new NotFoundException('Cart line not found')

    this.assertQuantity(line.product, input.quantity)
    line.quantity = input.quantity.toFixed(3)
    await this.em.flush()
    return cart
  }

  async removeLine(userId: string, lineId: string): Promise<Cart> {
    const member = await this.requireMember(userId)
    const cart = await this.loadCartWithLines(member)
    const line = cart.lines.getItems().find((item) => item.id === lineId)
    if (!line) throw new NotFoundException('Cart line not found')

    // `orphanRemoval: true` on Cart.lines deletes the row on flush — CartLine.cart is required,
    // so a bare em.remove() without touching the collection would violate the FK.
    cart.lines.remove(line)
    await this.em.flush()
    return cart
  }

  // ============================================================================================
  // Helpers
  // ============================================================================================

  private async requireMember(userId: string): Promise<Member> {
    const member = await this.em.findOne(Member, { user: userId })
    if (!member) throw new NotFoundException('Member not found')
    return member
  }

  /**
   * Creates the cart on first read (data-model.md: "one active cart per member"). Pass a
   * transactional `em` and `lockMode` to serialise concurrent writers against the same cart.
   */
  private async loadCartWithLines(
    member: Member,
    em: EntityManager = this.em,
    lockMode?: LockMode,
  ): Promise<Cart> {
    let cart: Cart | null = await em.findOne(
      Cart,
      { member: member.id },
      lockMode ? { lockMode } : { populate: ['lines', 'lines.product', 'lines.product.prices'] },
    )
    if (!cart) {
      cart = new Cart()
      cart.member = member
      em.persist(cart)
      await em.flush()
    }
    if (lockMode) {
      await em.populate(cart, ['lines', 'lines.product', 'lines.product.prices'])
    }
    return cart
  }

  /**
   * `unit` mode requires an integer ≥ 1; `weight` mode requires a positive multiple of 0.001.
   * Checks via rounding to thousandths rather than `quantity.toString().split('.')` — for
   * magnitudes below 1e-6, `toString()` switches to exponential notation with no `.`, which
   * silently reported 0 decimals and let the value round down to a stored quantity of "0.000".
   */
  private assertQuantity(product: Product, quantity: number): void {
    if (product.saleMode === 'unit') {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new UnprocessableEntityException(
          'Quantity must be a whole number of pieces for this product',
        )
      }
      return
    }
    const thousandths = Math.round(quantity * 1000)
    if (thousandths < 1 || Math.abs(quantity * 1000 - thousandths) > 1e-6) {
      throw new UnprocessableEntityException('Quantity supports at most 3 decimal places')
    }
  }

  private addQuantity(current: string, delta: number): string {
    return (Number(current) + delta).toFixed(3)
  }
}
