import 'reflect-metadata';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';

describe('AuthController contract', () => {
  it('returns the documented 200 response for WeChat login', () => {
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.login)
    ).toBe(200);
  });

  it('keeps logout idempotently documented as 204', () => {
    expect(
      Reflect.getMetadata(HTTP_CODE_METADATA, AuthController.prototype.logout)
    ).toBe(204);
  });
});
