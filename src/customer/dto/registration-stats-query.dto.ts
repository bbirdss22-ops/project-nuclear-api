import { IsOptional, IsString, IsIn, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RegistrationStatsQueryDto {
  @ApiPropertyOptional({
    example: 'daily',
    enum: ['daily', 'monthly', 'yearly'],
    description: 'ช่วงเวลาการรวมกลุ่ม',
  })
  @IsOptional()
  @IsIn(['daily', 'monthly', 'yearly'])
  period?: 'daily' | 'monthly' | 'yearly' = 'daily';

  @ApiPropertyOptional({
    example: '2026-01-01',
    description: 'วันที่เริ่มต้น (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'from ต้องเป็นรูปแบบ YYYY-MM-DD',
  })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    description: 'วันที่สิ้นสุด (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'to ต้องเป็นรูปแบบ YYYY-MM-DD',
  })
  to?: string;
}
