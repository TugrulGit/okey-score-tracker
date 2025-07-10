# infra/Dockerfile
# syntax=docker/dockerfile:1

############################
# 1️⃣  Dependencies layer  #
############################
FROM node:20-alpine AS deps
WORKDIR /app

# ① copy only manifests for maximum cache-hit
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json            ./apps/web/
COPY packages/ui-kit/package.json     ./packages/ui-kit/
COPY packages/domain/package.json     ./packages/domain/

# ② install all workspace deps (dev + prod)
RUN corepack enable && pnpm install --frozen-lockfile


############################
# 2️⃣  Build layer          #
############################
FROM deps AS builder
COPY . .

# ③ build ui-kit **first** so web can import its compiled JS
RUN pnpm --filter ui-kit build && \
    pnpm --filter web   build


############################
# 3️⃣  Runtime layer        #
############################
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# ④ copy production-only node_modules
COPY --from=deps /app/node_modules ./node_modules

# ⑤ copy built Next.js bundle & public assets
COPY --from=builder /app/apps/web/.next   ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./package.json

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]