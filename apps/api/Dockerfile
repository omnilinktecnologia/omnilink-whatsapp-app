FROM node:20-alpine AS base
WORKDIR /app

# Copy workspace manifests
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all deps (workspace aware)
RUN npm install --workspace=packages/shared --workspace=apps/api --ignore-scripts

# Build shared
COPY packages/shared ./packages/shared
RUN npm run build --workspace=packages/shared

# Build API
COPY apps/api ./apps/api
RUN npm run build --workspace=apps/api

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
