import {
  ReportReason,
  ReportTargetType
} from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  target_type!: ReportTargetType;

  @IsString()
  target_id!: string;

  @IsEnum(ReportReason)
  reason!: ReportReason;

  @IsOptional()
  @IsString()
  other_description?: string;
}
