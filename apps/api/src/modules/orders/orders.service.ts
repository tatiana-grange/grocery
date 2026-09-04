import { EntityManager } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'

@Injectable()
export class OrdersService {
  constructor(private readonly em: EntityManager) {}
}
