require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
const port = process.env.PORT || 3000;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Generate Twilio Access Token for browser
app.post('/api/token', (req, res) => {
  const { identity } = req.body; // we'll send "testuser"
  
  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: process.env.TWILIO_TWIML_APP_SID,
    incomingAllow: false,
  });

  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID || process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SECRET || process.env.TWILIO_AUTH_TOKEN,
    { identity: identity || 'testuser' }
  );

  token.addGrant(voiceGrant);

  res.json({ token: token.toJwt() });
});

// TwiML webhook for outbound calls
app.post('/api/voice', (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const dial = twiml.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER
  });
  
  dial.number(req.body.To);
  
  res.type('text/xml');
  res.send(twiml.toString());
});

app.get('/', (req, res) => {
  res.send('Twilio Dialer Backend is running ✅');
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});