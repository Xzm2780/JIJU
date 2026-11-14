import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum AccountAction {
  WARNING = 'WARNING',
  POST_LIMIT = 'POST_LIMIT',
  COMMENT_LIMIT = 'COMMENT_LIMIT',
  REACTION_LIMIT = 'REACTION_LIMIT',
  BAN = 'BAN'
}

export class RestrictAccountDto {
  @IsEnum(AccountAction)
  action!: AccountAction;

  @IsOptional()
  @IsDateString()
  expires_at?: string | null;

  @IsString()
  reason!: string;
}
