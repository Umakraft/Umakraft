# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /usr/src/app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: release ──────────────────────────────────────────────────────────
FROM node:20-alpine AS release

WORKDIR /usr/src/app

# Copy installed deps from previous stage
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy application source
COPY . .

# ── Runtime environment variables ─────────────────────────────────────────────
# These must be set in Railway's service Variables tab.
# Railway injects them at runtime; do NOT hardcode values here.

ENV NODE_ENV=production \
    PORT=3000

# Required — Railway will surface errors at deploy time if these are missing.
# Set them under: Railway project → Service → Variables
#
#   DISCORD_BOT_TOKEN         Discord bot token
#   DISCORD_APPLICATION_ID    Discord application / client ID
#   DISCORD_GUILD_ID          Discord server / guild ID
#   DISCORD_PUBLIC_KEY        Ed25519 public key for webhook signature verification
#   UMAMOE_API_URL            Uma.moe API base URL (default: https://uma.moe/api)

EXPOSE 3000

CMD ["node", "server.js"]
