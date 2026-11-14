import {
  ModerationPriority,
  ReportReason,
  ReportStatus
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';

export class ListAdminReportsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ModerationPriority)
  priority?: ModerationPriority;

  @IsOptional()
  @IsEnum(ReportReason)
  reason?: ReportReason;
}
