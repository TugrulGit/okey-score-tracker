# infra/Dockerfile
# syntax=docker/dockerfile:1

############################
# 1) deps – install workspace
############################
FROM node:20-alpine AS deps
WORKDIR /repo

# copy manifest and lock files first for maximum cache hits
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json            ./apps/web/
COPY packages/ui-kit/package.json     ./packages/ui-kit/
COPY packages/domain/package.json     ./packages/domain/

# ENV pnpm_config_node_linker=hoisted
RUN corepack enable \
 && pnpm install --frozen-lockfile

############################
# 2) builder – compile sources
############################
FROM deps AS builder
COPY . .

# build ui-kit first, then web (depends on ui-kit/dist)
RUN pnpm --filter ui-kit build \
 && pnpm --filter web build 

############################
# 3) web-deps – production deps inside apps/web
############################
# FROM node:20-alpine AS web-deps
# WORKDIR /repo/apps/web

# # install prod dependencies scoped to apps/web
# COPY apps/web/package.json            ./package.json
# COPY pnpm-lock.yaml pnpm-workspace.yaml ../../

# RUN corepack enable \
#  && pnpm install --prod --frozen-lockfile --filter ./ --shamefully-hoist \ 
#  && rm -rf ../../.pnpm-store

############################
# 4) runner – final image
############################
FROM node:20-alpine AS runner
# USER root
WORKDIR /app
ENV NODE_ENV=production

# a) application-local node_modules
# COPY --from=web-deps /repo/apps/web/node_modules /app/node_modules
# COPY --from=deps /repo/node_modules/.pnpm /app/node_modules/.pnpm
# COPY --from=web-deps /repo/apps/web/node_modules/next /app/node_modules/next
# COPY --from=web-deps /repo/apps/web/node_modules/.bin /app/node_modules/.bin
# COPY --from=web-deps /repo/apps/web/node_modules/next/dist /app/node_modules/next/dist
# COPY --from=web-deps /repo/apps/web/node_modules/next/package.json /app/node_modules/next/package.json


# b) compiled Next.js bundle and static assets
# COPY --from=builder /repo/apps/web/.next ./.next
COPY --from=builder /repo/apps/web/public ./public
COPY --from=builder /repo/apps/web/.next/standalone/. ./



# c) minimal package.json for runtime
# COPY apps/web/package.json ./package.json

EXPOSE 3000
# CMD ["node", "/app/.next/standalone/apps/web/server.js"]
CMD ["node", "apps/web/server.js"]