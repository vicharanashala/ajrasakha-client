const nodemailer = require('nodemailer');
const { isEmailVerificationEnabled } = require('@librechat/api');
const sendEmail = require('../server/utils/sendEmail');

describe('Email Verification & Nodemailer Setup', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isEmailVerificationEnabled', () => {
    it('should return true when process.env.emailVerified is "true"', () => {
      process.env.emailVerified = 'true';
      expect(isEmailVerificationEnabled()).toBe(true);
    });

    it('should return true case-insensitively with whitespace', () => {
      process.env.emailVerified = ' TRUE ';
      expect(isEmailVerificationEnabled()).toBe(true);
    });

    it('should return false when process.env.emailVerified is "false"', () => {
      process.env.emailVerified = 'false';
      expect(isEmailVerificationEnabled()).toBe(false);
    });

    it('should return false when process.env.emailVerified is not set', () => {
      delete process.env.emailVerified;
      delete process.env.EMAIL_VERIFIED;
      expect(isEmailVerificationEnabled()).toBe(false);
    });

    it('should check process.env.EMAIL_VERIFIED as fallback', () => {
      delete process.env.emailVerified;
      process.env.EMAIL_VERIFIED = 'true';
      expect(isEmailVerificationEnabled()).toBe(true);
    });
  });

  describe('Nodemailer configuration via getTransporterOptions', () => {
    it('should properly configure SMTP options for port 587 with STARTTLS', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_PORT = '587';
      process.env.EMAIL_ENCRYPTION = 'starttls';
      process.env.EMAIL_USERNAME = 'user@example.com';
      process.env.EMAIL_PASSWORD = 'password123';
      delete process.env.EMAIL_SERVICE;

      const opts = sendEmail.getTransporterOptions();
      expect(opts.host).toBe('smtp.example.com');
      expect(opts.port).toBe(587);
      expect(opts.secure).toBe(false);
      expect(opts.requireTls).toBe(true);
      expect(opts.auth).toEqual({
        user: 'user@example.com',
        pass: 'password123',
      });
    });

    it('should properly configure secure=true for port 465 (SSL/TLS)', () => {
      process.env.EMAIL_HOST = 'smtp.example.com';
      process.env.EMAIL_PORT = '465';
      process.env.EMAIL_USERNAME = 'user@example.com';
      process.env.EMAIL_PASSWORD = 'password123';
      delete process.env.EMAIL_SERVICE;
      delete process.env.EMAIL_ENCRYPTION;

      const opts = sendEmail.getTransporterOptions();
      expect(opts.port).toBe(465);
      expect(opts.secure).toBe(true);
    });

    it('should prioritize EMAIL_SERVICE when defined', () => {
      process.env.EMAIL_SERVICE = 'gmail';
      process.env.EMAIL_USERNAME = 'test@gmail.com';
      process.env.EMAIL_PASSWORD = 'app-password';

      const opts = sendEmail.getTransporterOptions();
      expect(opts.service).toBe('gmail');
      expect(opts.auth).toEqual({
        user: 'test@gmail.com',
        pass: 'app-password',
      });
    });

    it('should call transporter.verify when verifyMailConnection is executed', async () => {
      const mockVerify = jest.fn().mockResolvedValue(true);
      jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
        verify: mockVerify,
      });

      const result = await sendEmail.verifyMailConnection();
      expect(mockVerify).toHaveBeenCalled();
      expect(result.success).toBe(true);
      nodemailer.createTransport.mockRestore();
    });
  });

  describe('LocalStrategy authentication email verification enforcement', () => {
    let mockFindUser;
    let mockComparePassword;
    let mockUpdateUser;

    beforeEach(() => {
      mockFindUser = jest.fn();
      mockComparePassword = jest.fn();
      mockUpdateUser = jest.fn();

      jest.doMock('~/models', () => ({
        findUser: mockFindUser,
        comparePassword: mockComparePassword,
        updateUser: mockUpdateUser,
      }));
    });

    it('should reject login with "Email not verified. Please check your inbox for the verification link." when emailVerified=true and user.emailVerified is false', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed-password',
        emailVerified: false,
        isVerified: true,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);

      const req = {
        body: { email: 'test@example.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'test@example.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(resultUser).toEqual(user);
          expect(info).toEqual({
            message: 'Email not verified. Please check your inbox for the verification link.',
          });
          expect(mockUpdateUser).not.toHaveBeenCalled();
          resolve();
        });
      });
    });

    it('should prioritize email verification message over admin verification when both emailVerified=false and isVerified=false', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed-password',
        emailVerified: false,
        isVerified: false,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);

      const req = {
        body: { email: 'test@example.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'test@example.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(resultUser).toEqual(user);
          expect(info).toEqual({
            message: 'Email not verified. Please check your inbox for the verification link.',
          });
          resolve();
        });
      });
    });

    it('should reject with admin verification message only after email is verified (emailVerified=true and isVerified=false)', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed-password',
        emailVerified: true,
        isVerified: false,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);

      const req = {
        body: { email: 'test@example.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'test@example.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(resultUser).toEqual(user);
          expect(info).toEqual({
            message:
              'Your account is currently under verification by the administrator. Please contact the admin for approval.',
          });
          resolve();
        });
      });
    });

    it('should auto-verify user and permit login when emailVerified=false even if user.emailVerified is false', async () => {
      process.env.emailVerified = 'false';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed-password',
        emailVerified: false,
        isVerified: true,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);
      mockUpdateUser.mockResolvedValue({ ...user, emailVerified: true });

      const req = {
        body: { email: 'test@example.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'test@example.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(resultUser.emailVerified).toBe(true);
          expect(info).toBeUndefined();
          expect(mockUpdateUser).toHaveBeenCalledWith('user123', { emailVerified: true });
          resolve();
        });
      });
    });

    it('should permit login when emailVerified=true and user is already emailVerified', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed-password',
        emailVerified: true,
        isVerified: true,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);

      const req = {
        body: { email: 'test@example.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'test@example.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(resultUser).toEqual(user);
          expect(info).toBeUndefined();
          expect(mockUpdateUser).not.toHaveBeenCalled();
          resolve();
        });
      });
    });
  });
});
