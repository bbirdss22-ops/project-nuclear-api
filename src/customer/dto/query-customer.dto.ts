import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryCustomerDto {
  @ApiPropertyOptional({ example: 1, description: 'หน้าปัจจุบัน' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'จำนวนต่อหน้า (แทนที่ limit)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({ example: 20, description: '[Deprecated] จำนวนต่อหน้า — ใช้ pageSize แทน' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'สมชาย', description: 'คำค้นหา (ชื่อ/เบอร์/email)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 'pending', description: 'กรองตามสถานะ bank (none|pending|approved|rejected)' })
  @IsOptional()
  @IsIn(['none', 'pending', 'approved', 'rejected'])
  bankStatus?: string;

  /**
   * Resolve effective page size:
   * - pageSize takes priority
   * - fallback to limit (backward compatible)
   * - default 20
   */
  get effectivePageSize(): number {
    if (this.pageSize !== undefined) return this.pageSize;
    if (this.limit !== undefined) return this.limit;
    return 20;
  }
}
