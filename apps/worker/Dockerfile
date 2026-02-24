FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

RUN npm install --workspace=packages/shared --workspace=apps/worker --ignore-scripts

COPY packages/shared ./packages/shared
RUN npm run build --workspace=packages/shared

COPY apps/worker ./apps/worker
RUN npm run build --workspace=apps/worker

CMD ["node", "apps/worker/dist/index.js"]
