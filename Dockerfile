# --- Build stage ---
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc

# --- Production stage ---
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# Create uploads directory
RUN mkdir -p public/uploads

EXPOSE 5000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
