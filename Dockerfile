# ── Stage 1: Install dependencies ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Install build tools needed by better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build the Next.js app ─────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.ts must have output: "standalone" for this to work
RUN npm run build

# ── Stage 3: Production runner ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create the data directory (SQLite lives here, mounted as a volume)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
