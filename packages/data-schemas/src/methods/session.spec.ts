import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type * as t from '~/types';
import { hashToken } from '~/crypto';
import { createSessionMethods } from './session';
import sessionSchema from '~/schema/session';
import userSchema from '~/schema/user';

let mongoServer: MongoMemoryServer;
let Session: mongoose.Model<t.ISession>;
let methods: ReturnType<typeof createSessionMethods>;

const userId = new mongoose.Types.ObjectId();
const initialToken = 'initial-refresh-token';

// Creates an active session whose current refresh token is initialToken.
async function createActiveSession(expiration = new Date(Date.now() + 60 * 60 * 1000)) {
  return Session.create({
    user: userId,
    expiration,
    refreshTokenHash: await hashToken(initialToken),
  });
}

beforeAll(async () => {
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
  Session = mongoose.models.Session || mongoose.model<t.ISession>('Session', sessionSchema);
  if (!mongoose.models.User) {
    mongoose.model('User', userSchema);
  }
  methods = createSessionMethods(mongoose);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer?.stop();
});

beforeEach(async () => {
  await mongoose.connection.dropDatabase();
});

describe('Session refresh token rotation', () => {
  it('rotates the token and keeps the previous one valid during the grace window', async () => {
    const session = await createActiveSession();

    const rotated = await methods.rotateRefreshToken(session, initialToken);

    expect(rotated).toBeTruthy();
    expect(await methods.findSession({ userId: userId.toString(), refreshToken: rotated! })).not.toBeNull();
    expect(await methods.findSession({ userId: userId.toString(), refreshToken: initialToken })).not.toBeNull();
  });

  it('does not rotate again when a concurrent request presents the already rotated token', async () => {
    const session = await createActiveSession();
    const rotated = await methods.rotateRefreshToken(session, initialToken);

    const fresh = (await Session.findById(session._id))!;
    const second = await methods.rotateRefreshToken(fresh, initialToken);

    expect(second).toBeNull();
    const stored = await Session.findById(session._id).lean();
    expect(stored?.refreshTokenHash).toBe(await hashToken(rotated!));
  });

  it('rejects the previous token once the grace window has passed', async () => {
    const session = await createActiveSession();
    await methods.rotateRefreshToken(session, initialToken);
    await Session.updateOne(
      { _id: session._id },
      { $set: { previousRefreshTokenValidUntil: new Date(Date.now() - 1000) } },
    );

    expect(await methods.findSession({ userId: userId.toString(), refreshToken: initialToken })).toBeNull();
  });

  it('rejects an unknown token', async () => {
    await createActiveSession();

    expect(await methods.findSession({ userId: userId.toString(), refreshToken: 'unknown' })).toBeNull();
  });
});

describe('Invalid and revoked sessions', () => {
  it('does not return an expired session document that still exists', async () => {
    await createActiveSession(new Date(Date.now() - 1000));

    expect(await methods.findSession({ userId: userId.toString(), refreshToken: initialToken })).toBeNull();
  });

  it('does not return a session after it was deleted (logout or remote logout)', async () => {
    const session = await createActiveSession();
    await methods.deleteSession({ sessionId: String(session._id) });

    expect(await methods.findSession({ userId: userId.toString(), refreshToken: initialToken })).toBeNull();
  });

  it('does not rotate an expired session', async () => {
    const session = await createActiveSession(new Date(Date.now() - 1000));

    expect(await methods.rotateRefreshToken(session, initialToken)).toBeNull();
  });
});
