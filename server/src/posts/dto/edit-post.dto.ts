import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min
} from 'class-validator';

export class EditPostDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expected_content_version!: number;

  @IsOptional()
  @IsString()
  body_text?: string;

  @IsOptional()
  @IsString()
  emotion_tag_id?: string | null;

  @IsOptional()
  @IsString()
  context_tag_id?: string | null;

  @IsOptional()
  @IsBoolean()
  risk_acknowledged?: boolean;
}
