FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm install --workspace=packages/shared --workspace=apps/web --ignore-scripts

FROM node:20-alpine AS builder
WORKDIR /app

# Build-time env vars (NEXT_PUBLIC_* are baked into the bundle by Next.js)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
RUN npm run build --workspace=packages/shared
COPY apps/web ./apps/web
RUN npm run build --workspace=apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone output mirrors the monorepo directory structure:
# /app/node_modules/ (traced deps), /app/apps/web/server.js, /app/apps/web/.next/
COPY --from=builder /app/apps/web/.next/standalone ./
# Static assets need to be placed where standalone server expects them
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
# Run from the monorepo root; server.js in standalone lives at apps/web/server.js
CMD ["node", "apps/web/server.js"]
