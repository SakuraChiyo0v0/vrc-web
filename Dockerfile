# ── 构建前端 ───────────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /web
COPY web/package*.json ./
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build

# ── 运行镜像 ───────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8790 \
    VRC_WEB_DIST=/app/web/dist

COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server/src ./src
COPY --from=web /web/dist ./web/dist

EXPOSE 8790
CMD ["sh", "-c", "node src/index.js & exec node src/collector.js"]
