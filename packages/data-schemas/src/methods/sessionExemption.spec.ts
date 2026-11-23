import {
  isSessionResetExempt,
  EXTERNAL_USER_ROLES,
  ACTIVE_SESSION_EXISTS_CODE,
  createSessionMethods,
  SessionError,
} from './session';

describe('isSessionResetExempt unit tests', () => {
  describe('Rule 1: RUP Pattern (email ^rup and createdFrom REVIEW_SYSTEM)', () => {
    it('should return true for email starting with "rup" (case-insensitive) AND createdFrom REVIEW_SYSTEM', () => {
      expect(isSessionResetExempt({ email: 'rup123@example.com', createdFrom: 'REVIEW_SYSTEM' })).toBe(true);
      expect(isSessionResetExempt({ email: 'RUP_pilot@customdomain.org', createdFrom: 'REVIEW_SYSTEM' })).toBe(true);
      expect(isSessionResetExempt({ email: 'rup.farmer@anything.io', createdFrom: 'review_system' })).toBe(true);
      expect(isSessionResetExempt({ email: '  Rup_Test@domain.com  ', createdFrom: '  REVIEW_SYSTEM  ' })).toBe(true);
    });

    it('should return true for RUP accounts even if userRole is INTERNAL or ADMIN', () => {
      expect(isSessionResetExempt({ email: 'rup_bot@test.com', userRole: 'INTERNAL', createdFrom: 'REVIEW_SYSTEM' })).toBe(true);
      expect(isSessionResetExempt({ email: 'rup_bot@test.com', userRole: 'internal', createdFrom: 'REVIEW_SYSTEM' })).toBe(true);
    });

    it('should return false if email starts with rup but createdFrom is NOT REVIEW_SYSTEM and role is not external', () => {
      expect(isSessionResetExempt({ email: 'rupesh@example.com', userRole: 'INTERNAL' })).toBe(false);
      expect(isSessionResetExempt({ email: 'rup123@example.com', userRole: 'INTERNAL', createdFrom: undefined })).toBe(false);
      expect(isSessionResetExempt({ email: 'rupa@example.com', userRole: 'INTERNAL', createdFrom: 'WEB_APP' })).toBe(false);
    });

    it('should return false if createdFrom is REVIEW_SYSTEM but email does NOT start with rup and role is not external', () => {
      expect(isSessionResetExempt({ email: 'john@example.com', userRole: 'INTERNAL', createdFrom: 'REVIEW_SYSTEM' })).toBe(false);
    });
  });

  describe('Rule 2: External Roles (FARMER and coordinator roles)', () => {
    it('should return true for FARMER role (case-insensitive)', () => {
      expect(isSessionResetExempt({ email: 'farmer1@example.com', userRole: 'FARMER' })).toBe(true);
      expect(isSessionResetExempt({ email: 'farmer2@example.com', userRole: 'farmer' })).toBe(true);
    });

    it('should return true for district_coordinator role (case-insensitive)', () => {
      expect(isSessionResetExempt({ email: 'dc@example.com', userRole: 'DISTRICT_COORDINATOR' })).toBe(true);
      expect(isSessionResetExempt({ email: 'dc@example.com', userRole: 'district_coordinator' })).toBe(true);
    });

    it('should return true for block_coordinator role (case-insensitive)', () => {
      expect(isSessionResetExempt({ email: 'bc@example.com', userRole: 'BLOCK_COORDINATOR' })).toBe(true);
      expect(isSessionResetExempt({ email: 'bc@example.com', userRole: 'block_coordinator' })).toBe(true);
    });

    it('should return true for village_volunteer role (case-insensitive)', () => {
      expect(isSessionResetExempt({ email: 'vv@example.com', userRole: 'VILLAGE_VOLUNTEER' })).toBe(true);
      expect(isSessionResetExempt({ email: 'vv@example.com', userRole: 'village_volunteer' })).toBe(true);
    });

    it('should return false for non-external roles (e.g. internal, admin, unknown)', () => {
      expect(isSessionResetExempt({ email: 'staff@example.com', userRole: 'INTERNAL' })).toBe(false);
      expect(isSessionResetExempt({ email: 'staff@example.com', userRole: 'internal' })).toBe(false);
      expect(isSessionResetExempt({ email: 'user@example.com', userRole: 'unknown_role' })).toBe(false);
      expect(isSessionResetExempt(null)).toBe(false);
      expect(isSessionResetExempt(undefined)).toBe(false);
    });
  });

  describe('createSession conflict handling (no auto-reset, preserves existing session logic)', () => {
    let mockSessionModel: any;
    let mockMongoose: any;
    let sessionMethods: ReturnType<typeof createSessionMethods>;

    beforeEach(() => {
      process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
      mockSessionModel = function (data: any) {
        return {
          ...data,
          save: jest.fn().mockResolvedValue(true),
        };
      };
      mockSessionModel.findOne = jest.fn();
      mockSessionModel.deleteMany = jest.fn();

      mockMongoose = {
        models: {
          Session: mockSessionModel,
        },
      } as any;

      sessionMethods = createSessionMethods(mockMongoose);
    });

    it('should throw ACTIVE_SESSION_EXISTS SessionError when active session exists (without auto-reset)', async () => {
      mockSessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'old-session-id', user: 'user-1' }),
      });

      await expect(sessionMethods.createSession('user-1')).rejects.toThrow(SessionError);
      await expect(sessionMethods.createSession('user-1')).rejects.toMatchObject({
        code: ACTIVE_SESSION_EXISTS_CODE,
      });

      // Does not delete sessions on login conflict
      expect(mockSessionModel.deleteMany).not.toHaveBeenCalled();
    });

    it('should create session when no active session exists', async () => {
      mockSessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const result = await sessionMethods.createSession('user-new');
      expect(result.refreshToken).toBeDefined();
      expect(result.session).toBeDefined();
    });
  });
});
