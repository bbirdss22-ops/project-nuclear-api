import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BankReviewDto {
  @ApiProperty({ example: 'approve', enum: ['approve', 'reject'], description: 'การตัดสินใจ: อนุมัติหรือไม่อนุมัติ' })
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  @ApiProperty({ example: 'เลขบัญชีไม่ตรงกับบัญชีธนาคาร', required: false, description: 'เหตุผล (บังคับเมื่อ reject)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
