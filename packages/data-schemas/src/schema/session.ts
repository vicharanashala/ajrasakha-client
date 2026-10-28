import mongoose, { Schema } from 'mongoose';
import { ISession } from '~/types';

const sessionSchema: Schema<ISession> = new Schema({
  refreshTokenHash: {
    type: String,
    required: true,
  },
  // Hash of the refresh token replaced by the latest rotation, accepted briefly for concurrent refreshes.
  previousRefreshTokenHash: {
    type: String,
  },
  // Time until which previousRefreshTokenHash is still accepted.
  previousRefreshTokenValidUntil: {
    type: Date,
  },
  expiration: {
    type: Date,
    required: true,
    expires: 0,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
});

export default sessionSchema;
