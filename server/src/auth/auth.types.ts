import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  loginCode: string;
  plazaNickname: string;
  accountStatus: string;
}

export interface AuthenticatedRequest extends Request {
  requestId: string;
  user: AuthenticatedUser;
  authSessionId: string;
}
