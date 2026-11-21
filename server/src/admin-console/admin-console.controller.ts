import { Controller, Get, Header } from '@nestjs/common';
import { ADMIN_PROCESS_HTML } from './admin-process.page';
import { ADMIN_CONSOLE_HTML } from './admin-console.page';

@Controller('admin-console')
export class AdminConsoleController {
  @Get()
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'no-store, max-age=0')
  @Header(
    'content-security-policy',
    "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:"
  )
  page(): string {
    return ADMIN_CONSOLE_HTML;
  }

  @Get('process')
  @Header('content-type', 'text/html; charset=utf-8')
  @Header('cache-control', 'no-store, max-age=0')
  @Header(
    'content-security-policy',
    "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:"
  )
  processPage(): string {
    return ADMIN_PROCESS_HTML;
  }
}
