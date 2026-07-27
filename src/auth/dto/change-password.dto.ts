import { IsString, IsNotEmpty, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: '***', description: 'รหัสผ่านปัจจุบัน' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ example: '***', description: 'รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  newPassword!: string;
}
