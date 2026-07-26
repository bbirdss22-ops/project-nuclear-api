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
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { CustomerService } from './customer.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { QueryCustomerDto } from './dto/query-customer.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';

@ApiTags('Customers')
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @ApiOperation({ summary: 'Create customer (Public)' })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({ status: 201, description: 'Customer created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'lineUserId already exists' })
  async create(@Body() dto: CreateCustomerDto) {
    return this.customerService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List customers (paginated)' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'หน้าปัจจุบัน' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20, description: 'จำนวนต่อหน้า' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: '[Deprecated] ใช้ pageSize แทน' })
  @ApiResponse({ status: 200, description: 'Paginated customer list' })
  async findAll(@Query() query: QueryCustomerDto) {
    return this.customerService.findAll(query);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Search customers by name/phone/email' })
  @ApiQuery({ name: 'q', required: false, example: 'สมชาย', description: 'คำค้นหา' })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'หน้าปัจจุบัน' })
  @ApiQuery({ name: 'pageSize', required: false, example: 20, description: 'จำนวนต่อหน้า' })
  @ApiQuery({ name: 'limit', required: false, example: 20, description: '[Deprecated] ใช้ pageSize แทน' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Query() query: QueryCustomerDto) {
    return this.customerService.search(query);
  }

  @Get('line/:lineUserId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Find customer by Line User ID' })
  @ApiResponse({ status: 200, description: 'Customer found' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findByLineUserId(@Param('lineUserId') lineUserId: string) {
    return this.customerService.findByLineUserId(lineUserId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get customer detail by ID' })
  @ApiResponse({ status: 200, description: 'Customer detail' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async findById(@Param('id') id: string) {
    return this.customerService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update customer (partial)' })
  @ApiBody({ type: UpdateCustomerDto })
  @ApiResponse({ status: 200, description: 'Customer updated' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(id, dto);
  }
}
