import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt } from 'node:crypto';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const COST = 2 ** 12; // approximates bcrypt 12-round cost factor

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: COST }, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey);
    });
  });
}

/**
 * Approximates bcrypt(12) strength using Node's built-in scrypt so we avoid
 * native dependencies inside the container.
 */
@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const result = await scryptAsync(password, salt);
    return `${salt.toString('hex')}:${result.toString('hex')}`;
  }

  async compare(password: string, stored: string): Promise<boolean> {
    const [saltHex, hashHex] = stored.split(':');
    if (!saltHex || !hashHex) {
      return false;
    }
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = await scryptAsync(password, salt);
    return expected.equals(actual);
  }
}
