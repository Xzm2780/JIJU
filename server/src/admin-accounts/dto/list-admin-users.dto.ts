import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min
} from 'class-validator';

export enum AdminUserStatus {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  RESTRICTED = 'RESTRICTED',
  DEACTIVATED = 'DEACTIVATED',
  BANNED = 'BANNED',
  DELETED = 'DELETED'
}

export class ListAdminUsersDto {
  @IsOptional()
  @IsEnum(AdminUserStatus)
  status: AdminUserStatus = AdminUserStatus.ALL;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
