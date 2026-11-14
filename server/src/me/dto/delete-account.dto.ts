import { IsIn, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @IsIn(['注销账号'])
  confirmation_text!: string;
}
