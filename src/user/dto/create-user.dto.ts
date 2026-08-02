import {
  IsString,
  IsNotEmpty,
  IsIn,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'admin1', description: 'ชื่อผู้ใช้' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_.-]+$/, {
    message: 'ชื่อผู้ใช้ต้องเป็นตัวอักษร ตัวเลข _ . - เท่านั้น',
  })
  username: string;

  @ApiProperty({ example: 'secret123', description: 'รหัสผ่าน (อย่างน้อย 8 ตัว)' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  password: string;

  @ApiPropertyOptional({ example: 'admin', description: 'บทบาท', default: 'admin' })
  @IsOptional()
  @IsIn(['admin', 'superadmin'])
  role?: string = 'admin';
}
