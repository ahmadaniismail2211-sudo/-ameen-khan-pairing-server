// Ameen Khan — real WhatsApp pairing-code backend (Baileys)
// Run: npm install && node server.js
// Endpoints:
//   GET  /health          -> { ok: true, name: "Ameen Khan" }
//   GET  /servers         -> [{ id: "ameen-1", name: "Ameen Khan Server 1", status: "online" }]
//   POST /pairing-code    -> { code: "XXXX-XXXX" }  body: { "number": "923001234567" }
//   GET  /status/:number  -> { connected: true/false } (best-effort, in-memory only)
//
// IMPORTANT: this is a minimal pairing server, not a full bot. After the user
// enters the code in WhatsApp > Linked devices > Link with phone number,
// Baileys reports the connection. Keep this server running on Render/Railway
// (a long-running Node host). Do NOT deploy it to Vercel serverless —
// Baileys needs a persistent WebSocket connection.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const sessions = new Map(); // number -> { connected: boolean, code: string|null }

function cleanNumber(raw) {
  return String(raw || '').replace(/\D/g, '');
}

app.get('/health', (req, res) => {
  res.json({ ok: true, name: 'Ameen Khan', service: 'pairing-server' });
});

app.get('/servers', (req, res) => {
  res.json([
    { id: 'ameen-1', name: 'Ameen Khan Server 1', status: 'online' },
  ]);
});

app.get('/status/:number', (req, res) => {
  const number = cleanNumber(req.params.number);
  const s = sessions.get(number);
  res.json({ number, connected: Boolean(s && s.connected), code: s ? s.code : null });
});

app.post('/pairing-code', async (req, res) => {
  const number = cleanNumber(req.body && req.body.number);
  if (!number || number.length < 10 || number.length > 15) {
    return res.status(400).json({ error: 'Enter a valid WhatsApp number with country code, digits only, no + or 00.' });
  }
  if (sessions.get(number)?.connected) {
    return res.json({ code: sessions.get(number).code, connected: true, message: 'Already paired.' });
  }

  const authDir = path.join(__dirname, 'auth', number);
  fs.mkdirSync(authDir, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: require('pino')({ level: 'silent' }),
      browser: ['Ameen Khan', 'Chrome', '1.0'],
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === 'open') {
        sessions.set(number, { connected: true, code: sessions.get(number)?.code || null });
      }
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
          // Session ended; clear so a fresh code can be requested.
          sessions.delete(number);
        } else {
          sessions.delete(number);
        }
      }
    });

    // Give the socket time to initialise and connect to WhatsApp, then
    // request the code. Retry a few times: on a fresh host the first
    // request can fail with "Connection Closed" before the socket is ready.
    let code = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= 3 && !code; attempt++) {
      try {
        await new Promise((r) => setTimeout(r, attempt === 1 ? 3000 : 5000));
        if (sock.authState.creds.registered) {
          sessions.set(number, { connected: true, code: null });
          return res.json({ connected: true, message: 'This number is already paired with Ameen Khan.' });
        }
        code = await sock.requestPairingCode(number);
      } catch (e) {
        lastErr = e;
        console.error(`pairing attempt ${attempt} failed`, e && e.message);
      }
    }
    if (!code) throw lastErr || new Error('Could not generate a pairing code');
    sessions.set(number, { connected: false, code });

    // Keep the socket alive for 3 minutes so the user can enter the code.
    // After that, close it; the auth files remain for a reconnect.
    setTimeout(() => { try { sock.end(); } catch (_) {} }, 3 * 60 * 1000);

    return res.json({ code, number });
  } catch (err) {
    console.error('pairing error', err);
    return res.status(500).json({ error: 'Could not generate a pairing code. Check the server logs and try again in a minute.' });
  }
});

app.listen(PORT, () => {
  console.log(`Ameen Khan pairing server running on port ${PORT}`);
});
