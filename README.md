# Ameen Khan — WhatsApp Pairing Server

This is the real backend for the Ameen Khan pairing website. The website alone
cannot create a real WhatsApp pairing code — only this running Node server can,
using Baileys (the WhatsApp Web protocol).

## Deploy (free, Render)

1. Push this folder to GitHub, or upload it to Render as a Web Service.
2. On Render: **New > Web Service**, Node, Build Command `npm install`, Start Command `npm start`.
3. Wait until it shows Live, then open `https://YOUR-SERVICE.onrender.com/health`
   — it should show `{"ok":true,"name":"Ameen Khan",...}`.
4. On the Ameen Khan website, open **Backend URL** settings and paste:
   `https://YOUR-SERVICE.onrender.com`
   Then Generate a pairing code — the code shown will be a real one.

## Run locally

```
npm install
node server.js
```

Then the website's Backend URL is `http://localhost:3000`.

## How pairing works

1. Visitor enters their WhatsApp number (country code, digits only).
2. The website calls `POST /pairing-code` on this server.
3. The server asks WhatsApp for a pairing code for that number and returns it.
4. The visitor opens WhatsApp > Linked devices > Link with phone number and
   enters the code. When it connects, the website marks pairing successful
   and plays "Ja Tujhe Maaf Kiya".

## Notes

- Keep the `auth/` folder on the server — it holds the paired session.
- Do not share your server URL publicly if you do not want strangers using it.
- This uses the unofficial Baileys library, not Meta's official WhatsApp Cloud
  API. WhatsApp may restrict numbers that link unofficial bots.
