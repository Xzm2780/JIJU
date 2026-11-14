import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum MyPostStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  HIDDEN = 'HIDDEN'
}

export class ListMyPostsQueryDto {
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
  @IsEnum(MyPostStatus)
  status?: MyPostStatus;
}
