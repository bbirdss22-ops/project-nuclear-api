import {
  IsString,
  IsOptional,
  IsIn,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'admin2', description: 'ชื่อผู้ใช้' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'ชื่อผู้ใช้ต้องเป็นตัวอักษร ตัวเลข _ . - เท่านั้น',
  })
  username?: string;

  @ApiPropertyOptional({ example: 'superadmin', description: 'บทบาท' })
  @IsOptional()
  @IsString()
  @IsIn(['admin', 'superadmin'])
  role?: string;

  @ApiPropertyOptional({ example: 'newsecret123', description: 'ตั้งรหัสผ่านใหม่ (reset password)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password?: string;
}
