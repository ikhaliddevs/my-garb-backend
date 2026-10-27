function createAuthModels(client) {
  const { Schema } = client;
  const options = { timestamps: true, autoCreate: false, autoIndex: false, bufferCommands: false };
  const userSchema = new Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['customer', 'designer', 'admin'], required: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', required: true },
  }, options);
  const sessionSchema = new Schema({
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  }, options);
  return { User: client.model('User', userSchema), Session: client.model('Session', sessionSchema) };
}

module.exports = { createAuthModels };
