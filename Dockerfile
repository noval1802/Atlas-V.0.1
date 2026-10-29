FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# check-artifact fails the image build if any secret-looking file reached the standalone output.
RUN npx prisma generate && npm run build && node tools/check-artifact.mjs .next/standalone

# One-shot job run by the `osiris-migrate` compose service before the app starts:
# applies pending migrations, then seeds Kotamaops and the bootstrap admin.
# The seed only creates missing rows, so re-running it never overwrites reports.
# Kept out of the runner so the served image carries no Prisma CLI.
FROM node:22-alpine AS migrator
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
RUN npx prisma generate
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.mjs"]

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
