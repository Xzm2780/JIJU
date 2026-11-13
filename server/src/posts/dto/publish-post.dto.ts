import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString
} from 'class-validator';

export class PublishPostDto {
  @IsString()
  body_text!: string;

  @IsOptional()
  @IsString()
  emotion_tag_id?: string | null;

  @IsOptional()
  @IsString()
  context_tag_id?: string | null;

  @IsInt()
  @IsIn([24, 72, 168])
  retention_hours!: number;

  @IsOptional()
  @IsBoolean()
  risk_acknowledged?: boolean;

  @IsOptional()
  @IsString()
  risk_challenge_id?: string;
}
