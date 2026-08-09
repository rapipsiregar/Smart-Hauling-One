FROM node:22-slim AS deps
WORKDIR /srv
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM node:22-slim AS build
WORKDIR /srv

# next.config.ts's rewrites() are resolved by `next build` and baked into
# .next/routes-manifest.json, so this has to be a build arg. Passing it only as a
# runtime env var leaves the UI proxying to the default localhost:8100 -- which
# inside a container is the container itself, not the edge backend.
ARG EDGE_BACKEND_ORIGIN=http://127.0.0.1:8100
ENV EDGE_BACKEND_ORIGIN=$EDGE_BACKEND_ORIGIN

COPY --from=deps /srv/node_modules ./node_modules
COPY . ./
RUN npx next build

FROM node:22-slim AS run
WORKDIR /srv
ENV NODE_ENV=production
# The standalone server defaults to 3000 and would ignore EXPOSE entirely.
ENV HOSTNAME=0.0.0.0 PORT=3100
COPY --from=build /srv/.next/standalone ./
COPY --from=build /srv/.next/static ./.next/static
EXPOSE 3100
CMD ["node", "server.js"]
