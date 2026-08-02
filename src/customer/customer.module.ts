import { Module } from '@nestjs/common';
import { CustomerController } from './customer.controller.js';
import { BankController, BankReuploadController } from './bank.controller.js';
import { CustomerService } from './customer.service.js';
import { LineModule } from '../line/line.module.js';

@Module({
  imports: [LineModule],
  controllers: [CustomerController, BankController, BankReuploadController],
  providers: [CustomerService],
  exports: [CustomerService],
})
export class CustomerModule {}
