import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  ParseUUIDPipe,
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
import { RegistrationStatsQueryDto } from './dto/registration-stats-query.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { LineService } from '../line/line.service.js';

@ApiTags('Customers')
@Controller('customers')
export class CustomerController {
  private readonly logger = new Logger(CustomerController.name);

  constructor(
    private readonly customerService: CustomerService,
    private readonly lineService: LineService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create customer (Public)' })
  @ApiBody({ type: CreateCustomerDto })
  @ApiResponse({ status: 201, description: 'Customer created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'lineUserId already exists or phone already in use' })
  async create(@Body() dto: CreateCustomerDto) {
    const customer = await this.customerService.create(dto);

    // Push welcome message with customer code via LINE if lineUserId is available
    if (customer.lineUserId && customer.code) {
      // T145: activity image (ACTIVITY_IMAGE_URL) is prepended when configured
      this.lineService
        .pushWelcome(customer.lineUserId, customer.code)
        .catch((e: Error) =>
          this.logger.error(`Push welcome failed: ${e.message}`),
        );
    }

    return customer;
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

  @Get('stats/registrations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Registration statistics grouped by period (admin)' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'monthly', 'yearly'], example: 'daily', description: 'ช่วงเวลาการรวมกลุ่ม' })
  @ApiQuery({ name: 'from', required: false, example: '2026-01-01', description: 'วันที่เริ่มต้น (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, example: '2026-12-31', description: 'วันที่สิ้นสุด (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: '{ period, from, to, total, data: [{ key, count }] }' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid period/date format' })
  async registrationStats(@Query() query: RegistrationStatsQueryDto) {
    return this.customerService.getRegistrationStats(
      query.period ?? 'daily',
      query.from,
      query.to,
    );
  }

  @Get('search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Search customers by code/name/phone/email' })
  @ApiQuery({ name: 'q', required: false, example: 'NC00001', description: 'คำค้นหา (code/ชื่อ/เบอร์/email)' })
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

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Soft-delete customer (set status=deleted)' })
  @ApiResponse({ status: 200, description: 'Customer soft-deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customerService.remove(id);
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
