import { IsIn, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  plaza_nickname!: string;

  @IsIn(['ROSE', 'SAGE', 'SAND', 'LAVENDER', 'SKY'])
  avatar_color!: string;
}
