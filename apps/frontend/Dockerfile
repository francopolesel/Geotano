# ─── Geotano Frontend ──────────────────────────────────────────────────────
# Production build served via Nginx.

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN corepack enable && pnpm run build --filter=@geotano/frontend

# ---- Stage 2: Serve ----
FROM nginx:stable-alpine AS runner
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY --from=builder /app/apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
