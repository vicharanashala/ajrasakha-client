const nodemailer = require('nodemailer');
const {
  isEmailVerificationExempt,
  isEmailVerificationEnabled,
  isEmailVerificationExpired,
} = require('../server/services/AuthService');
const sendEmail = require('../server/utils/sendEmail');

describe('Email Verification & Nodemailer Setup', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'production' };
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
        emailVerifiedAt: new Date(),
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
          expect(resultUser.emailVerifiedAt).toEqual(expect.any(Date));
          expect(info).toBeUndefined();
          expect(mockUpdateUser).toHaveBeenCalledWith('user123', {
            emailVerified: true,
            emailVerifiedAt: expect.any(Date),
          });
          resolve();
        });
      });
    });

    it('should permit login when emailVerified=true and user is already emailVerified within 6 months', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'user123',
        email: 'test@example.com',
        password: 'hashed-password',
        emailVerified: true,
        emailVerifiedAt: new Date(),
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

    it('should reject login and update emailVerified=false when emailVerifiedAt is older than 6 months', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const sevenMonthsAgo = new Date(Date.now() - 7 * 30 * 24 * 60 * 60 * 1000);
      const user = {
        _id: 'user123',
        email: 'farmer@example.com',
        password: 'hashed-password',
        userRole: 'FARMER',
        emailVerified: true,
        emailVerifiedAt: sevenMonthsAgo,
        isVerified: true,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);
      mockUpdateUser.mockResolvedValue({ ...user, emailVerified: false });

      const req = {
        body: { email: 'farmer@example.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'farmer@example.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(info).toBeDefined();
          expect(info.message).toContain('expired');
          expect(mockUpdateUser).toHaveBeenCalledWith('user123', { emailVerified: false });
          resolve();
        });
      });
    });

    it('should exempt and auto-heal RUP accounts when email starts with "rup" and createdFrom is REVIEW_SYSTEM', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'rup_user_1',
        email: 'rup123@example.com',
        createdFrom: 'REVIEW_SYSTEM',
        password: 'hashed-password',
        emailVerified: false,
        isVerified: true,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);
      mockUpdateUser.mockResolvedValue({ ...user, emailVerified: true });

      const req = {
        body: { email: 'rup123@example.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'rup123@example.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(resultUser.emailVerified).toBe(true);
          expect(resultUser.emailVerifiedAt).toEqual(expect.any(Date));
          expect(info).toBeUndefined();
          expect(mockUpdateUser).toHaveBeenCalledWith('rup_user_1', {
            emailVerified: true,
            emailVerifiedAt: expect.any(Date),
          });
          resolve();
        });
      });
    });

    it('should reject external FARMER users when emailVerified=false', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'farmer_user_1',
        email: 'farmer@gmail.com',
        userRole: 'FARMER',
        password: 'hashed-password',
        emailVerified: false,
        isVerified: true,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);

      const req = {
        body: { email: 'farmer@gmail.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'farmer@gmail.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(info).toEqual({
            message: 'Email not verified. Please check your inbox for the verification link.',
          });
          expect(mockUpdateUser).not.toHaveBeenCalled();
          resolve();
        });
      });
    });

    it('should exempt and auto-heal external FARMER users when email starts with "rup" and createdFrom is REVIEW_SYSTEM', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'rup_farmer_1',
        email: 'rup_farmer@example.com',
        userRole: 'FARMER',
        createdFrom: 'REVIEW_SYSTEM',
        password: 'hashed-password',
        emailVerified: false,
        isVerified: true,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);
      mockUpdateUser.mockResolvedValue({ ...user, emailVerified: true });

      const req = {
        body: { email: 'rup_farmer@example.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'rup_farmer@example.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(resultUser.emailVerified).toBe(true);
          expect(resultUser.emailVerifiedAt).toEqual(expect.any(Date));
          expect(info).toBeUndefined();
          expect(mockUpdateUser).toHaveBeenCalledWith('rup_farmer_1', {
            emailVerified: true,
            emailVerifiedAt: expect.any(Date),
          });
          resolve();
        });
      });
    });

    it('should exempt and auto-heal internal users (userRole=INTERNAL) even if emailVerified=false', async () => {
      process.env.emailVerified = 'true';
      const localStrategy = require('../strategies/localStrategy')();

      const user = {
        _id: 'internal_user_1',
        email: 'internal_staff@example.com',
        userRole: 'INTERNAL',
        password: 'hashed-password',
        emailVerified: false,
        isVerified: true,
      };

      mockFindUser.mockResolvedValue(user);
      mockComparePassword.mockResolvedValue(true);
      mockUpdateUser.mockResolvedValue({ ...user, emailVerified: true });

      const req = {
        body: { email: 'internal_staff@example.com', password: 'validPassword123' },
        ip: '127.0.0.1',
      };

      await new Promise((resolve) => {
        localStrategy._verify(req, 'internal_staff@example.com', 'validPassword123', (err, resultUser, info) => {
          expect(err).toBeNull();
          expect(resultUser.emailVerified).toBe(true);
          expect(resultUser.emailVerifiedAt).toEqual(expect.any(Date));
          expect(info).toBeUndefined();
          expect(mockUpdateUser).toHaveBeenCalledWith('internal_user_1', {
            emailVerified: true,
            emailVerifiedAt: expect.any(Date),
          });
          resolve();
        });
      });
    });
  });

  describe('isEmailVerificationExempt (Only Farmers & Coordinators Require Verification, Unless RUP from REVIEW_SYSTEM)', () => {
    it('should return true when email starts with "rup" AND createdFrom is REVIEW_SYSTEM (even for FARMER or coordinators)', () => {
      expect(isEmailVerificationExempt({ email: 'rup123@example.com', userRole: 'FARMER', createdFrom: 'REVIEW_SYSTEM' })).toBe(true);
      expect(isEmailVerificationExempt({ email: 'RUP_pilot@customdomain.org', userRole: 'DISTRICT_COORDINATOR', createdFrom: 'REVIEW_SYSTEM' })).toBe(true);
      expect(isEmailVerificationExempt({ email: 'rup.farmer@anything.io', userRole: 'FARMER', createdFrom: 'review_system' })).toBe(true);
      expect(isEmailVerificationExempt({ email: 'rup99@test.com', userRole: 'INTERNAL', createdFrom: 'REVIEW_SYSTEM' })).toBe(true);
    });

    it('should return false for external roles (FARMER, coordinators) unless email starts with rup and createdFrom is REVIEW_SYSTEM', () => {
      expect(isEmailVerificationExempt('someone@gmail.com', 'FARMER')).toBe(false);
      expect(isEmailVerificationExempt('someone@customcorp.com', 'farmer')).toBe(false);
      expect(isEmailVerificationExempt('lead@anydomain.net', 'district_coordinator')).toBe(false);
      expect(isEmailVerificationExempt('field@domain.org', 'block_coordinator')).toBe(false);
      expect(isEmailVerificationExempt('helper@domain.com', 'village_volunteer')).toBe(false);
      expect(isEmailVerificationExempt({ email: 'rupesh@example.com', userRole: 'FARMER' })).toBe(false);
      expect(isEmailVerificationExempt({ email: 'rup123@example.com', userRole: 'FARMER', createdFrom: undefined })).toBe(false);
      expect(isEmailVerificationExempt({ email: 'rupa@example.com', userRole: 'FARMER', createdFrom: 'WEB_APP' })).toBe(false);
    });

    it('should return true for INTERNAL and other non-farmer/non-coordinator users', () => {
      expect(isEmailVerificationExempt('tester@gmail.com', 'INTERNAL')).toBe(true);
      expect(isEmailVerificationExempt({ email: 'staff@anydomain.com', userRole: 'internal' })).toBe(true);
      expect(isEmailVerificationExempt({ email: 'abiramk0107@gmail.com', userRole: 'INTERNAL' })).toBe(true);
      expect(isEmailVerificationExempt({ email: 'rupesh@example.com', userRole: 'INTERNAL' })).toBe(true);
      expect(isEmailVerificationExempt({ email: 'rup_internal@domain.com', userRole: 'INTERNAL', createdFrom: 'REVIEW_SYSTEM' })).toBe(true);
    });

    it('should not inspect or depend on email domains', () => {
      // Different domains with the same role yield identical exemption status
      expect(isEmailVerificationExempt('farmer@gmail.com', 'FARMER')).toBe(false);
      expect(isEmailVerificationExempt('farmer@annam.ai', 'FARMER')).toBe(false);
      expect(isEmailVerificationExempt('staff@gmail.com', 'INTERNAL')).toBe(true);
      expect(isEmailVerificationExempt('staff@annam.ai', 'INTERNAL')).toBe(true);
    });
  });

  describe('verifyEmail service creates emailVerifiedAt', () => {
    it('should set emailVerified=true and emailVerifiedAt timestamp when token is verified', async () => {
      const bcrypt = require('bcryptjs');

      const mockUser = {
        _id: 'user_verify_123',
        email: 'verify_me@example.com',
        emailVerified: false,
      };

      const plainToken = 'valid-token-123';
      const hashedToken = bcrypt.hashSync(plainToken, 10);

      const mockFindUser = jest.fn().mockResolvedValue(mockUser);
      const mockFindToken = jest.fn().mockResolvedValue({
        userId: 'user_verify_123',
        token: hashedToken,
      });
      const mockUpdateUser = jest.fn().mockResolvedValue({
        ...mockUser,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
      const mockDeleteTokens = jest.fn().mockResolvedValue(true);

      jest.doMock('~/models', () => ({
        findUser: mockFindUser,
        findToken: mockFindToken,
        updateUser: mockUpdateUser,
        deleteTokens: mockDeleteTokens,
      }));

      const { verifyEmail } = require('../server/services/AuthService');

      const req = {
        body: {
          email: 'verify_me@example.com',
          token: plainToken,
        },
      };

      const result = await verifyEmail(req);
      expect(result).toEqual({ message: 'Email verification was successful', status: 'success' });
      expect(mockUpdateUser).toHaveBeenCalledWith('user_verify_123', {
        emailVerified: true,
        emailVerifiedAt: expect.any(Date),
      });
    });

    it('should re-verify and update emailVerifiedAt when user has emailVerified=true but verification has expired (>6 months)', async () => {
      const bcrypt = require('bcryptjs');
      const sevenMonthsAgo = new Date(Date.now() - 210 * 24 * 60 * 60 * 1000);

      const mockExpiredUser = {
        _id: 'user_verify_expired',
        email: 'expired_user@example.com',
        emailVerified: true,
        emailVerifiedAt: sevenMonthsAgo,
      };

      const plainToken = 'valid-token-expired-user';
      const hashedToken = bcrypt.hashSync(plainToken, 10);

      const mockFindUser = jest.fn().mockResolvedValue(mockExpiredUser);
      const mockFindToken = jest.fn().mockResolvedValue({
        userId: 'user_verify_expired',
        token: hashedToken,
      });
      const mockUpdateUser = jest.fn().mockResolvedValue({
        ...mockExpiredUser,
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
      const mockDeleteTokens = jest.fn().mockResolvedValue(true);

      jest.resetModules();
      jest.doMock('~/models', () => ({
        findUser: mockFindUser,
        findToken: mockFindToken,
        updateUser: mockUpdateUser,
        deleteTokens: mockDeleteTokens,
      }));

      const { verifyEmail } = require('../server/services/AuthService');

      const req = {
        body: {
          email: 'expired_user@example.com',
          token: plainToken,
        },
      };

      const result = await verifyEmail(req);
      expect(result).toEqual({ message: 'Email verification was successful', status: 'success' });
      expect(mockUpdateUser).toHaveBeenCalledWith('user_verify_expired', {
        emailVerified: true,
        emailVerifiedAt: expect.any(Date),
      });
    });

    it('should return already verified without checking token when user has emailVerified=true and is NOT expired', async () => {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const mockValidUser = {
        _id: 'user_verify_valid',
        email: 'valid_user@example.com',
        emailVerified: true,
        emailVerifiedAt: oneMonthAgo,
      };

      const mockFindUser = jest.fn().mockResolvedValue(mockValidUser);
      const mockFindToken = jest.fn();
      const mockUpdateUser = jest.fn();

      jest.resetModules();
      jest.doMock('~/models', () => ({
        findUser: mockFindUser,
        findToken: mockFindToken,
        updateUser: mockUpdateUser,
      }));

      const { verifyEmail } = require('../server/services/AuthService');

      const req = {
        body: {
          email: 'valid_user@example.com',
          token: 'some-token',
        },
      };

      const result = await verifyEmail(req);
      expect(result).toEqual({ message: 'Email already verified', status: 'success' });
      expect(mockFindToken).not.toHaveBeenCalled();
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });
  });

  describe('isEmailVerificationExpired (6-Month Rule)', () => {
    it('should return false if verification date is recent (e.g. today or 1 month ago)', () => {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(isEmailVerificationExpired(new Date())).toBe(false);
      expect(isEmailVerificationExpired(oneMonthAgo)).toBe(false);
    });

    it('should return true if verification date is older than 180 days (6 months)', () => {
      const sevenMonthsAgo = new Date(Date.now() - 210 * 24 * 60 * 60 * 1000);
      expect(isEmailVerificationExpired(sevenMonthsAgo)).toBe(true);
    });

    it('should use fallbackDate when emailVerifiedAt is null/undefined', () => {
      const recentDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);

      expect(isEmailVerificationExpired(null, recentDate)).toBe(false);
      expect(isEmailVerificationExpired(undefined, oldDate)).toBe(true);
    });

    it('should return true if neither emailVerifiedAt nor fallbackDate is provided', () => {
      expect(isEmailVerificationExpired(null)).toBe(true);
      expect(isEmailVerificationExpired(undefined)).toBe(true);
    });
  });
});
