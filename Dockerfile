# syntax=docker/dockerfile:1

# One Dockerfile builds all three services. Select the desired image with
# --target client, --target gateway, or --target ai-service.

FROM node:22-alpine AS node-base
WORKDIR /app
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@12.6.0 --activate

FROM node-base AS node-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/client/package.json apps/client/package.json
COPY apps/gateway/package.json apps/gateway/package.json
COPY apps/gateway/prisma/schema.prisma apps/gateway/prisma/schema.prisma
RUN pnpm install --frozen-lockfile

FROM node-deps AS client-build
COPY apps/client apps/client
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG NEXT_PUBLIC_SOCKET_URL=http://localhost:3003
ARG NEXT_PUBLIC_ENCRYPTION_KEY=default-hackathon-key
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV NEXT_PUBLIC_ENCRYPTION_KEY=${NEXT_PUBLIC_ENCRYPTION_KEY}
# Next embeds rewrites in the build manifest; use the Compose service hostname.
ENV GATEWAY_INTERNAL_URL=http://gateway:3003
RUN pnpm --filter client build

FROM node-deps AS gateway-build
COPY apps/gateway apps/gateway
RUN pnpm --filter gateway build

FROM node-base AS client
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3002
ENV GATEWAY_INTERNAL_URL=http://gateway:3003
COPY --from=client-build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=client-build --chown=node:node /app/node_modules ./node_modules
COPY --from=client-build --chown=node:node /app/apps/client/package.json ./apps/client/package.json
COPY --from=client-build --chown=node:node /app/apps/client/next.config.mjs ./apps/client/next.config.mjs
COPY --from=client-build --chown=node:node /app/apps/client/node_modules ./apps/client/node_modules
COPY --from=client-build --chown=node:node /app/apps/client/.next-build ./apps/client/.next-build
COPY --from=client-build --chown=node:node /app/apps/client/public ./apps/client/public
USER node
WORKDIR /app/apps/client
EXPOSE 3002
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3002"]

FROM node-base AS gateway
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3003
COPY --from=gateway-build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=gateway-build --chown=node:node /app/node_modules ./node_modules
COPY --from=gateway-build --chown=node:node /app/apps/gateway/package.json ./apps/gateway/package.json
COPY --from=gateway-build --chown=node:node /app/apps/gateway/node_modules ./apps/gateway/node_modules
COPY --from=gateway-build --chown=node:node /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=gateway-build --chown=node:node /app/apps/gateway/prisma ./apps/gateway/prisma
COPY --from=gateway-build --chown=node:node /app/apps/gateway/src ./apps/gateway/src
USER node
WORKDIR /app/apps/gateway
EXPOSE 3003
CMD ["node", "dist/index.js"]

FROM python:3.12-slim AS ai-service
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FASTEMBED_CACHE_PATH=/opt/fastembed
WORKDIR /app/apps/ai-service
COPY apps/ai-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "from fastembed import TextEmbedding; TextEmbedding(model_name='BAAI/bge-small-en-v1.5', cache_dir='/opt/fastembed')"
COPY apps/ai-service ./
COPY configs /app/configs
EXPOSE 8001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
