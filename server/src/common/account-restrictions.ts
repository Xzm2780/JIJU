import { AuthenticatedUser } from '../auth/auth.types';
import { ApiError } from './api-error';

export type RestrictedAction = 'post' | 'comment' | 'reaction';

export function assertActionAllowed(
  user: AuthenticatedUser,
  action: RestrictedAction,
  now = new Date()
): void {
  const until =
    action === 'post'
      ? user.postingRestrictedUntil
      : action === 'comment'
        ? user.commentingRestrictedUntil
        : user.reactionRestrictedUntil;
  if (until && until.getTime() > now.getTime()) {
    throw new ApiError(
      'JIJU_ACCESS_4031',
      403,
      action === 'post'
        ? '账号当前被限制发帖'
        : action === 'comment'
          ? '账号当前被限制评论'
          : '账号当前被限制互动'
    );
  }
}
