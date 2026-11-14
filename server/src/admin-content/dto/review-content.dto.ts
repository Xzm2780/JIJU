import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, Min } from 'class-validator';

export enum ReviewDecision {
  PASSED = 'PASSED',
  REJECTED = 'REJECTED'
}

export class ReviewContentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expected_content_version!: number;

  @IsEnum(ReviewDecision)
  decision!: ReviewDecision;

  @IsString()
  reason!: string;
}
