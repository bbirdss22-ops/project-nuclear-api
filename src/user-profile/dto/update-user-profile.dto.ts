import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserProfileDto {
  @ApiPropertyOptional({ example: 'John Admin', description: 'ชื่อที่แสดง' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ example: 'admin@project-nuclear.com', description: 'อีเมล' })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '081-234-5678', description: 'เบอร์โทร' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg', description: 'URL รูปโปรไฟล์' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'Senior admin of Project Nuclear', description: 'คำอธิบายสั้นๆ' })
  @IsString()
  @IsOptional()
  bio?: string;
}
