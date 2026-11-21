import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ReviewQueueSource {
  MODERATION = 'moderation',
  REPORT = 'report',
  ALL = 'all'
}

export class ListReviewQueueDto {
  @IsOptional()
  @IsEnum(ReviewQueueSource)
  source?: ReviewQueueSource = ReviewQueueSource.ALL;

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
