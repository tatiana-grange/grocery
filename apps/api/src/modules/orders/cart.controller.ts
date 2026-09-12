import { TypedBody, TypedController, TypedParam, TypedRoute } from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { MemberScoped, Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { InventoryService } from '../inventory/inventory.service'
import { CartService } from './cart.service'
import type { Cart } from './entities/cart.entity'
import {
  type AddCartLineInput,
  addCartLineSchema,
  cartSchema,
  type UpdateCartLineInput,
  updateCartLineSchema,
} from './contracts/cart.contract'
import { checkoutResultSchema } from './contracts/order.contract'
import { OrdersMapper } from './orders.mapper'
import { OrdersService } from './orders.service'

@TypedController('cart', undefined, { tags: ['Cart'] })
@UseGuards(AuthGuard)
@MemberScoped()
export class CartController {
  constructor(
    private readonly cartService: CartService,
    private readonly ordersService: OrdersService,
    private readonly inventory: InventoryService,
    private readonly mapper: OrdersMapper,
  ) {}

  /**
   * Every route here answers with the whole cart, so they all leave through this: it pairs the
   * cart with what the inventory ledger says is on the shelf for its products, in one grouped
   * read. Only the quantity is carried over — the cost price alongside it is staff-only.
   */
  private async present(cart: Cart) {
    const productIds = cart.lines.isInitialized()
      ? cart.lines.getItems().map((line) => line.product.id)
      : []
    const levels = await this.inventory.getStockLevels(productIds)
    const quantities = new Map([...levels].map(([id, level]) => [id, level.quantityOnHand]))
    return this.mapper.toCart(cart, quantities)
  }

  @TypedRoute.Get('', cartSchema)
  async getCart(@Session() session: LoggedInBetterAuthSession) {
    const cart = await this.cartService.getOrCreateCart(session.user.id)
    return this.present(cart)
  }

  @TypedRoute.Post('lines', cartSchema)
  async addLine(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(addCartLineSchema) body: AddCartLineInput,
  ) {
    const cart = await this.cartService.addLine(session.user.id, body)
    return this.present(cart)
  }

  @TypedRoute.Put('lines/:lineId', cartSchema)
  async updateLine(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('lineId', z.string()) lineId: string,
    @TypedBody(updateCartLineSchema) body: UpdateCartLineInput,
  ) {
    const cart = await this.cartService.updateLine(session.user.id, lineId, body)
    return this.present(cart)
  }

  @TypedRoute.Delete('lines/:lineId', cartSchema)
  async removeLine(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('lineId', z.string()) lineId: string,
  ) {
    const cart = await this.cartService.removeLine(session.user.id, lineId)
    return this.present(cart)
  }

  @TypedRoute.Post('checkout', checkoutResultSchema)
  async checkout(@Session() session: LoggedInBetterAuthSession) {
    const result = await this.ordersService.checkout(session.user.id)
    return this.mapper.toCheckoutResult(result)
  }
}
