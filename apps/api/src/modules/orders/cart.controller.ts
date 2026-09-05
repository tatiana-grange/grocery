import { TypedBody, TypedController, TypedParam, TypedRoute } from '@lonestone/nzoth/server'
import { UseGuards } from '@nestjs/common'
import { z } from 'zod'
import { LoggedInBetterAuthSession } from '../auth/auth.config'
import { MemberScoped, Session } from '../auth/auth.decorator'
import { AuthGuard } from '../auth/auth.guard'
import { CartService } from './cart.service'
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
    private readonly mapper: OrdersMapper,
  ) {}

  @TypedRoute.Get('', cartSchema)
  async getCart(@Session() session: LoggedInBetterAuthSession) {
    const cart = await this.cartService.getOrCreateCart(session.user.id)
    return this.mapper.toCart(cart)
  }

  @TypedRoute.Post('lines', cartSchema)
  async addLine(
    @Session() session: LoggedInBetterAuthSession,
    @TypedBody(addCartLineSchema) body: AddCartLineInput,
  ) {
    const cart = await this.cartService.addLine(session.user.id, body)
    return this.mapper.toCart(cart)
  }

  @TypedRoute.Put('lines/:lineId', cartSchema)
  async updateLine(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('lineId', z.string()) lineId: string,
    @TypedBody(updateCartLineSchema) body: UpdateCartLineInput,
  ) {
    const cart = await this.cartService.updateLine(session.user.id, lineId, body)
    return this.mapper.toCart(cart)
  }

  @TypedRoute.Delete('lines/:lineId', cartSchema)
  async removeLine(
    @Session() session: LoggedInBetterAuthSession,
    @TypedParam('lineId', z.string()) lineId: string,
  ) {
    const cart = await this.cartService.removeLine(session.user.id, lineId)
    return this.mapper.toCart(cart)
  }

  @TypedRoute.Post('checkout', checkoutResultSchema)
  async checkout(@Session() session: LoggedInBetterAuthSession) {
    const result = await this.ordersService.checkout(session.user.id)
    return this.mapper.toCheckoutResult(result)
  }
}
