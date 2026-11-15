import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export enum AdminContentType {
  POST = 'POST',
  COMMENT = 'COMMENT'
}

export enum AdminContentStatus {
  ALL = 'ALL',
  ACTIVE = 'ACTIVE',
  HIDDEN = 'HIDDEN',
  EXPIRED = 'EXPIRED',
  DELETED = 'DELETED',
  PENDING_REVIEW = 'PENDING_REVIEW'
}

export class ListAdminContentDto {
  @IsOptional()
  @IsEnum(AdminContentType)
  target_type: AdminContentType = AdminContentType.POST;

  @IsOptional()
  @IsEnum(AdminContentStatus)
  status: AdminContentStatus = AdminContentStatus.ALL;

  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}
