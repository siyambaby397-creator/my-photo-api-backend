# my-photo-api-backend

Secure Node.js/Express backend for the photo app.

## Architecture

App -> Render Web Service -> Doppler secrets -> Agora / Gemini / Twilio

No API secret is stored in source code. The backend reads secrets only from environment variables supplied at runtime.

## Endpoints

- `GET /health`
- `POST /api/agora/token`
- `POST /api/gemini/generate`
- `POST /api/twilio/sms`

### Agora request

```json
{
  "channelName": "room-123",
  "uid": 123,
  "role": "publisher",
  "expiresIn": 3600
}
```

### Gemini request

```json
{
  "prompt": "Hello",
  "model": "gemini-3.8-flash"
}
```

### Twilio request

```json
{
  "to": "+8801XXXXXXXXX",
  "body": "Hello"
}
```

## Environment variable aliases

The code accepts common/shortened names because Doppler secret names may differ:

- Agora: `AGORA_APP_ID`, `AGORA_APP_CERTIFICATE` (also `AGORA_CERTIFICATE` / `AGORA_CERTIFI`)
- Gemini: `GEMINI_AI_API_KEY` (also `GEMINI_API_KEY` / `GEMINI_AI_API`)
- Twilio: `TWILIO_ACCOUNT_SID` (also `TWILIO_ACCOUNT` / `TWILIO_ACCOUN`), `TWILIO_AUTH_TOKEN` (also `TWILIO_AUTH` / `TWILIO_AUTH_T`), `TWILIO_FROM_NUMBER` (also `TWILIO_FROM` / `TWILIO_FROM_N`)

Do not expose the Doppler service token to the frontend.
