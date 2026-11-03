const { HttpError } = require('../middleware/errors');

function validateCredentials(body, registration = false, admin = false) {
  const allowed = registration ? ['name', 'email', 'password', 'role'] : ['email', 'password'];
  const invalid = () => { throw new HttpError(400, 'INVALID_INPUT', 'Invalid authentication input'); };
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) invalid();
  if (typeof body.email !== 'string' || typeof body.password !== 'string') invalid();
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid();
  // Reject rather than silently truncate bcrypt's 72-byte input limit.
  if ([...body.password].length < 8 || Buffer.byteLength(body.password, 'utf8') > 72 || body.password.includes('\0')) invalid();
  const result = { email, password: body.password };
  if (registration) {
    if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 100) invalid();
    if (!(admin ? ['admin'] : ['customer', 'designer']).includes(body.role)) invalid();
    result.name = body.name.trim();
    result.role = body.role;
  }
  return result;
}

function validateVerification(body, resend = false) {
  const allowed = resend ? ['email'] : ['email', 'otp'];
  const invalid = () => { throw new HttpError(400, 'INVALID_INPUT', 'Invalid authentication input'); };
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !allowed.includes(key))) invalid();
  if (typeof body.email !== 'string') invalid();
  const email = body.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) invalid();
  if (resend) return { email };
  if (typeof body.otp !== 'string' || !/^\d{6}$/.test(body.otp)) invalid();
  return { email, otp: body.otp };
}

module.exports = { validateCredentials, validateVerification };
