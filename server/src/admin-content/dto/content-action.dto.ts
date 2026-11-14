import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsString, Min } from 'class-validator';

export enum ContentAction {
  HIDE = 'HIDE',
  TAKEDOWN = 'TAKEDOWN',
  RESTORE = 'RESTORE'
}

export class ContentActionDto {
  @IsEnum(ContentAction)
  action!: ContentAction;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  expected_content_version!: number;

  @IsString()
  reason!: string;
}
