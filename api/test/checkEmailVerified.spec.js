const checkEmailVerified = require('../server/middleware/checkEmailVerified');

describe('checkEmailVerified middleware', () => {
  const originalEnv = process.env;
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    req = {
      user: {
        email: 'user@example.com',
        userRole: 'USER',
        emailVerified: false,
      },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should call next() if email verification is disabled', () => {
    delete process.env.emailVerified;
    delete process.env.EMAIL_VERIFIED;

    checkEmailVerified(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() if there is no user attached to req', () => {
    process.env.emailVerified = 'true';
    req.user = null;

    checkEmailVerified(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() if user email is already verified', () => {
    process.env.emailVerified = 'true';
    req.user.emailVerified = true;

    checkEmailVerified(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should call next() if user is exempt (e.g. INTERNAL role)', () => {
    process.env.NODE_ENV = 'production';
    process.env.emailVerified = 'true';
    req.user.userRole = 'INTERNAL';
    req.user.emailVerified = false;

    checkEmailVerified(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block non-exempt unverified FARMER user and return 403', () => {
    process.env.NODE_ENV = 'production';
    process.env.emailVerified = 'true';
    req.user.userRole = 'FARMER';
    req.user.emailVerified = false;

    checkEmailVerified(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'EMAIL_NOT_VERIFIED',
      }),
    );
  });

  it('should call next() if user is exempt (rup email AND createdFrom REVIEW_SYSTEM)', () => {
    process.env.emailVerified = 'true';
    req.user = {
      email: 'rup123@example.com',
      createdFrom: 'REVIEW_SYSTEM',
      userRole: 'USER',
      emailVerified: false,
    };

    checkEmailVerified(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block and return 403 if user email is rup but NOT createdFrom REVIEW_SYSTEM', () => {
    process.env.emailVerified = 'true';
    req.user = {
      email: 'rup123@example.com',
      createdFrom: 'DIRECT_SIGNUP',
      userRole: 'USER',
      emailVerified: false,
    };

    checkEmailVerified(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'EMAIL_NOT_VERIFIED',
      }),
    );
  });

  it('should block non-exempt unverified user and return 403', () => {
    process.env.emailVerified = 'true';
    req.user = {
      email: 'regular@example.com',
      userRole: 'USER',
      emailVerified: false,
    };

    checkEmailVerified(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Email verification required'),
        code: 'EMAIL_NOT_VERIFIED',
      }),
    );
  });
});
