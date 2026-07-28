import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { QueryCustomerDto } from './dto/query-customer.dto.js';
import { PaginatedResponse, buildPaginationLinks } from '../common/interfaces/pagination.interface.js';

const CUSTOMER_BASE_PATH = '/api/customers';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate the next customer code in NC + 5-digit zero-padded format.
   */
  async generateCustomerCode(): Promise<string> {
    const count = await this.prisma.customer.count();
    return `NC${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * POST /api/customers — Create a new customer (public)
   */
  async create(dto: CreateCustomerDto) {
    // Check lineUserId uniqueness
    if (dto.lineUserId) {
      const existing = await this.prisma.customer.findUnique({
        where: { lineUserId: dto.lineUserId },
      });
      if (existing) {
        throw new ConflictException(
          `Customer with lineUserId "${dto.lineUserId}" already exists`,
        );
      }
    }

    // Validate referrerId if provided
    if (dto.referrerId) {
      const referrer = await this.prisma.customer.findUnique({
        where: { id: dto.referrerId },
      });
      if (!referrer) {
        throw new BadRequestException(
          `Referrer with id "${dto.referrerId}" not found`,
        );
      }
    }

    // Build displayName from firstName + lastName
    const displayName = [dto.firstName, dto.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || null;

    const code = await this.generateCustomerCode();

    const customer = await this.prisma.customer.create({
      data: {
        code,
        lineUserId: dto.lineUserId ?? null,
        displayName,
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        address: dto.address ?? null,
        referrerId: dto.referrerId ?? null,
      },
    });

    return customer;
  }

  /**
   * Build a standardized paginated response
   */
  private paginate<T>(
    data: T[],
    total: number,
    page: number,
    pageSize: number,
    basePath: string,
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data,
      page,
      pageSize,
      totalItems: total,
      totalPages,
      _links: buildPaginationLinks(basePath, page, pageSize, totalPages),
    };
  }

  /**
   * GET /api/customers — List customers (paginated)
   */
  async findAll(query: QueryCustomerDto): Promise<PaginatedResponse<any>> {
    const page = query.page ?? 1;
    const pageSize = query.effectivePageSize;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        skip,
        take: pageSize,
        orderBy: { registeredAt: 'desc' },
      }),
      this.prisma.customer.count(),
    ]);

    return this.paginate(data, total, page, pageSize, CUSTOMER_BASE_PATH);
  }

  /**
   * GET /api/customers/search?q=xxx — Search customers
   */
  async search(query: QueryCustomerDto): Promise<PaginatedResponse<any>> {
    const page = query.page ?? 1;
    const pageSize = query.effectivePageSize;
    const skip = (page - 1) * pageSize;
    const q = query.q?.trim();

    if (!q) {
      // No query — return all paginated
      return this.findAll(query);
    }

    const where = {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' as const } },
        { lastName: { contains: q, mode: 'insensitive' as const } },
        { phone: { contains: q, mode: 'insensitive' as const } },
        { email: { contains: q, mode: 'insensitive' as const } },
        { displayName: { contains: q, mode: 'insensitive' as const } },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { registeredAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return this.paginate(data, total, page, pageSize, CUSTOMER_BASE_PATH);
  }

  /**
   * GET /api/customers/:id — Get customer by id
   */
  async findById(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }

    return customer;
  }

  /**
   * GET /api/customers/line/:lineUserId — Find by Line userId
   */
  async findByLineUserId(lineUserId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { lineUserId },
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with lineUserId "${lineUserId}" not found`,
      );
    }

    return customer;
  }

  /**
   * PATCH /api/customers/:id — Update customer (partial)
   */
  async update(id: string, dto: UpdateCustomerDto) {
    // Check customer exists
    const existing = await this.prisma.customer.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }

    // Check lineUserId uniqueness if changed
    if (dto.lineUserId && dto.lineUserId !== existing.lineUserId) {
      const conflict = await this.prisma.customer.findUnique({
        where: { lineUserId: dto.lineUserId },
      });
      if (conflict) {
        throw new ConflictException(
          `Customer with lineUserId "${dto.lineUserId}" already exists`,
        );
      }
    }

    // Validate referrerId if provided
    if (dto.referrerId && dto.referrerId !== id) {
      const referrer = await this.prisma.customer.findUnique({
        where: { id: dto.referrerId },
      });
      if (!referrer) {
        throw new BadRequestException(
          `Referrer with id "${dto.referrerId}" not found`,
        );
      }
    }

    // Rebuild displayName if firstName or lastName changed
    const firstName = dto.firstName ?? existing.firstName;
    const lastName = dto.lastName ?? existing.lastName;
    const displayName = dto.firstName || dto.lastName
      ? [firstName, lastName].filter(Boolean).join(' ').trim() || null
      : undefined;

    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.lineUserId !== undefined && { lineUserId: dto.lineUserId }),
        ...(displayName !== undefined && { displayName }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.referrerId !== undefined && { referrerId: dto.referrerId }),
      },
    });

    return customer;
  }
}
