import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { QueryUserDto } from './dto/query-user.dto.js';
import { PaginatedResponse, buildPaginationLinks } from '../common/interfaces/pagination.interface.js';

const USER_BASE_PATH = '/api/users';

const USER_SELECT = {
  id: true,
  username: true,
  role: true,
  createdAt: true,
} as const;

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * GET /api/users — Paginated list of admin users (excludes password).
   */
  async findAll(query: QueryUserDto): Promise<PaginatedResponse<any>> {
    const page = query.page ?? 1;
    const pageSize = query.effectivePageSize;
    const skip = (page - 1) * pageSize;

    const where = query.q
      ? { username: { contains: query.q } }
      : undefined;

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / pageSize) || 1;

    return {
      data,
      page,
      pageSize,
      totalItems: total,
      totalPages,
      _links: buildPaginationLinks(USER_BASE_PATH, page, pageSize, totalPages),
    };
  }

  /**
   * POST /api/users — Create a new admin user (hashed password).
   */
  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`Username "${dto.username}" already exists`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        password: hashedPassword,
        role: dto.role ?? 'admin',
      },
      select: USER_SELECT,
    });
    return user;
  }

  /**
   * PATCH /api/users/:id — Update username / role / reset password.
   */
  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.username !== undefined && dto.username !== user.username) {
      const existing = await this.prisma.user.findUnique({
        where: { username: dto.username },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(`Username "${dto.username}" already exists`);
      }
    }

    // Protect the last superadmin from losing superadmin role.
    if (dto.role !== undefined && dto.role !== user.role && user.role === 'superadmin' && dto.role !== 'superadmin') {
      const superadminCount = await this.prisma.user.count({
        where: { role: 'superadmin' },
      });
      if (superadminCount <= 1) {
        throw new BadRequestException('ไม่สามารถเปลี่ยน role ของ superadmin คนสุดท้ายได้');
      }
    }

    const data: any = {};
    if (dto.username !== undefined) data.username = dto.username;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.password !== undefined) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
    return updated;
  }

  /**
   * DELETE /api/users/:id — Delete a user (only if not self and not last superadmin).
   */
  async remove(id: string, currentUserId: string) {
    if (id === currentUserId) {
      throw new BadRequestException('ไม่สามารถลบบัญชีตัวเองได้');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role === 'superadmin') {
      const superadminCount = await this.prisma.user.count({
        where: { role: 'superadmin' },
      });
      if (superadminCount <= 1) {
        throw new BadRequestException('ไม่สามารถลบ superadmin คนสุดท้ายได้');
      }
    }

    await this.prisma.user.delete({ where: { id } });
    return { success: true };
  }
}
