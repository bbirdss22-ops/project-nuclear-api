import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CustomerService } from './customer.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { QueryCustomerDto } from './dto/query-customer.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * POST /api/customers — Create customer (public, no auth)
   */
  @Post()
  async create(@Body() dto: CreateCustomerDto) {
    return this.customerService.create(dto);
  }

  /**
   * GET /api/customers — List customers (protected, admin/superadmin)
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  async findAll(@Query() query: QueryCustomerDto) {
    return this.customerService.findAll(query);
  }

  /**
   * GET /api/customers/search?q=xxx — Search customers (protected, admin/superadmin)
   */
  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  async search(@Query() query: QueryCustomerDto) {
    return this.customerService.search(query);
  }

  /**
   * GET /api/customers/line/:lineUserId — Find by Line userId (protected)
   */
  @Get('line/:lineUserId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  async findByLineUserId(@Param('lineUserId') lineUserId: string) {
    return this.customerService.findByLineUserId(lineUserId);
  }

  /**
   * GET /api/customers/:id — Get customer detail (protected)
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  async findById(@Param('id') id: string) {
    return this.customerService.findById(id);
  }

  /**
   * PATCH /api/customers/:id — Update customer (protected)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(id, dto);
  }
}
