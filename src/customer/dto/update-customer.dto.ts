import {
  IsString,
  IsOptional,
  IsEmail,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'สมชาย', description: 'ชื่อจริง' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'ใจดี', description: 'นามสกุล' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '0898765432', description: 'เบอร์โทรศัพท์' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'newemail@test.com', description: 'อีเมล' })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ description: 'ที่อยู่' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ description: 'Line User ID' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  lineUserId?: string;

  @ApiPropertyOptional({ description: 'UUID ของคนชวน (referrer)' })
  @IsUUID()
  @IsOptional()
  referrerId?: string;
}
