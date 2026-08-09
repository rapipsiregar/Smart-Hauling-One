# syntax=docker/dockerfile:1

# --- deps: install dependencies from the Bun lockfile -----------------------
FROM oven/bun:1-alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./

# `next build` needs the devDependencies (typescript, tailwind, eslint-config),
# so they cannot simply be skipped -- but installing them drags in puppeteer,
# whose postinstall downloads a Chromium build and fails the image build outright
# when the network will not serve it. Nothing here imports puppeteer; it is a
# test-only dependency, and the browser it wants is never used in this image.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN bun install --frozen-lockfile

# --- builder: compile the Next.js standalone production build --------------
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# BACKEND_ORIGIN feeds next.config.ts's rewrites(), which Next.js resolves at
# `next build` time (baked into .next/routes-manifest.json). It must be
# supplied as a build arg, not just a runtime env var, to take effect.
ARG BACKEND_ORIGIN=http://127.0.0.1:8000
ENV BACKEND_ORIGIN=$BACKEND_ORIGIN

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# --- runner: minimal production image ---------------------------------------
FROM oven/bun:1-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["bun", "server.js"]
