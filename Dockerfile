# syntax=docker/dockerfile:1

# One Dockerfile builds all three services. Select the desired image with
# --target client, --target gateway, or --target ai-service.

FROM node:22-alpine AS node-deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/client/package.json apps/client/package.json
COPY apps/gateway/package.json apps/gateway/package.json
RUN pnpm install --frozen-lockfile

FROM node-deps AS node-build
COPY apps/client apps/client
COPY apps/gateway apps/gateway
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:3001
ENV NEXT_PUBLIC_GATEWAY_URL=${NEXT_PUBLIC_GATEWAY_URL}
RUN pnpm --filter client build && pnpm --filter gateway build

FROM node:22-alpine AS client
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable
COPY --from=node-build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=node-build --chown=node:node /app/node_modules ./node_modules
COPY --from=node-build --chown=node:node /app/apps/client/package.json ./apps/client/package.json
COPY --from=node-build --chown=node:node /app/apps/client/node_modules ./apps/client/node_modules
COPY --from=node-build --chown=node:node /app/apps/client/.next ./apps/client/.next
COPY --from=node-build --chown=node:node /app/apps/client/public ./apps/client/public
USER node
EXPOSE 3000
CMD ["pnpm", "--filter", "client", "start"]

FROM node:22-alpine AS gateway
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
RUN corepack enable
COPY --from=node-build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=node-build --chown=node:node /app/node_modules ./node_modules
COPY --from=node-build --chown=node:node /app/apps/gateway/package.json ./apps/gateway/package.json
COPY --from=node-build --chown=node:node /app/apps/gateway/node_modules ./apps/gateway/node_modules
COPY --from=node-build --chown=node:node /app/apps/gateway/dist ./apps/gateway/dist
USER node
EXPOSE 3001
CMD ["pnpm", "--filter", "gateway", "start"]

FROM python:3.12-slim AS ai-service
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
WORKDIR /app/apps/ai-service
COPY apps/ai-service/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/ai-service ./
COPY configs /app/configs
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
