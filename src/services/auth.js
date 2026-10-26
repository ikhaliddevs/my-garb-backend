const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { randomBytes, createHash } = require('node:crypto');
const { HttpError } = require('../middleware/errors');

const ISSUER = 'my-garb-backend';
const AUDIENCE = 'my-garb-session';
const COST = 12;
const digest = value => createHash('sha256').update(value).digest('hex');
const safeUser = user => ({ id: String(user._id), name: user.name, email: user.email, role: user.role, status: user.status });
const unauthenticated = () => new HttpError(401, 'UNAUTHENTICATED', 'Authentication required');
// Lazily generated once, so nonexistent accounts still incur a password comparison.
let dummyHash;
function getDummyHash() {
  if (!dummyHash) dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), COST);
  return dummyHash;
}

function createAuthService({ models, config }) {
  async function register(input) {
    const passwordHash = await bcrypt.hash(input.password, COST);
    try {
      const user = await models.User.create({ name: input.name, email: input.email, role: input.role, passwordHash });
      return safeUser(user);
    } catch (error) {
      if (error.code === 11000) throw new HttpError(409, 'REGISTRATION_CONFLICT', 'Unable to register with these details');
      throw error;
    }
  }
  async function login(input) {
    const user = await models.User.findOne({ email: input.email }).select('+passwordHash');
    const matches = await bcrypt.compare(input.password, user ? user.passwordHash : await getDummyHash());
    if (!matches || !user || user.status !== 'active') throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    const jti = randomBytes(32).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    const exp = now + config.sessionTtlSeconds;
    const token = jwt.sign({ sub: String(user._id), jti, iat: now, exp }, config.jwtSecret, { algorithm: 'HS256', issuer: ISSUER, audience: AUDIENCE });
    await models.Session.create({ tokenHash: digest(jti), userId: user._id, expiresAt: new Date(exp * 1000) });
    return { user: safeUser(user), token };
  }
  async function authenticate(token) {
    let claims;
    try {
      if (typeof token !== 'string' || token.length > 2048) throw unauthenticated();
      claims = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
      if (!claims || typeof claims.sub !== 'string' || !/^[a-f0-9]{24}$/.test(claims.sub) || typeof claims.jti !== 'string' || !/^[a-f0-9]{64}$/.test(claims.jti) || !Number.isInteger(claims.exp)) throw unauthenticated();
    } catch { throw unauthenticated(); }
    const session = await models.Session.findOne({ tokenHash: digest(claims.jti), userId: claims.sub, expiresAt: { $gt: new Date() } });
    if (!session) throw unauthenticated();
    const user = await models.User.findById(claims.sub);
    if (!user || user.status !== 'active') throw unauthenticated();
    return { user: safeUser(user), sessionId: session._id };
  }
  async function logout(sessionId) {
    await models.Session.deleteOne({ _id: sessionId });
  }
  return { register, login, authenticate, logout };
}

module.exports = { createAuthService, safeUser, COST };
