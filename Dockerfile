# ==========================================
# Multi-stage Dockerfile for LINE Ads Bot
# ==========================================

# 1. 編譯階段
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src
RUN npm run build

# 2. 執行階段 (極小化映像檔)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
