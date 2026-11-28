const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const {
  isSessionRecoveryEligible,
  generateSessionRecoveryTempToken,
  verifySessionRecoveryTempToken,
  generateSessionRecoveryToken,
  requestSessionRecovery,
  verifySessionRecovery,
} = require('./SessionRecoveryService');

// Mock dependencies
jest.mock('~/models', () => ({
  createToken: jest.fn(),
  deleteTokens: jest.fn(),
  findToken: jest.fn(),
  findUser: jest.fn(),
  deleteAllUserSessions: jest.fn(),
}));

jest.mock('~/server/services/AuthService', () => ({
  setAuthTokens: jest.fn(),
}));

jest.mock('@librechat/api', () => ({
  checkEmailConfig: jest.fn(() => true),
}));

jest.mock('~/server/utils', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const { createToken, deleteTokens, findUser, deleteAllUserSessions } = require('~/models');
const { setAuthTokens } = require('~/server/services/AuthService');
const { sendEmail } = require('~/server/utils');
const { checkEmailConfig } = require('@librechat/api');

describe('SessionRecoveryService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-key-12345',
      DOMAIN_CLIENT: 'http://localhost:3080',
      APP_TITLE: 'Ajrasakha Test',
    };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isSessionRecoveryEligible', () => {
    it('should return false for null or undefined user', () => {
      expect(isSessionRecoveryEligible(null)).toBe(false);
      expect(isSessionRecoveryEligible(undefined)).toBe(false);
    });

    it('should return true for eligible roles (farmer, district_coordinator, block_coordinator, village_volunteer)', () => {
      const eligibleRoles = [
        'farmer',
        'district_coordinator',
        'block_coordinator',
        'village_volunteer',
      ];

      eligibleRoles.forEach((role) => {
        expect(
          isSessionRecoveryEligible({
            userRole: role,
            email: 'test@example.com',
          }),
        ).toBe(true);

        // Also check uppercase
        expect(
          isSessionRecoveryEligible({
            userRole: role.toUpperCase(),
            email: 'test@example.com',
          }),
        ).toBe(true);

        // Also check role property fallback
        expect(
          isSessionRecoveryEligible({
            role: role,
            email: 'test@example.com',
          }),
        ).toBe(true);
      });
    });

    it('should return false for ineligible roles (admin, user, internal, etc.)', () => {
      const ineligibleRoles = ['admin', 'user', 'internal', 'superadmin', 'guest'];

      ineligibleRoles.forEach((role) => {
        expect(
          isSessionRecoveryEligible({
            userRole: role,
            email: 'test@example.com',
          }),
        ).toBe(false);
      });
    });

    describe('Exclusion Rule: email starts with "rup" AND createdFrom is "REVIEW_SYSTEM"', () => {
      it('should exclude users whose email starts with "rup" and createdFrom is "REVIEW_SYSTEM" (case-insensitive)', () => {
        const user = {
          userRole: 'farmer',
          email: 'rup123@example.com',
          createdFrom: 'REVIEW_SYSTEM',
        };
        expect(isSessionRecoveryEligible(user)).toBe(false);

        // Case variations
        expect(
          isSessionRecoveryEligible({
            userRole: 'FARMER',
            email: 'RUPAL@test.com',
            createdFrom: 'review_system',
          }),
        ).toBe(false);

        expect(
          isSessionRecoveryEligible({
            userRole: 'district_coordinator',
            email: 'rup.sharma@domain.org',
            createdFrom: 'REVIEW_SYSTEM',
          }),
        ).toBe(false);
      });

      it('should NOT exclude users whose email starts with "rup" if createdFrom is NOT "REVIEW_SYSTEM"', () => {
        const user = {
          userRole: 'farmer',
          email: 'rup123@example.com',
          createdFrom: 'WEB',
        };
        expect(isSessionRecoveryEligible(user)).toBe(true);

        const userNoCreatedFrom = {
          userRole: 'farmer',
          email: 'rup123@example.com',
        };
        expect(isSessionRecoveryEligible(userNoCreatedFrom)).toBe(true);
      });

      it('should NOT exclude users whose createdFrom is "REVIEW_SYSTEM" if email does NOT start with "rup"', () => {
        const user = {
          userRole: 'farmer',
          email: 'farmer.john@example.com',
          createdFrom: 'REVIEW_SYSTEM',
        };
        expect(isSessionRecoveryEligible(user)).toBe(true);
      });
    });
  });

  describe('JWT temp token generation & verification', () => {
    it('should generate and verify a valid session recovery temp token', () => {
      const userId = '507f1f77bcf86cd799439011';
      const email = 'farmer@example.com';

      const token = generateSessionRecoveryTempToken(userId, email);
      expect(typeof token).toBe('string');

      const payload = verifySessionRecoveryTempToken(token);
      expect(payload.userId).toBe(userId);
      expect(payload.email).toBe(email);
      expect(payload.sessionRecoveryPending).toBe(true);
    });

    it('should throw when verifying an invalid token', () => {
      expect(() => verifySessionRecoveryTempToken('invalid.token.here')).toThrow();
    });
  });

  describe('generateSessionRecoveryToken', () => {
    it('should return a 64-character hex rawToken and a valid bcrypt hash', () => {
      const [rawToken, hash] = generateSessionRecoveryToken();

      expect(typeof rawToken).toBe('string');
      expect(rawToken).toHaveLength(64);

      expect(typeof hash).toBe('string');
      expect(bcrypt.compareSync(rawToken, hash)).toBe(true);
      expect(bcrypt.compareSync('different-token', hash)).toBe(false);
    });
  });

  describe('requestSessionRecovery', () => {
    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      name: 'Ramesh Farmer',
      email: 'ramesh@example.com',
      userRole: 'farmer',
    };

    it('should reject ineligible users with an error', async () => {
      const ineligibleUser = {
        _id: '507f1f77bcf86cd799439012',
        email: 'rup@example.com',
        createdFrom: 'REVIEW_SYSTEM',
        userRole: 'farmer',
      };

      await expect(requestSessionRecovery(ineligibleUser)).rejects.toThrow(
        'User is not eligible for email-based session recovery',
      );
      expect(createToken).not.toHaveBeenCalled();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should delete existing session recovery tokens, create a new token, and send email', async () => {
      checkEmailConfig.mockReturnValue(true);

      const result = await requestSessionRecovery(mockUser);

      // Verify old tokens invalidated
      expect(deleteTokens).toHaveBeenCalledWith({
        userId: mockUser._id,
        type: 'session_recovery',
      });

      // Verify token created
      expect(createToken).toHaveBeenCalledTimes(1);
      const tokenArg = createToken.mock.calls[0][0];
      expect(tokenArg.userId).toBe(mockUser._id);
      expect(tokenArg.email).toBe(mockUser.email);
      expect(tokenArg.type).toBe('session_recovery');
      expect(tokenArg.expiresIn).toBe(900);
      expect(typeof tokenArg.token).toBe('string');

      // Verify email sent with secure link
      expect(sendEmail).toHaveBeenCalledTimes(1);
      const emailArg = sendEmail.mock.calls[0][0];
      expect(emailArg.email).toBe(mockUser.email);
      expect(emailArg.template).toBe('sessionRecovery.handlebars');
      expect(emailArg.payload.verificationLink).toContain('/session-recovery/verify?token=');
      expect(emailArg.payload.verificationLink).toContain(`userId=${mockUser._id}`);

      expect(result.success).toBe(true);
      expect(result.message).toContain('Verification link sent');
    });

    it('should return verification link if email is not configured', async () => {
      checkEmailConfig.mockReturnValue(false);

      const result = await requestSessionRecovery(mockUser);

      expect(sendEmail).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.link).toBeDefined();
      expect(result.link).toContain('/session-recovery/verify?token=');
    });
  });

  describe('verifySessionRecovery', () => {
    const validUserId = '507f1f77bcf86cd799439011';
    const rawToken = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const hashedToken = bcrypt.hashSync(rawToken, 10);

    const mockUser = {
      _id: validUserId,
      name: 'Ramesh',
      email: 'ramesh@example.com',
      userRole: 'farmer',
      password: 'secretpassword',
      totpSecret: 'secret',
      toObject: function () {
        return {
          _id: this._id,
          name: this.name,
          email: this.email,
          userRole: this.userRole,
          password: this.password,
          totpSecret: this.totpSecret,
        };
      },
    };

    let mockTokenModel;
    let mockRes;

    beforeEach(() => {
      mockRes = {
        cookie: jest.fn(),
      };

      mockTokenModel = {
        findOne: jest.fn(),
        findOneAndUpdate: jest.fn(),
      };

      mongoose.models.Token = mockTokenModel;
      findUser.mockResolvedValue(mockUser);
      setAuthTokens.mockResolvedValue('new-session-auth-token');
      deleteAllUserSessions.mockResolvedValue({ deletedCount: 1 });
    });

    it('should throw 400 if token or userId is missing', async () => {
      await expect(
        verifySessionRecovery({ token: '', userId: validUserId, res: mockRes }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Token and userId are required' });

      await expect(
        verifySessionRecovery({ token: rawToken, userId: '', res: mockRes }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Token and userId are required' });
    });

    it('should throw 400 if userId is not a valid ObjectId', async () => {
      await expect(
        verifySessionRecovery({ token: rawToken, userId: 'invalid-id', res: mockRes }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'Invalid userId format' });
    });

    it('should throw 404 if user is not found', async () => {
      findUser.mockResolvedValue(null);

      await expect(
        verifySessionRecovery({ token: rawToken, userId: validUserId, res: mockRes }),
      ).rejects.toMatchObject({ statusCode: 404, message: 'User not found' });
    });

    it('should throw 403 if user is not eligible for session recovery', async () => {
      findUser.mockResolvedValue({
        _id: validUserId,
        email: 'rup123@example.com',
        createdFrom: 'REVIEW_SYSTEM',
        userRole: 'farmer',
      });

      await expect(
        verifySessionRecovery({ token: rawToken, userId: validUserId, res: mockRes }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Account is not eligible for session recovery',
      });
    });

    it('should throw 400 if no recovery token is found', async () => {
      mockTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(null),
      });

      await expect(
        verifySessionRecovery({ token: rawToken, userId: validUserId, res: mockRes }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid or expired verification token',
      });
    });

    it('should throw 400 if token has already been used', async () => {
      mockTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          _id: 'token-doc-id',
          token: hashedToken,
          used: true,
          expiresAt: new Date(Date.now() + 100000),
        }),
      });

      await expect(
        verifySessionRecovery({ token: rawToken, userId: validUserId, res: mockRes }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Verification link has already been used',
      });
    });

    it('should throw 400 and clean up if token has expired', async () => {
      mockTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          _id: 'token-doc-id',
          token: hashedToken,
          used: false,
          expiresAt: new Date(Date.now() - 10000), // Expired
        }),
      });

      await expect(
        verifySessionRecovery({ token: rawToken, userId: validUserId, res: mockRes }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('expired'),
      });

      expect(deleteTokens).toHaveBeenCalledWith({
        userId: validUserId,
        type: 'session_recovery',
      });
    });

    it('should throw 400 if token hash does not match', async () => {
      mockTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          _id: 'token-doc-id',
          token: hashedToken,
          used: false,
          expiresAt: new Date(Date.now() + 100000),
        }),
      });

      await expect(
        verifySessionRecovery({
          token: 'wrong-token-value-0000000000000000000000000000000000000000000000',
          userId: validUserId,
          res: mockRes,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid verification token',
      });
    });

    it('should throw 409 if token was claimed by a concurrent request during findOneAndUpdate', async () => {
      mockTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          _id: 'token-doc-id',
          token: hashedToken,
          used: false,
          expiresAt: new Date(Date.now() + 100000),
        }),
      });

      // findOneAndUpdate returns null (concurrent race won by another request)
      mockTokenModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        verifySessionRecovery({ token: rawToken, userId: validUserId, res: mockRes }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('already been used or is currently being verified'),
      });
    });

    it('should successfully verify, invalidate old sessions, and establish new session', async () => {
      mockTokenModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue({
          _id: 'token-doc-id',
          token: hashedToken,
          used: false,
          expiresAt: new Date(Date.now() + 100000),
        }),
      });

      mockTokenModel.findOneAndUpdate.mockResolvedValue({
        _id: 'token-doc-id',
        used: true,
      });

      const result = await verifySessionRecovery({
        token: rawToken,
        userId: validUserId,
        res: mockRes,
      });

      // 1. Verify token was claimed atomically
      expect(mockTokenModel.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'token-doc-id', used: { $ne: true } },
        { $set: { used: true, usedAt: expect.any(Date) } },
        { new: true },
      );

      // 2. Verify previous session was invalidated
      expect(deleteAllUserSessions).toHaveBeenCalledWith({ userId: validUserId.toString() });

      // 3. Verify tokens cleaned up
      expect(deleteTokens).toHaveBeenCalledWith({
        userId: validUserId,
        type: 'session_recovery',
      });

      // 4. Verify new session setAuthTokens was called
      expect(setAuthTokens).toHaveBeenCalledWith(validUserId, mockRes);

      // 5. Verify response payload
      expect(result.token).toBe('new-session-auth-token');
      expect(result.user.id).toBe(validUserId);
      expect(result.user.password).toBeUndefined();
      expect(result.user.totpSecret).toBeUndefined();
      expect(result.message).toContain('Session recovered successfully');
    });
  });
});
