import { MikroOrmModule } from '@mikro-orm/nestjs'
import { Module } from '@nestjs/common'
import { InventoryModule } from '../inventory/inventory.module'
import { CartController } from './cart.controller'
import { CartService } from './cart.service'
import { CartLine } from './entities/cart-line.entity'
import { Cart } from './entities/cart.entity'
import { OrderLine } from './entities/order-line.entity'
import { Order } from './entities/order.entity'
import { OrdersMapper } from './orders.mapper'
import { OrdersService } from './orders.service'

@Module({
  // The cart splits each line by what is on the shelf, which lives in the inventory ledger.
  imports: [MikroOrmModule.forFeature([Cart, CartLine, Order, OrderLine]), InventoryModule],
  controllers: [CartController],
  providers: [CartService, OrdersService, OrdersMapper],
  exports: [CartService, OrdersService],
})
export class OrdersModule {}
