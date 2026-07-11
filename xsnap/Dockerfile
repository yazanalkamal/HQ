# Chromium ONLY — the official playwright image also ships Firefox and
# WebKit (~2GB). The VPS disk writes at ~15 MB/s, so unpacking those for
# nothing was real minutes of grinding. This lands around a third of that.
FROM node:22-bookworm-slim

WORKDIR /xsnap
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npx playwright install --with-deps chromium \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*

COPY snap.mjs ./

# /data holds x-state.json (the logged-in session) — a compose volume.
CMD ["node", "snap.mjs"]
