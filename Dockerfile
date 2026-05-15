FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

CMD ["sh", "-c", "pnpm tsx src/db/migrate.ts && pnpm tsx src/index.ts"]
