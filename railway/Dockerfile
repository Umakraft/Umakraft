# ── Stage 1: deps ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /usr/src/app

# Install production dependencies only.
# package-lock.json generated inside Replit has resolved URLs pointing to the
# Replit-internal package firewall (package-firewall.replit.local) which is
# unreachable outside Replit.  Rewrite those URLs to the public npm registry
# before running npm ci so Railway can download the packages.
COPY package*.json ./
RUN sed -i 's|https\?://package-firewall\.replit\.local/npm/|https://registry.npmjs.org/|g' package-lock.json \
    && npm ci --omit=dev --registry=https://registry.npmjs.org

# ── Stage 2: release ──────────────────────────────────────────────────────────
FROM node:20-alpine AS release

WORKDIR /usr/src/app

# Copy installed deps from previous stage
COPY --from=deps /usr/src/app/node_modules ./node_modules

# Copy application source
COPY . .

# ── Entrypoint ─────────────────────────────────────────────────────────────────
# Validates required environment variables before starting the server.
# Set these in Railway: Service → Variables
#
#   DISCORD_BOT_TOKEN         Discord bot token
#   DISCORD_APPLICATION_ID    Discord application / client ID
#   DISCORD_GUILD_ID          Discord server / guild ID
#   DISCORD_PUBLIC_KEY        Ed25519 public key for webhook signature verification
#   UMA_MOE_API_KEY           Uma.moe API key (generate at uma.moe account settings)
COPY railway/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# ── Runtime defaults ───────────────────────────────────────────────────────────
ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
