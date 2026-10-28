const { logger } = require('@librechat/data-schemas');
const { SystemRoles, UserRoles } = require('librechat-data-provider');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { getUserById, updateUser } = require('~/models');
const { Session } = require('~/db/models');

// JWT strategy
const jwtLogin = () =>
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET,
    },
    async (payload, done) => {
      try {
        const user = await getUserById(payload?.id, '-password -__v -totpSecret -backupCodes');
        if (user) {
          user.id = user._id.toString();
          if (!user.role) {
            user.role = SystemRoles.USER;
            await updateUser(user.id, { role: user.role });
          }
          if (!user.userRole) {
            user.userRole = UserRoles.FARMER;
            await updateUser(user.id, { userRole: user.userRole });
          }
          if (!user.isVerified) {
            logger.warn(`[jwtLogin] Access denied: reason=USER_NOT_VERIFIED user=${user.id}`);
            return done(null, false);
          }
          // Expired documents can linger until the TTL monitor removes them, so check expiration too.
          const session = await Session.findOne({
            user: user._id,
            expiration: { $gt: new Date() },
          })
            .select('_id')
            .lean();
          if (!session) {
            logger.warn(
              `[jwtLogin] Access denied: reason=NO_ACTIVE_SESSION (expired, revoked or logged out) user=${user.id}`,
            );
            return done(null, false);
          }
          done(null, user);
        } else {
          logger.warn('[jwtLogin] JwtStrategy => no user found: ' + payload?.id);
          done(null, false);
        }
      } catch (err) {
        // Infrastructure failure: surfaces as a 5xx so the client does not treat it as a logout.
        logger.error(`[jwtLogin] Session validation could not be completed: user=${payload?.id}`, err);
        done(err, false);
      }
    },
  );

module.exports = jwtLogin;
