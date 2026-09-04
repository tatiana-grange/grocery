import { EntityManager } from '@mikro-orm/core'
import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common'
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

    const cart = await this.loadCartWithLines(member)
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
      this.em.persist(line)
    }

    await this.em.flush()
    return cart
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

  /** Creates the cart on first read (data-model.md: "one active cart per member"). */
  private async loadCartWithLines(member: Member): Promise<Cart> {
    let cart: Cart | null = await this.em.findOne(
      Cart,
      { member: member.id },
      { populate: ['lines', 'lines.product', 'lines.product.prices'] },
    )
    if (!cart) {
      cart = new Cart()
      cart.member = member
      this.em.persist(cart)
      await this.em.flush()
    }
    return cart
  }

  /** `unit` mode requires an integer ≥ 1; `weight` mode requires ≤ 3 decimal places. */
  private assertQuantity(product: Product, quantity: number): void {
    if (product.saleMode === 'unit') {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new UnprocessableEntityException(
          'Quantity must be a whole number of pieces for this product',
        )
      }
      return
    }
    const decimals = (quantity.toString().split('.')[1] ?? '').length
    if (decimals > 3) {
      throw new UnprocessableEntityException('Quantity supports at most 3 decimal places')
    }
  }

  private addQuantity(current: string, delta: number): string {
    return (Number(current) + delta).toFixed(3)
  }
}
