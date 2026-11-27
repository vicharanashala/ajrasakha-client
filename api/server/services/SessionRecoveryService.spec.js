const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  isSessionRecoveryEligible,
  generateSessionRecoveryTempToken,
  verifySessionRecoveryTempToken,
  generateSessionRecoveryToken,
  requestSessionRecovery,
} = require('./SessionRecoveryService');

// Mock dependencies
jest.mock('~/models', () => ({
  createToken: jest.fn(),
  deleteTokens: jest.fn(),
  findToken: jest.fn(),
}));

jest.mock('@librechat/api', () => ({
  checkEmailConfig: jest.fn(() => true),
}));

jest.mock('~/server/utils', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

const { createToken, deleteTokens } = require('~/models');
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
});
