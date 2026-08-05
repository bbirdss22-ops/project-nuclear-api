import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import { CustomerService } from './customer.service.js';
import { StorageService } from '../storage/storage.service.js';
import { LineService } from '../line/line.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { BankReviewDto } from './dto/bank-review.dto.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const REUPLOAD_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface AuthUser {
  id: string;
  username: string;
  role: string;
}

@ApiTags('Customer Bank Book')
@Controller('customers')
export class BankController {
  private readonly logger = new Logger(BankController.name);

  constructor(
    private readonly customerService: CustomerService,
    private readonly storageService: StorageService,
    private readonly lineService: LineService,
  ) {}

  private assertMime(mimetype: string): void {
    if (!this.storageService.isAllowedBankBookMime(mimetype)) {
      throw new BadRequestException(
        'รูปแบบไฟล์ไม่ถูกต้อง — รองรับเฉพาะ jpeg/png/webp เท่านั้น',
      );
    }
  }

  /**
   * POST /api/customers/:id/bank-reupload-send — Resend bank re-upload link (admin)
   */
  @Post(':id/bank-reupload-send')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Generate & resend bank re-upload link to customer (admin)' })
  @ApiResponse({ status: 200, description: '{ sent, message }' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async sendReuploadLink(@Param('id', ParseUUIDPipe) id: string) {
    const customer = await this.customerService.findById(id);

    // Customer without Line ID — can't push the link.
    if (!customer.lineUserId) {
      return { sent: false, message: 'ลูกค้าไม่มี Line ID' };
    }

    const { token } = await this.customerService.createReuploadToken(id);
    const frontendUrl =
      this.lineService.frontendUrl || 'https://project-nuclear-web.vercel.app';

    try {
      await this.lineService.pushMessage(
        customer.lineUserId,
        `📤 กรุณาอัปโหลดรูปสมุดบัญชีใหม่ (ภายใน 7 วัน):\n${frontendUrl}/bank-reupload?token=${token}`,
      );
      return { sent: true, message: 'ส่งลิงก์อัปโหลดใหม่แล้ว' };
    } catch (e) {
      this.logger.error(
        `LINE push failed for customer ${id}: ${(e as Error).message}`,
      );
      return { sent: false, message: 'ส่งข้อความ LINE ไม่สำเร็จ' };
    }
  }

  /**
   * POST /api/customers/:id/bank-book — Upload bank book image (public)
   */
  @Post(':id/bank-book')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload bank book image (public)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'รูปสมุดบัญชี (≤5MB, jpeg/png/webp)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Bank book uploaded — customer updated' })
  @ApiResponse({ status: 400, description: 'ไฟล์ไม่ถูกต้อง หรือ bank อนุมัติแล้ว' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async uploadBankBook(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const customer = await this.customerService.findById(id);

    if (customer.bankStatus === 'approved') {
      throw new BadRequestException('บัญชีธนาคารผ่านการตรวจสอบแล้ว ไม่สามารถอัปโหลดซ้ำได้');
    }

    if (!file) {
      throw new BadRequestException('กรุณาอัปโหลดไฟล์รูปสมุดบัญชี');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('ไฟล์ต้องมีขนาดไม่เกิน 5MB');
    }
    this.assertMime(file.mimetype);

    if (!this.storageService.isAvailable) {
      throw new BadRequestException('Storage not configured');
    }

    const path = await this.storageService.uploadBankBook(
      id,
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    const updated = await this.customerService.setBankBookUploaded(
      id,
      path,
      customer.bankStatus === 'none' || customer.bankStatus === 'rejected',
    );

    return updated;
  }

  /**
   * GET /api/customers/:id/bank-book-url — Get signed URL (admin)
   */
  @Get(':id/bank-book-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get bank book signed URL (admin)' })
  @ApiResponse({ status: 200, description: '{ url }' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No bank book uploaded' })
  async getBankBookUrl(@Param('id', ParseUUIDPipe) id: string) {
    const customer = await this.customerService.findById(id);
    if (!customer.bankBookPath) {
      throw new NotFoundException('ยังไม่มีรูปสมุดบัญชี');
    }
    const url = await this.storageService.createSignedUrl(customer.bankBookPath, 300);
    return { url };
  }

  /**
   * POST /api/customers/:id/bank-review — Admin approve/reject (admin)
   */
  @Post(':id/bank-review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'superadmin')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Approve/Reject bank account (admin)' })
  @ApiBody({ type: BankReviewDto })
  @ApiResponse({ status: 200, description: '{ customer, linePushSent }' })
  @ApiResponse({ status: 400, description: 'Invalid action / reason required for reject' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Customer not found' })
  async reviewBank(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BankReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    const customer = await this.customerService.findById(id);

    if (dto.action === 'reject') {
      const reason = (dto.reason ?? '').trim();
      if (!reason) {
        throw new BadRequestException('กรุณาระบุเหตุผลเมื่อไม่อนุมัติ');
      }
    }

    const token = dto.action === 'reject'
      ? randomBytes(24).toString('hex')
      : null;
    const expiresAt = dto.action === 'reject'
      ? new Date(Date.now() + REUPLOAD_WINDOW_MS)
      : null;

    const updated = await this.customerService.setBankReviewed(
      id,
      dto.action,
      dto.action === 'reject' ? (dto.reason ?? '').trim() : null,
      user.id,
      token,
      expiresAt,
    );

    // LINE notification
    let linePushSent = false;
    if (updated.lineUserId) {
      try {
        if (dto.action === 'approve') {
          await this.lineService.pushMessage(
            updated.lineUserId,
            '✅ ข้อมูลบัญชีธนาคารของคุณผ่านการตรวจสอบแล้ว\nขอบคุณที่ไว้วางใจ 🌿',
          );
        } else {
          const frontendUrl =
            this.lineService.frontendUrl || 'https://project-nuclear-web.vercel.app';
          await this.lineService.pushMessage(
            updated.lineUserId,
            `❌ ข้อมูลบัญชีธนาคารไม่ผ่านการตรวจสอบ\nเหตุผล: ${dto.reason}\nกรุณาอัปโหลดใหม่ภายใน 7 วัน:\n${frontendUrl}/bank-reupload?token=${token}`,
          );
        }
        linePushSent = true;
      } catch (e) {
        this.logger.error(
          `LINE push failed for customer ${id}: ${(e as Error).message}`,
        );
      }
    } else {
      this.logger.warn(
        `Customer ${id} has no lineUserId — skipped LINE bank review notification`,
      );
    }

    return { customer: updated, linePushSent };
  }
}

@ApiTags('Bank Re-upload')
@Controller('bank-reupload')
export class BankReuploadController {
  private readonly logger = new Logger(BankReuploadController.name);

  constructor(
    private readonly customerService: CustomerService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * GET /api/bank-reupload/validate?token=... — Validate re-upload token (public)
   */
  @Get('validate')
  @ApiOperation({ summary: 'Validate bank re-upload token (public)' })
  @ApiQuery({ name: 'token', required: true, description: 'Re-upload token จาก LINE' })
  @ApiResponse({ status: 200, description: '{ valid, customer? }' })
  async validate(@Query('token') token?: string) {
    if (!token) {
      return { valid: false, message: 'ไม่พบ token' };
    }
    const result = await this.customerService.validateReuploadToken(token);
    if (!result) {
      return { valid: false, message: 'token ไม่ถูกต้องหรือหมดอายุ' };
    }
    return {
      valid: true,
      customer: {
        id: result.id,
        bankName: result.bankName,
        bankAccountName: result.bankAccountName,
        bankRejectReason: result.bankRejectReason,
        bankStatus: result.bankStatus,
      },
    };
  }

  /**
   * POST /api/bank-reupload — Re-upload bank book via token (public)
   */
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Re-upload bank book via token (public)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        token: { type: 'string', description: 'Re-upload token จาก LINE' },
        file: { type: 'string', format: 'binary', description: 'รูปสมุดบัญชีใหม่ (≤5MB, jpeg/png/webp)' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Bank book re-uploaded' })
  @ApiResponse({ status: 400, description: 'ไฟล์/token ไม่ถูกต้อง' })
  async reupload(
    @Body('token') token: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const valid = await this.customerService.validateReuploadToken(token);
    if (!valid) {
      throw new BadRequestException('token ไม่ถูกต้องหรือหมดอายุ');
    }

    if (!file) {
      throw new BadRequestException('กรุณาอัปโหลดไฟล์รูปสมุดบัญชี');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('ไฟล์ต้องมีขนาดไม่เกิน 5MB');
    }
    if (!this.storageService.isAllowedBankBookMime(file.mimetype)) {
      throw new BadRequestException('รูปแบบไฟล์ไม่ถูกต้อง — รองรับเฉพาะ jpeg/png/webp เท่านั้น');
    }
    if (!this.storageService.isAvailable) {
      throw new BadRequestException('Storage not configured');
    }

    const path = await this.storageService.uploadBankBook(
      valid.id,
      file.buffer,
      file.mimetype,
      file.originalname,
    );

    const result = await this.customerService.consumeReuploadToken(valid.id, path);
    return result;
  }
}
