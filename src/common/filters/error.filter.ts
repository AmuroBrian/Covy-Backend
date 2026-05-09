import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import * as fs from 'fs';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    const log = `[${new Date().toISOString()}] ${request.method} ${request.url} - Status: ${status} - Error: ${exception instanceof Error ? exception.message : JSON.stringify(exception)}\n`;
    fs.appendFileSync('error_debug.log', log);

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: exception instanceof Error ? exception.message : 'Internal server error',
    });
  }
}
