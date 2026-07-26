import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  MaxLength,
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
}
