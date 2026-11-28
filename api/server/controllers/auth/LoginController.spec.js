const { loginController } = require('./LoginController');
const { ACTIVE_SESSION_EXISTS_CODE, activeSessionMessage } = require('~/server/services/AuthService');

jest.mock('@librechat/data-schemas', () => {
  const actual = jest.requireActual('@librechat/data-schemas');
  return {
    ...actual,
    logger: {
      ...actual.logger,
      error: jest.fn(),
    },
  };
});

jest.mock('~/models', () => ({
  createToken: jest.fn(),
  deleteTokens: jest.fn(),
  findToken: jest.fn(),
}));

jest.mock('~/server/services/twoFactorService', () => ({
  generate2FATempToken: jest.fn().mockReturnValue('mock-2fa-temp-token'),
}));

jest.mock('~/server/services/AuthService', () => ({
  setAuthTokens: jest.fn(),
  activeSessionMessage: 'You are already logged in on one device. Logout to access in this device.',
  ACTIVE_SESSION_EXISTS_CODE: 'ACTIVE_SESSION_EXISTS',
}));

jest.mock('~/server/services/SessionRecoveryService', () => {
  const actual = jest.requireActual('~/server/services/SessionRecoveryService');
  return {
    ...actual,
    generateSessionRecoveryTempToken: jest.fn().mockReturnValue('mock-recovery-temp-token'),
  };
});

const { setAuthTokens } = require('~/server/services/AuthService');

describe('LoginController - Session Conflict & Recovery', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: null,
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  it('should return 400 if req.user is missing', async () => {
    await loginController(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should return 200 with tokens on successful login without conflict', async () => {
    req.user = {
      _id: '507f1f77bcf86cd799439011',
      email: 'farmer@example.com',
      userRole: 'farmer',
      password: 'secretpassword',
    };

    setAuthTokens.mockResolvedValue('jwt-auth-token');

    await loginController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.objectContaining({
        token: 'jwt-auth-token',
        user: expect.objectContaining({
          id: '507f1f77bcf86cd799439011',
          email: 'farmer@example.com',
        }),
      }),
    );
  });

  it('should offer sessionRecoveryEligible on 409 conflict for eligible farmer', async () => {
    req.user = {
      _id: '507f1f77bcf86cd799439011',
      email: 'farmer@example.com',
      userRole: 'farmer',
    };

    const conflictErr = new Error(activeSessionMessage);
    conflictErr.code = ACTIVE_SESSION_EXISTS_CODE;
    setAuthTokens.mockRejectedValue(conflictErr);

    await loginController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: activeSessionMessage,
      sessionRecoveryEligible: true,
      recoveryTempToken: 'mock-recovery-temp-token',
      email: 'farmer@example.com',
    });
  });

  it('should offer sessionRecoveryEligible on 409 conflict for coordinator roles', async () => {
    const roles = ['district_coordinator', 'block_coordinator', 'village_volunteer'];

    for (const role of roles) {
      req.user = {
        _id: '507f1f77bcf86cd799439011',
        email: `${role}@example.com`,
        userRole: role,
      };

      const conflictErr = new Error(activeSessionMessage);
      conflictErr.code = ACTIVE_SESSION_EXISTS_CODE;
      setAuthTokens.mockRejectedValue(conflictErr);

      await loginController(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionRecoveryEligible: true,
          email: `${role}@example.com`,
        }),
      );
    }
  });

  it('should NOT offer session recovery on 409 conflict if email starts with "rup" and createdFrom is "REVIEW_SYSTEM"', async () => {
    req.user = {
      _id: '507f1f77bcf86cd799439011',
      email: 'rup123@example.com',
      createdFrom: 'REVIEW_SYSTEM',
      userRole: 'farmer',
    };

    const conflictErr = new Error(activeSessionMessage);
    conflictErr.code = ACTIVE_SESSION_EXISTS_CODE;
    setAuthTokens.mockRejectedValue(conflictErr);

    await loginController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: activeSessionMessage,
    });
  });

  it('should NOT offer session recovery on 409 conflict for ineligible roles (e.g., admin, user)', async () => {
    req.user = {
      _id: '507f1f77bcf86cd799439011',
      email: 'admin@example.com',
      role: 'admin',
    };

    const conflictErr = new Error(activeSessionMessage);
    conflictErr.code = ACTIVE_SESSION_EXISTS_CODE;
    setAuthTokens.mockRejectedValue(conflictErr);

    await loginController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: activeSessionMessage,
    });
  });
});
