import { IsOptional, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryUserDto {
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

  @ApiPropertyOptional({ example: 'admin', description: 'ค้นหาชื่อผู้ใช้' })
  @IsOptional()
  @IsString()
  q?: string;

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
