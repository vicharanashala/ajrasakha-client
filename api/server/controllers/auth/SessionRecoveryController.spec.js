const {
  sessionRecoveryRequestController,
} = require('./SessionRecoveryController');
const {
  generateSessionRecoveryTempToken,
} = require('~/server/services/SessionRecoveryService');

jest.mock('~/models', () => ({
  findUser: jest.fn(),
  comparePassword: jest.fn(),
  countActiveSessions: jest.fn(),
}));

jest.mock('~/server/services/SessionRecoveryService', () => {
  const actual = jest.requireActual('~/server/services/SessionRecoveryService');
  return {
    ...actual,
    requestSessionRecovery: jest.fn().mockResolvedValue({
      success: true,
      message: 'Verification link sent to your registered email address.',
    }),
  };
});

const { findUser, comparePassword, countActiveSessions } = require('~/models');
const { requestSessionRecovery } = require('~/server/services/SessionRecoveryService');

describe('SessionRecoveryController', () => {
  const originalEnv = process.env;
  let req, res;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-secret-key-12345',
      DOMAIN_CLIENT: 'http://localhost:3080',
    };

    req = {
      body: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return 400 if neither recoveryTempToken nor credentials are provided', async () => {
    await sessionRecoveryRequestController(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Missing session recovery token or user credentials.',
      }),
    );
  });

  it('should return 401 if an invalid recoveryTempToken is provided', async () => {
    req.body = { recoveryTempToken: 'invalid.token' };

    await sessionRecoveryRequestController(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Invalid or expired'),
      }),
    );
  });

  it('should return 404 if user identified by tempToken is not found', async () => {
    const validTempToken = generateSessionRecoveryTempToken(
      '507f1f77bcf86cd799439011',
      'farmer@example.com',
    );
    req.body = { recoveryTempToken: validTempToken };

    findUser.mockResolvedValue(null);

    await sessionRecoveryRequestController(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'User not found.' });
  });

  it('should return 403 if user is not eligible for session recovery', async () => {
    const validTempToken = generateSessionRecoveryTempToken(
      '507f1f77bcf86cd799439011',
      'rup123@example.com',
    );
    req.body = { recoveryTempToken: validTempToken };

    findUser.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      email: 'rup123@example.com',
      createdFrom: 'REVIEW_SYSTEM',
      userRole: 'farmer',
    });

    await sessionRecoveryRequestController(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('not eligible'),
      }),
    );
  });

  it('should return message if no active session conflict exists', async () => {
    const validTempToken = generateSessionRecoveryTempToken(
      '507f1f77bcf86cd799439011',
      'farmer@example.com',
    );
    req.body = { recoveryTempToken: validTempToken };

    findUser.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      email: 'farmer@example.com',
      userRole: 'farmer',
    });

    countActiveSessions.mockResolvedValue(0);

    await sessionRecoveryRequestController(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        noConflict: true,
      }),
    );
  });

  it('should successfully trigger session recovery when eligible and conflict exists', async () => {
    const validTempToken = generateSessionRecoveryTempToken(
      '507f1f77bcf86cd799439011',
      'farmer@example.com',
    );
    req.body = { recoveryTempToken: validTempToken };

    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'farmer@example.com',
      userRole: 'farmer',
    };

    findUser.mockResolvedValue(mockUser);
    countActiveSessions.mockResolvedValue(1);

    await sessionRecoveryRequestController(req, res);

    expect(requestSessionRecovery).toHaveBeenCalledWith(mockUser);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it('should authenticate via email & password if provided', async () => {
    req.body = {
      email: 'farmer@example.com',
      password: 'password123',
    };

    const mockUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'farmer@example.com',
      password: 'hashedpassword',
      userRole: 'village_volunteer',
    };

    findUser.mockResolvedValue(mockUser);
    comparePassword.mockResolvedValue(true);
    countActiveSessions.mockResolvedValue(1);

    await sessionRecoveryRequestController(req, res);

    expect(findUser).toHaveBeenCalledWith({ email: 'farmer@example.com' }, '+password');
    expect(comparePassword).toHaveBeenCalledWith(mockUser, 'password123');
    expect(requestSessionRecovery).toHaveBeenCalledWith(mockUser);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
