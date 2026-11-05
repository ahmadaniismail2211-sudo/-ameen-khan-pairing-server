# Baileys 6.7 needs Node 20+ (it uses globalThis.crypto.subtle).
# Pin Node 20 so hosts that default to an older Node don't crash on startup.
FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
