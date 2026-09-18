import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeCaptcha,
  createCaptcha,
  createCaptchaWithCodeForTest,
} from './services/captcha.js';

test('captcha image challenge is issued', async () => {
  const a = await createCaptcha();
  assert.ok(a.captchaId);
  assert.match(a.image, /^data:image\/svg\+xml;base64,/);
  assert.equal(await consumeCaptcha(a.captchaId, 'XXXX'), false);
});

test('captcha accepts correct code once then rejects reuse', async () => {
  const { captchaId, code } = await createCaptchaWithCodeForTest();
  assert.equal(await consumeCaptcha(captchaId, code), true);
  assert.equal(await consumeCaptcha(captchaId, code), false);
});
