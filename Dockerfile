# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM base AS browser-runtime
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
COPY --from=dependencies /app/node_modules/playwright-core /tmp/playwright-core
RUN node /tmp/playwright-core/cli.js install --with-deps chromium --only-shell \
    && chmod -R a+rX /ms-playwright \
    && rm -rf /tmp/playwright-core /var/lib/apt/lists/*

FROM browser-runtime AS development
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--webpack"]

FROM development AS builder
ENV NEXT_STANDALONE=1
RUN mkdir -p public && npm run build

FROM browser-runtime AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p .next/cache && chown -R node:node .next
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/home',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
