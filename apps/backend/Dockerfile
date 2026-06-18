# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- Prune: isolate the backend workspace + its deps ----
FROM base AS prune
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @cockpitzero/backend --docker

# ---- Install + build ----
FROM base AS build
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ .
RUN pnpm turbo run build --filter=@cockpitzero/backend

# ---- Runtime ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /repo/apps/backend/dist ./dist
COPY --from=build /repo/apps/backend/package.json ./package.json
COPY --from=build /repo/node_modules ./node_modules
USER app
EXPOSE 8787
CMD ["node", "dist/index.js"]
