# Playwright base image — browser + deps preinstalled, version pinned to
# match package.json's playwright so the bundled Chromium is the right one.
FROM mcr.microsoft.com/playwright:v1.49.1-noble

WORKDIR /xsnap
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY snap.mjs ./

# /data holds x-state.json (the logged-in session) — a compose volume.
CMD ["node", "snap.mjs"]
