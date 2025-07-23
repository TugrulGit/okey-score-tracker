# infra/api.Dockerfile
# syntax=docker/dockerfile:1

############################
# 1  Build stage          #
############################
FROM node:20-alpine AS builder
WORKDIR /repo

# 1. Copy workspace manifests only (keeps npm-install cacheable)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json                ./
COPY apps/api/package.json  apps/api/nest-cli.json apps/api/tsconfig.json      ./apps/api/
COPY packages/domain/package.json                                              ./packages/domain/

# 2. Install dependencies
#    - "pnpm install" will install all dependencies in the workspace
#    - "corepack enable" ensures pnpm is used as the package manager
#    - "--frozen-lockfile" ensures the lockfile is not modified
#    - "--prod" installs only production dependencies
#    - "-node-linker=hoisted" ensures all dependencies are hoisted to the root node_modules
#      (this is necessary for ESM compatibility in NestJS)
RUN corepack enable \
&& pnpm install --frozen-lockfile --prod -node-linker=hoisted


# 2. Copy full source and build the NestJS API
COPY . .
#    - "pnpm --filter api" targets the package whose "name" is simply "api"
RUN pnpm --filter api run build
#  && pnpm --filter api run prisma:generate

############################
# 2  Runtime stage        #
############################
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 3. Production-only node_modules
COPY --from=builder /repo/node_modules ./api/node_modules

# 4. Compiled output
COPY --from=builder /repo/apps/api/. /app/api/
# COPY --from=builder /repo/apps/api/package.json ./package.json

EXPOSE 4000
# ENTRYPOINT [ "sh", "-c", "trap : TERM INT; sleep infinity & wait" ]
CMD ["node", "./api/dist/main.js"]