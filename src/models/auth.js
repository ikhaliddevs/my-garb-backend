const { profileFields } = require('./profile');

function createAuthModels(client) {
  const { Schema } = client;
  const options = { timestamps: true, autoCreate: false, autoIndex: false, bufferCommands: false };
  const userSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'designer', 'admin'], required: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
    emailVerified: { type: Boolean, default: false, required: true },
    emailVerifiedAt: { type: Date, default: null },
    emailVerification: {
      challengeId: { type: String, select: false },
      otpHash: { type: String, select: false },
      expiresAt: { type: Date, select: false },
      attempts: { type: Number, default: 0, select: false },
      sentAt: { type: Date, select: false },
      windowStartedAt: { type: Date, select: false },
      sendCount: { type: Number, default: 0, select: false },
    },
    sessionVersion: { type: Number, default: 0 },
    ...profileFields(Schema),
  }, options);
  userSchema.index({ role: 1, status: 1, 'designer.available': 1, _id: 1 });
  userSchema.index({ role: 1, status: 1, 'designer.location': 1, _id: 1 });
  const sessionSchema = new Schema({
    tokenHash: { type: String, required: true, unique: true },
    sessionVersion: { type: Number, default: 0 },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  }, options);
  return { User: client.model('User', userSchema), Session: client.model('Session', sessionSchema) };
}

module.exports = { createAuthModels };
