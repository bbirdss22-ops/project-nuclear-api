import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
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
  /**
   * GET /api/customers/stats/registrations — Registration statistics grouped by period.
   * group: 'daily' → 'YYYY-MM-DD', 'monthly' → 'YYYY-MM', 'yearly' → 'YYYY'.
   * Rows are guaranteed to be in ascending time order (even zero-count buckets are filled).
   */
  async getRegistrationStats(
    period: 'daily' | 'monthly' | 'yearly',
    from?: string,
    to?: string,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();
    let fromDate: Date;
    let toDate: Date;

    if (from && to) {
      fromDate = new Date(`${from}T00:00:00`);
      toDate = new Date(`${to}T23:59:59.999`);
    } else {
      toDate = new Date(now.getTime());
      toDate.setHours(23, 59, 59, 999);
      if (period === 'yearly') {
        fromDate = new Date(now.getFullYear() - 5, 0, 1);
      } else if (period === 'monthly') {
        fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      } else {
        fromDate = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
        fromDate.setHours(0, 0, 0, 0);
      }
    }

    const where = {
      status: { not: 'deleted' },
      registeredAt: { gte: fromDate, lte: toDate },
    };

    const rows = await this.prisma.customer.groupBy({
      by: ['registeredAt'],
      where,
      _count: { _all: true },
    });

    // Aggregate raw rows into the requested bucket key.
    const counts = new Map<string, number>();
    rows.forEach((row) => {
      const d = row.registeredAt;
      let key: string;
      if (period === 'yearly') {
        key = `${d.getUTCFullYear()}`;
      } else if (period === 'monthly') {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      } else {
        key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
          d.getUTCDate(),
        ).padStart(2, '0')}`;
      }
      counts.set(key, (counts.get(key) ?? 0) + row._count._all);
    });

    // Build the full ordered bucket list (fill zero-count buckets so keys ascend continuously).
    const data: { key: string; count: number }[] = [];

    if (period === 'daily') {
      const cursor = new Date(fromDate.getTime());
      while (cursor <= toDate) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(
          cursor.getUTCDate(),
        ).padStart(2, '0')}`;
        data.push({ key, count: counts.get(key) ?? 0 });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    } else if (period === 'monthly') {
      const startYear = fromDate.getUTCFullYear();
      const startMonth = fromDate.getUTCMonth();
      const endYear = toDate.getUTCFullYear();
      const endMonth = toDate.getUTCMonth();
      let y = startYear;
      let m = startMonth;
      while (y < endYear || (y === endYear && m <= endMonth)) {
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        data.push({ key, count: counts.get(key) ?? 0 });
        m++;
        if (m > 11) {
          m = 0;
          y++;
        }
      }
    } else {
      const startYear = fromDate.getUTCFullYear();
      const endYear = toDate.getUTCFullYear();
      for (let y = startYear; y <= endYear; y++) {
        const key = `${y}`;
        data.push({ key, count: counts.get(key) ?? 0 });
      }
    }

    const total = data.reduce((sum, d) => sum + d.count, 0);

    return {
      period,
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
      total,
      data,
    };
  }

  /**
   * DELETE /api/customers/:id — Soft-delete a customer by setting status = 'deleted'.
   * Hard delete would break FK integrity (orders/commissions/mlm tree).
   */
  async remove(id: string) {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }
    if (existing.status === 'deleted') {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }
    return this.prisma.customer.update({
      where: { id },
      data: { status: 'deleted' },
    });
  }

  /**
   * POST /api/customers/:id/bank-reupload-send — Generate a fresh bank re-upload token
   * and push a LINE message with the re-upload link. Does not change bank status.
   * Returns { sent: boolean, message } — never throws when the customer has no Line ID.
   */
  async createReuploadToken(id: string): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }

    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        bankReuploadToken: token,
        bankReuploadTokenExpiresAt: expiresAt,
      },
    });

    return { token, expiresAt: updated.bankReuploadTokenExpiresAt! };
  }

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

    const findArgs = {
      skip,
      take: pageSize,
      orderBy: { registeredAt: 'desc' as const },
      where: {
        status: { not: 'deleted' },
        ...(query.bankStatus && { bankStatus: query.bankStatus }),
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.customer.findMany(findArgs),
      this.prisma.customer.count({ where: findArgs.where }),
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
      status: { not: 'deleted' },
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

    if (!customer || customer.status === 'deleted') {
      throw new NotFoundException(
        `Customer with lineUserId "${lineUserId}" not found`,
      );
    }

    return customer;
  }

  /**
   * Find a customer by id, excluding soft-deleted rows.
   */
  async findActiveById(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer || customer.status === 'deleted') {
      throw new NotFoundException(`Customer with id "${id}" not found`);
    }
    return customer;
  }

  // Alias kept for readability in controllers — treats soft-deleted as not found.
  async findByIdNonDeleted(id: string) {
    return this.findActiveById(id);
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
