import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { CartService } from './cart.service'
import { CartLine } from './entities/cart-line.entity'
import { Cart } from './entities/cart.entity'
import { OrderLine } from './entities/order-line.entity'
import { Order } from './entities/order.entity'
import { OrdersMapper } from './orders.mapper'
import { OrdersService } from './orders.service'

@Module({
  imports: [MikroOrmModule.forFeature([Cart, CartLine, Order, OrderLine])],
  controllers: [],
  providers: [CartService, OrdersService, OrdersMapper],
  exports: [CartService, OrdersService],
})
export class OrdersModule {}
