# Conduit backend — NestJS + Prisma.
# Multi-stage: build with dev deps, ship dist/ + node_modules + prisma/.
FROM node:22-alpine AS builder
WORKDIR /app
# prisma generate reads the datasource URL at build time; a dummy value is
# enough (no database is contacted) and keeps the build hermetic.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build \
    && test -f /app/dist/main.js \
    || (echo 'ERROR: dist/main.js missing after build — check tsconfig.build.json rootDir: src' && exit 1)

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
# .prisma holds the generated client + query engine; both must come from the
# builder stage because npm ci alone never generates them.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
# Matches colossus.yaml backend.port; PORT overrides it at runtime.
ENV PORT=3001
EXPOSE 3001
# migrate deploy is idempotent and re-asserts the schema if the platform's
# migrate Job has not run yet; a failed migration exits non-zero so Kubernetes
# never routes traffic to a pod with a stale schema.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
