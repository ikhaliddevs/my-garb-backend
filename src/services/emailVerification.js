const { createHmac, randomInt, randomBytes, timingSafeEqual } = require('node:crypto');
const { HttpError } = require('../middleware/errors');

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const SEND_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;
const GENERIC_FAILURE = () => new HttpError(400, 'VERIFICATION_FAILED', 'Unable to verify this email. Check the code or request another.');

function createEmailVerificationService({ models, config, emailProvider, logger = console, otpGenerator = () => String(randomInt(0, 1000000)).padStart(6, '0'), now = () => new Date() }) {
  const hmacSecret = config.otpHmacSecret || (config.nodeEnv !== 'production' && config.jwtSecret
    ? createHmac('sha256', config.jwtSecret).update('mygarb-email-verification-development-key-v1').digest()
    : null);

  const hashOtp = (userId, challengeId, otp) => {
    if (!hmacSecret) throw new Error('OTP_HMAC_SECRET is required for email verification');
    return createHmac('sha256', hmacSecret).update(`${userId}:${challengeId}:${otp}`).digest('hex');
  };

  async function claimChallenge(user) {
    const issuedAt = now();
    const challengeId = randomBytes(16).toString('hex');
    const otp = otpGenerator();
    const otpHash = hashOtp(user._id, challengeId, otp);
    const challenge = {
      'emailVerification.challengeId': challengeId,
      'emailVerification.otpHash': otpHash,
      'emailVerification.expiresAt': new Date(issuedAt.getTime() + OTP_TTL_MS),
      'emailVerification.attempts': 0,
      'emailVerification.sentAt': issuedAt,
    };
    const cooldown = {
      $or: [
        { 'emailVerification.sentAt': { $exists: false } },
        { 'emailVerification.sentAt': { $lte: new Date(issuedAt.getTime() - RESEND_COOLDOWN_MS) } },
      ],
    };
    const resetWindow = {
      _id: user._id,
      emailVerified: { $ne: true },
      $and: [
        cooldown,
        { $or: [
          { 'emailVerification.windowStartedAt': { $exists: false } },
          { 'emailVerification.windowStartedAt': { $lte: new Date(issuedAt.getTime() - SEND_WINDOW_MS) } },
        ] },
      ],
    };
    let updated = await models.User.findOneAndUpdate(resetWindow, {
      $set: { ...challenge, 'emailVerification.windowStartedAt': issuedAt, 'emailVerification.sendCount': 1 },
    }, { returnDocument: 'after' });

    if (!updated) {
      updated = await models.User.findOneAndUpdate({
        _id: user._id,
        emailVerified: { $ne: true },
        'emailVerification.windowStartedAt': { $gt: new Date(issuedAt.getTime() - SEND_WINDOW_MS) },
        'emailVerification.sendCount': { $lt: MAX_SENDS },
        ...cooldown,
      }, {
        $set: challenge,
        $inc: { 'emailVerification.sendCount': 1 },
      }, { returnDocument: 'after' });
    }
    if (!updated) return false;

    try {
      await emailProvider.sendVerificationCode({ to: user.email, otp });
      return true;
    } catch {
      logger.warn?.({ event: 'verification_email_delivery_failed' });
      return false;
    }
  }

  async function startForUser(user) {
    return claimChallenge(user);
  }

  async function resend(email) {
    const user = await models.User.findOne({ email }).select('+emailVerification.challengeId +emailVerification.otpHash +emailVerification.expiresAt +emailVerification.attempts +emailVerification.sentAt +emailVerification.windowStartedAt +emailVerification.sendCount');
    if (!user || user.emailVerified === true) return;
    await claimChallenge(user);
  }

  async function verify(email, otp) {
    const user = await models.User.findOne({ email }).select('+emailVerification.challengeId +emailVerification.otpHash +emailVerification.expiresAt +emailVerification.attempts');
    const currentTime = now();
    const challenge = user?.emailVerification;
    if (!user || user.emailVerified === true || !challenge?.challengeId || !challenge.otpHash ||
        !challenge.expiresAt || challenge.expiresAt <= currentTime || challenge.attempts >= MAX_ATTEMPTS) {
      throw GENERIC_FAILURE();
    }

    const expectedHash = hashOtp(user._id, challenge.challengeId, otp);
    const actual = Buffer.from(challenge.otpHash, 'hex');
    const expected = Buffer.from(expectedHash, 'hex');
    const matches = actual.length === expected.length && timingSafeEqual(actual, expected);
    const activeChallenge = {
      _id: user._id,
      emailVerified: { $ne: true },
      'emailVerification.challengeId': challenge.challengeId,
      'emailVerification.expiresAt': { $gt: currentTime },
      'emailVerification.attempts': { $lt: MAX_ATTEMPTS },
    };

    if (!matches) {
      await models.User.updateOne(activeChallenge, { $inc: { 'emailVerification.attempts': 1 } });
      throw GENERIC_FAILURE();
    }

    const verified = await models.User.findOneAndUpdate({
      ...activeChallenge,
      'emailVerification.otpHash': expectedHash,
    }, {
      $set: { emailVerified: true, emailVerifiedAt: currentTime },
      $unset: {
        'emailVerification.challengeId': 1,
        'emailVerification.otpHash': 1,
        'emailVerification.expiresAt': 1,
        'emailVerification.attempts': 1,
        'emailVerification.sentAt': 1,
        'emailVerification.windowStartedAt': 1,
        'emailVerification.sendCount': 1,
      },
      $inc: { sessionVersion: 1 },
    }, { returnDocument: 'after' });
    if (!verified) throw GENERIC_FAILURE();
  }

  return { startForUser, resend, verify };
}

module.exports = { createEmailVerificationService, OTP_TTL_MS, RESEND_COOLDOWN_MS, SEND_WINDOW_MS, MAX_ATTEMPTS, MAX_SENDS };
