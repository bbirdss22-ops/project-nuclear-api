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
    // Check lineUserId uniqueness - handle stub customers
    if (dto.lineUserId) {
      const existing = await this.prisma.customer.findUnique({
        where: { lineUserId: dto.lineUserId },
      });
      if (existing) {
        if (existing.firstName) {
          // Already fully registered
          throw new ConflictException(
            `Customer with lineUserId "${dto.lineUserId}" already exists`,
          );
        }
        // Stub customer (created by ensureCustomer) — update with full data instead
        const code = await this.generateCustomerCode();
        const displayName = [dto.firstName, dto.lastName].filter(Boolean).join(' ').trim() || null;
        const updated = await this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            code,
            displayName,
            firstName: dto.firstName ?? null,
            lastName: dto.lastName ?? null,
            phone: dto.phone ?? null,
            email: dto.email ?? null,
            address: dto.address ?? null,
            referrerId: dto.referrerId ?? null,
            bankName: dto.bankName ?? null,
            bankAccountName: dto.bankAccountName ?? null,
            bankAccountNumber: dto.bankAccountNumber ?? null,
            bankStatus: this.hasBankFields(dto) ? 'pending' : undefined,
          },
        });
        return updated;
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
        bankName: dto.bankName ?? null,
        bankAccountName: dto.bankAccountName ?? null,
        bankAccountNumber: dto.bankAccountNumber ?? null,
        ...(this.hasBankFields(dto) && { bankStatus: 'pending' }),
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
        ...(query.bankStatus && { where: { bankStatus: query.bankStatus } }),
      }),
      this.prisma.customer.count({
        ...(query.bankStatus && { where: { bankStatus: query.bankStatus } }),
      }),
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
        ...(dto.bankName !== undefined && { bankName: dto.bankName }),
        ...(dto.bankAccountName !== undefined && { bankAccountName: dto.bankAccountName }),
        ...(dto.bankAccountNumber !== undefined && { bankAccountNumber: dto.bankAccountNumber }),
        ...(this.hasBankFields(dto) && { bankStatus: 'pending' }),
      },
    });

    return customer;
  }

  /**
   * Whether the DTO carries any bank account fields.
   */
  private hasBankFields(dto: CreateCustomerDto | UpdateCustomerDto): boolean {
    return !!(
      dto.bankName !== undefined ||
      dto.bankAccountName !== undefined ||
      dto.bankAccountNumber !== undefined
    );
  }

  /**
   * Record a successful (re)upload of a bank book image.
   * Sets status to 'pending' (if currently none/rejected) and clears reject reason.
   */
  async setBankBookUploaded(
    id: string,
    bankBookPath: string,
    pending: boolean,
  ) {
    const existing = await this.findById(id);
    return this.prisma.customer.update({
      where: { id },
      data: {
        bankBookPath,
        bankRejectReason: null,
        ...(pending && { bankStatus: 'pending' }),
      },
    });
  }

  /**
   * Admin review result — approve or reject a bank account.
   */
  async setBankReviewed(
    id: string,
    action: 'approve' | 'reject',
    reason: string | null,
    reviewerId: string,
    reuploadToken: string | null,
    reuploadTokenExpiresAt: Date | null,
  ) {
    return this.prisma.customer.update({
      where: { id },
      data:
        action === 'approve'
          ? {
              bankStatus: 'approved',
              bankRejectReason: null,
              bankReviewedAt: new Date(),
              bankReviewedById: reviewerId,
              bankReuploadToken: null,
              bankReuploadTokenExpiresAt: null,
            }
          : {
              bankStatus: 'rejected',
              bankRejectReason: reason,
              bankReviewedAt: new Date(),
              bankReviewedById: reviewerId,
              bankReuploadToken: reuploadToken,
              bankReuploadTokenExpiresAt: reuploadTokenExpiresAt,
            },
    });
  }

  /**
   * Validate a re-upload token. Returns matching customer (must be 'rejected' and not expired)
   * or null if invalid.
   */
  async validateReuploadToken(token: string) {
    if (!token) return null;
    const customer = await this.prisma.customer.findUnique({
      where: { bankReuploadToken: token },
    });
    if (!customer) return null;
    if (customer.bankStatus !== 'rejected') return null;
    if (
      !customer.bankReuploadTokenExpiresAt ||
      customer.bankReuploadTokenExpiresAt.getTime() <= Date.now()
    ) {
      return null;
    }
    return customer;
  }

  /**
   * Consume a re-upload token after a successful re-upload:
   * sets status back to 'pending', clears reject reason and token.
   */
  async consumeReuploadToken(id: string, bankBookPath: string) {
    return this.prisma.customer.update({
      where: { id },
      data: {
        bankBookPath,
        bankStatus: 'pending',
        bankRejectReason: null,
        bankReuploadToken: null,
        bankReuploadTokenExpiresAt: null,
      },
    });
  }
}
