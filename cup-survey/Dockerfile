FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund && npx prisma generate

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
ARG RELEASE_ID
ARG GIT_SHA
ENV CUP_RELEASE_ID=${RELEASE_ID}
ENV CUP_GIT_SHA=${GIT_SHA}
RUN npm run build

FROM base AS runner
ARG RELEASE_ID
ARG GIT_SHA
LABEL org.opencontainers.image.version="${RELEASE_ID}"
LABEL cup.release_id="${RELEASE_ID}"
LABEL cup.git_sha="${GIT_SHA}"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV CUP_RELEASE_ID=${RELEASE_ID}
ENV CUP_GIT_SHA=${GIT_SHA}

RUN apk add --no-cache su-exec wget \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=5s --retries=12 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]

FROM deps AS migrate
ARG RELEASE_ID
ARG GIT_SHA
LABEL org.opencontainers.image.version="${RELEASE_ID}"
LABEL cup.release_id="${RELEASE_ID}"
LABEL cup.git_sha="${GIT_SHA}"
CMD ["npx", "prisma", "migrate", "deploy", "--schema=./prisma/schema.prisma"]
