FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=4647
ENV VLM_MODEL=claude-sonnet-5-5
ENV SYNTH_LLM_ENABLED=false
ENV AER_ACCOUNT_STATE_FILE=/app/data/leave-balances.json
ENV AER_PENDING_LEAVE_STATE_FILE=/app/data/pending-leave-decisions.json
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY public ./public
RUN mkdir -p /app/data && chown node:node /app/data
USER node
VOLUME ["/app/data"]
EXPOSE 4647
CMD ["node", "dist/index.js"]
