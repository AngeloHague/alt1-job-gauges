FROM node:22-bookworm-slim AS build
WORKDIR /app

# Sharp 0.34 needs its platform-specific optional packages during webpack builds.
COPY package.json package-lock.json ./
RUN npm ci --include=dev --include=optional

COPY tsconfig.json webpack.config.js ./
COPY src ./src
RUN npm run build -- --mode production

# Job Gauges is a static ALT1 webpage; no Node process or database is needed here.
FROM nginx:stable-alpine AS runtime
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/appconfig.json || exit 1
