import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  authProvider: string;
  plazaNickname: string;
  accountStatus: string;
  postingRestrictedUntil?: Date | null;
  commentingRestrictedUntil?: Date | null;
  reactionRestrictedUntil?: Date | null;
}

export interface AuthenticatedRequest extends Request {
  requestId: string;
  user: AuthenticatedUser;
  authSessionId: string;
}
