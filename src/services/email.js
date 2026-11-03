const RESEND_URL = 'https://api.resend.com/emails';

function createEmailProvider(config, fetchImpl = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms))) {
  if (config.emailProvider !== 'resend') {
    return {
      async sendVerificationCode() {
        throw new Error('Email provider is not configured');
      },
    };
  }

  return {
    async sendVerificationCode({ to, otp }) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        let response;
        try {
          response = await fetchImpl(RESEND_URL, {
            method: 'POST',
            headers: { Authorization: `Bearer ${config.resendApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: config.emailFrom,
              to: [to],
              subject: 'Your MY GARB verification code',
              text: `Your MY GARB verification code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
            }),
            signal: AbortSignal.timeout(8000),
          });
        } catch (error) {
          if (attempt === 2) throw new Error('Email provider request failed', { cause: error });
          await wait(100 * (attempt + 1));
          continue;
        }
        if (response.ok) return;
        if (response.status < 500 && response.status !== 429) throw new Error('Email provider rejected the request');
        if (attempt === 2) throw new Error('Email provider request failed');
        await wait(100 * (attempt + 1));
      }
    },
  };
}

module.exports = { createEmailProvider };
