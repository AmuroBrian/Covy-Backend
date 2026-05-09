import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionInterceptor implements NestInterceptor {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly authTagLength = 16;

  private getKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY || '';
    if (key.length !== this.keyLength) {
      throw new Error(`ENCRYPTION_KEY must be exactly ${this.keyLength} characters long.`);
    }
    return Buffer.from(key, 'utf-8');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const isEncrypted = request.headers['x-encrypted-payload'] === 'true';

    // 1. Decrypt incoming payload
    if (isEncrypted && request.body && request.body.payload) {
      try {
        const decryptedBody = this.decrypt(request.body.payload);
        request.body = JSON.parse(decryptedBody);
      } catch (error) {
        throw new BadRequestException('Failed to decrypt payload');
      }
    }

    // 2. Encrypt outgoing response
    return next.handle().pipe(
      map((data) => {
        // If the client requested encryption, encrypt the response
        if (isEncrypted) {
          const jsonString = JSON.stringify(data);
          const encryptedResponse = this.encrypt(jsonString);
          return { encryptedData: encryptedResponse };
        }
        return data; // Return raw data if not encrypted
      }),
    );
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, this.getKey(), iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag().toString('base64');
    const ivBase64 = iv.toString('base64');

    // Format: iv:ciphertext:authTag
    // Note: Node crypto separates the Auth Tag. WebCrypto appends it to ciphertext.
    // To match WebCrypto behavior, we concatenate them. WebCrypto appends the auth tag raw bytes.
    // For simplicity, we just send standard iv:ciphertext where ciphertext includes auth tag bytes.
    
    // Better compatibility with WebCrypto AES-GCM:
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const authTagBuffer = Buffer.from(authTag, 'base64');
    const combinedCiphertext = Buffer.concat([encryptedBuffer, authTagBuffer]).toString('base64');

    return `${ivBase64}:${combinedCiphertext}`;
  }

  private decrypt(encryptedData: string): string {
    const parts = encryptedData.split(':');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid encrypted payload format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const combinedCiphertext = Buffer.from(parts[1], 'base64');

    // Extract auth tag from the end of the combined ciphertext
    const ciphertextLength = combinedCiphertext.length - this.authTagLength;
    const ciphertext = combinedCiphertext.subarray(0, ciphertextLength);
    const authTag = combinedCiphertext.subarray(ciphertextLength);

    const decipher = crypto.createDecipheriv(this.algorithm, this.getKey(), iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
