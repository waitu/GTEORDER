import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BalanceTransaction } from './balance-transaction.entity.js';
import { BalanceService } from './balance.service.js';
import { User } from '../../modules/users/user.entity.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([BalanceTransaction, User])],
  providers: [BalanceService],
  exports: [BalanceService, TypeOrmModule],
})
export class BalanceModule {}
