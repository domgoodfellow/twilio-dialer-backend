require('dotenv').config();
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Canadian area code → province mapping
const AREA_CODE_TO_PROVINCE = {
  // Alberta
  403: 'AB', 587: 'AB', 780: 'AB', 825: 'AB', 368: 'AB',
  // British Columbia
  236: 'BC', 250: 'BC', 604: 'BC', 672: 'BC', 778: 'BC',
  // Manitoba
  204: 'MB', 431: 'MB', 584: 'MB',
  // New Brunswick
  506: 'NB', 428: 'NB',
  // Newfoundland & Labrador
  709: 'NL',
  // Nova Scotia / PEI (shared — default NS; 902 & 782 serve both provinces)
  782: 'NS', 902: 'NS',
  // Northwest Territories / Nunavut / Yukon (shared — default NT)
  867: 'NT',
  // Ontario
  226: 'ON', 249: 'ON', 289: 'ON', 343: 'ON', 365: 'ON',
  416: 'ON', 437: 'ON', 519: 'ON', 548: 'ON', 613: 'ON',
  647: 'ON', 705: 'ON', 753: 'ON', 807: 'ON', 905: 'ON', 942: 'ON',
  // Quebec
  263: 'QC', 354: 'QC', 367: 'QC', 418: 'QC', 438: 'QC', 450: 'QC',
  514: 'QC', 579: 'QC', 581: 'QC', 819: 'QC', 873: 'QC',
  // Saskatchewan
  306: 'SK', 474: 'SK', 639: 'SK',
};

// Provincial Twilio numbers (set in .env)
const PROVINCE_NUMBERS = {
  AB: process.env.TWILIO_NUMBER_AB,
  BC: process.env.TWILIO_NUMBER_BC,
  MB: process.env.TWILIO_NUMBER_MB,
  NB: process.env.TWILIO_NUMBER_NB,
  NL: process.env.TWILIO_NUMBER_NL,
  NS: process.env.TWILIO_NUMBER_NS,
  NT: process.env.TWILIO_NUMBER_NT,
  ON: process.env.TWILIO_NUMBER_ON,
  PE: process.env.TWILIO_NUMBER_PE,
  QC: process.env.TWILIO_NUMBER_QC,
  SK: process.env.TWILIO_NUMBER_SK,
  YT: process.env.TWILIO_NUMBER_YT,
};

function getProvinceFromNumber(phoneNumber) {
  const digits = phoneNumber.replace(/\D/g, '');
  const areaCode = parseInt(digits.startsWith('1') ? digits.slice(1, 4) : digits.slice(0, 3));
  return AREA_CODE_TO_PROVINCE[areaCode] || null;
}

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
app.post('/api/voice', async (req, res) => {
  const to = req.body.To;
  const callSid = req.body.CallSid;
  const userId = req.body.UserId || null;
  const province = getProvinceFromNumber(to);
  const callerId = (province && PROVINCE_NUMBERS[province]) || process.env.TWILIO_PHONE_NUMBER;

  // Log the call attempt
  if (callSid) {
    await supabase.from('call_logs').insert({
      user_id: userId,
      to_number: to,
      from_number: callerId,
      province,
      call_sid: callSid,
      status: 'initiated',
    });
  }

  const twiml = new twilio.twiml.VoiceResponse();
  const dial = twiml.dial({ callerId, action: '/api/voice-status' });
  dial.number(to);

  res.type('text/xml');
  res.send(twiml.toString());
});

// Twilio status callback — updates the log when the call ends
app.post('/api/voice-status', async (req, res) => {
  const callSid = req.body.CallSid;
  const status = req.body.DialCallStatus;
  const duration = parseInt(req.body.DialCallDuration) || 0;

  if (callSid) {
    await supabase.from('call_logs')
      .update({ status, duration_seconds: duration })
      .eq('call_sid', callSid);
  }

  res.type('text/xml');
  res.send(new twilio.twiml.VoiceResponse().toString());
});

// Detect province and caller number for a given destination number
app.get('/api/detect-province', (req, res) => {
  const { number } = req.query;
  if (!number) return res.json({ province: null, callerNumber: null });
  const province = getProvinceFromNumber(number);
  const callerNumber = (province && PROVINCE_NUMBERS[province]) || process.env.TWILIO_PHONE_NUMBER;
  res.json({ province, callerNumber });
});

app.get('/', (req, res) => {
  res.send('Twilio Dialer Backend is running ✅');
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});