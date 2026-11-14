import { HttpStatus } from '@nestjs/common';

export interface PublicApiError {
  code: string;
  status: number;
  message: string;
}

export function mapHttpException(status: number): PublicApiError {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return {
        code: 'JIJU_AUTH_4011',
        status,
        message: '请先登录后继续'
      };
    case HttpStatus.FORBIDDEN:
      return {
        code: 'JIJU_ACCESS_4031',
        status,
        message: '你无权执行此操作'
      };
    case HttpStatus.NOT_FOUND:
      return {
        code: 'JIJU_CONTENT_4041',
        status,
        message: '内容已不可用'
      };
    case HttpStatus.CONFLICT:
      return {
        code: 'JIJU_CONFLICT_4091',
        status,
        message: '内容状态已变化，请刷新后重试'
      };
    case HttpStatus.TOO_MANY_REQUESTS:
      return {
        code: 'JIJU_SYSTEM_5031',
        status,
        message: '操作过于频繁，请稍后重试'
      };
    default:
      return status >= 500
        ? {
            code: 'JIJU_SYSTEM_5031',
            status,
            message: '服务暂时不可用，请稍后重试'
          }
        : {
            code: 'JIJU_VALIDATION_4221',
            status,
            message: '内容不符合要求，请修改后重试'
          };
  }
}
