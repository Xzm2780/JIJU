import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class WechatLoginDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsOptional()
  @IsBoolean()
  restore_deleted_account?: boolean;
}
