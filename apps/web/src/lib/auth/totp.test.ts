import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateSync } from 'otplib';
import {
  encryptTotpSecret,
  decryptTotpSecret,
  generateBase32Secret,
  generateTotpUri,
  verifyTotpToken,
  hashBackupCode,
  generateTotpSecret,
} from './totp';

describe('TOTP and Secret Encryption', () => {
  const originalJwtSecret = process.env.JWT_SECRET_KEY;

  beforeEach(() => {
    process.env.JWT_SECRET_KEY = 'test-jwt-secret-key-for-totp';
  });

  afterEach(() => {
    if (originalJwtSecret !== undefined) {
      process.env.JWT_SECRET_KEY = originalJwtSecret;
    } else {
      delete process.env.JWT_SECRET_KEY;
    }
  });

  describe('secret encryption and decryption', () => {
    it('round-trips encryptTotpSecret and decryptTotpSecret successfully', () => {
      const secret = generateBase32Secret();
      const encrypted = encryptTotpSecret(secret);
      expect(encrypted).not.toBe(secret);
      expect(encrypted.startsWith('v1:')).toBe(true);

      const decrypted = decryptTotpSecret(encrypted);
      expect(decrypted).toBe(secret);
    });

    it('throws when decrypting tampered ciphertext or modified GCM tag', () => {
      const secret = generateBase32Secret();
      const encrypted = encryptTotpSecret(secret);

      // Tamper with a byte of the ciphertext / tag
      const parts = encrypted.split(':');
      // parts[2] is the auth tag, parts[3] is ciphertext
      const tamperedTag =
        parts[2].slice(0, 4) + (parts[2][4] === 'A' ? 'B' : 'A') + parts[2].slice(5);
      const tampered = `v1:${parts[1]}:${tamperedTag}:${parts[3]}`;

      expect(() => decryptTotpSecret(tampered)).toThrow();
    });

    it('throws on unrecognised format', () => {
      expect(() => decryptTotpSecret('v2:invalid:format')).toThrow(
        'Unrecognised TOTP secret format',
      );
    });
  });

  describe('base32 decoding and validation', () => {
    it('verifies generateTotpSecret produces a known valid base32 secret and verifies correctly', () => {
      const enrollment = generateTotpSecret('test@accensa.io', 'Accensa');
      expect(enrollment.secret).toBeTruthy();
      expect(enrollment.uri).toContain('otpauth://totp/');

      // Pinned time step verification
      const now = 1700000000000;
      const epochSeconds = Math.floor(now / 1000);
      const token = generateSync(enrollment.secret, { epoch: epochSeconds });
      expect(verifyTotpToken(token, enrollment.secret, now)).toBe(true);

      const code = verifyTotpToken('', enrollment.secret, now); // empty code returns false
      expect(code).toBe(false);
    });

    it('verifyTotpToken returns false without throwing for an invalid base32 secret', () => {
      const res = verifyTotpToken('123456', 'INVALID_BASE32_@#$%', Date.now());
      expect(res).toBe(false);
    });
  });

  describe('verifyTotpToken drift and windows', () => {
    it('accepts current step, step - 1, and step + 1 codes, and rejects outside drift', () => {
      const secret = generateBase32Secret();
      const baseTime = 1700000000000;
      const stepMs = 30_000;

      const baseEpoch = Math.floor(baseTime / 1000);
      const codeCurrent = generateSync(secret, { epoch: baseEpoch });
      const codePast = generateSync(secret, { epoch: baseEpoch - 30 });
      const codeFuture = generateSync(secret, { epoch: baseEpoch + 30 });
      const codeFar = generateSync(secret, { epoch: baseEpoch + 60 });

      expect(verifyTotpToken('12345', secret, baseTime)).toBe(false);
      expect(verifyTotpToken('1234567', secret, baseTime)).toBe(false);

      expect(verifyTotpToken(codeCurrent, secret, baseTime)).toBe(true);
      expect(verifyTotpToken(codePast, secret, baseTime)).toBe(true);
      expect(verifyTotpToken(codeFuture, secret, baseTime)).toBe(true);
      expect(verifyTotpToken(codeFar, secret, baseTime)).toBe(false);
    });
  });

  describe('generateTotpUri', () => {
    it('embeds issuer, userEmail, secret, and period correctly in otpauth:// URI', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const email = 'merchant@accensa.io';
      const issuer = 'AccensaTest';

      const uri = generateTotpUri(secret, email, issuer);

      expect(uri).toContain('otpauth://totp/');
      expect(uri).toContain(encodeURIComponent(`${issuer}:${email}`));
      expect(uri).toContain(`secret=${secret}`);
      expect(uri).toContain(`issuer=${encodeURIComponent(issuer)}`);
      expect(uri).toContain('algorithm=SHA1');
      expect(uri).toContain('digits=6');
      expect(uri).toContain('period=30');
    });
  });

  describe('hashBackupCode', () => {
    it('is stable across case and surrounding whitespace', () => {
      const code = 'abcd-1234';
      const hash1 = hashBackupCode(code);
      const hash2 = hashBackupCode('  ABCD-1234  \n');
      const hash3 = hashBackupCode('abcd-1234');

      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hash3);
      expect(hash1).toHaveLength(64); // SHA-256 hex digest length
    });
  });
});
