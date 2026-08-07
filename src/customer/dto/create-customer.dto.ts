import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDto {
  @ApiProperty({ example: 'สมชาย', description: 'ชื่อจริง' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'ใจดี', description: 'นามสกุล' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiProperty({ example: '0812345678', description: 'เบอร์โทรศัพท์' })
  // T140: This field maps to Customer.phone which now has a UNIQUE constraint.
  // Duplicate non-empty phones for active customers will be rejected with HTTP 409.
  // (No new required field is introduced here — validation stays unchanged.)
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phone: string;

  @ApiPropertyOptional({ example: 'somchai@test.com', description: 'อีเมล' })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'ที่อยู่' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: 'Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', description: 'Line User ID' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  lineUserId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-referrer', description: 'UUID ของคนชวน (referrer)' })
  @IsUUID()
  @IsOptional()
  referrerId?: string;

  @ApiPropertyOptional({ example: 'KBANK', description: 'รหัสธนาคาร' })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  bankName?: string;

  @ApiPropertyOptional({ example: 'สมชาย ใจดี', description: 'ชื่อบัญชี' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  bankAccountName?: string;

  @ApiPropertyOptional({ example: '1234567890', description: 'เลขบัญชี' })
  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{9,13}$/, { message: 'เลขบัญชีต้องเป็นตัวเลข 9-13 หลัก' })
  bankAccountNumber?: string;
}
