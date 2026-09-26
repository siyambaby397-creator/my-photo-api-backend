import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import twilio from 'twilio';
import { GoogleGenAI } from '@google/genai';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { RtcTokenBuilder, Role } = require('agora-token');

const app = express();
const PORT = Number(process.env.PORT || 10000);

function envFirst(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

const allowedOrigin = process.env.FRONTEND_ORIGIN || '*';
app.use(helmet());
app.use(cors({ origin: allowedOrigin === '*' ? true : allowedOrigin.split(',').map(v => v.trim()) }));
app.use(express.json({ limit: '2mb' }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

app.get('/', (_req, res) => {
  res.json({ service: 'my-photo-api-backend', status: 'ok' });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

function requireEnv(value, label) {
  if (!value) throw new Error(`${label} is not configured`);
}

// Agora RTC AccessToken2 endpoint.
// POST /api/agora/token
// { "channelName": "room-123", "uid": 123, "role": "publisher", "expiresIn": 3600 }
app.post('/api/agora/token', (req, res) => {
  try {
    const appId = envFirst('AGORA_APP_ID');
    const appCertificate = envFirst('AGORA_APP_CERTIFICATE', 'AGORA_CERTIFICATE', 'AGORA_CERTIFI');
    requireEnv(appId, 'AGORA_APP_ID');
    requireEnv(appCertificate, 'AGORA_APP_CERTIFICATE');

    const channelName = String(req.body?.channelName || '').trim();
    if (!channelName || channelName.length > 64) {
      return res.status(400).json({ error: 'channelName is required and must be 64 characters or fewer' });
    }

    const uid = Number(req.body?.uid ?? 0);
    if (!Number.isInteger(uid) || uid < 0 || uid > 0xffffffff) {
      return res.status(400).json({ error: 'uid must be an integer between 0 and 4294967295' });
    }

    const roleName = String(req.body?.role || 'publisher').toLowerCase();
    const role = roleName === 'subscriber' ? Role.SUBSCRIBER : Role.PUBLISHER;
    const expiresIn = Math.min(Math.max(Number(req.body?.expiresIn || 3600), 60), 86400);

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      expiresIn,
      expiresIn
    );

    res.json({ token, appId, channelName, uid, role: roleName, expiresIn });
  } catch (error) {
    console.error('Agora token error:', error.message);
    res.status(500).json({ error: 'Failed to generate Agora token' });
  }
});

// Gemini text generation endpoint.
// POST /api/gemini/generate
// { "prompt": "...", "model": "gemini-3.8-flash" }
app.post('/api/gemini/generate', async (req, res) => {
  try {
    const apiKey = envFirst('GEMINI_AI_API_KEY', 'GEMINI_API_KEY', 'GEMINI_AI_API');
    requireEnv(apiKey, 'GEMINI_API_KEY');

    const prompt = String(req.body?.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    if (prompt.length > 100000) return res.status(400).json({ error: 'prompt is too long' });

    const model = String(req.body?.model || 'gemini-3.8-flash');
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({ model, contents: prompt });

    res.json({ text: response.text ?? '' });
  } catch (error) {
    console.error('Gemini error:', error.message);
    res.status(502).json({ error: 'Gemini request failed' });
  }
});

// Twilio SMS endpoint.
// POST /api/twilio/sms
// { "to": "+8801...", "body": "Hello" }
app.post('/api/twilio/sms', async (req, res) => {
  try {
    const accountSid = envFirst('TWILIO_ACCOUNT_SID', 'TWILIO_ACCOUNT', 'TWILIO_ACCOUN');
    const authToken = envFirst('TWILIO_AUTH_TOKEN', 'TWILIO_AUTH', 'TWILIO_AUTH_T');
    const from = envFirst('TWILIO_FROM_NUMBER', 'TWILIO_FROM', 'TWILIO_FROM_N');
    requireEnv(accountSid, 'TWILIO_ACCOUNT_SID');
    requireEnv(authToken, 'TWILIO_AUTH_TOKEN');
    requireEnv(from, 'TWILIO_FROM_NUMBER');

    const to = String(req.body?.to || '').trim();
    const body = String(req.body?.body || '').trim();
    if (!to || !body) return res.status(400).json({ error: 'to and body are required' });
    if (body.length > 1600) return res.status(400).json({ error: 'SMS body is too long' });

    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({ body, from, to });

    res.json({ sid: message.sid, status: message.status });
  } catch (error) {
    console.error('Twilio error:', error.message);
    res.status(502).json({ error: 'Twilio request failed' });
  }
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`my-photo-api-backend listening on port ${PORT}`);
});
