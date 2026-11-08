# TaskNet web app: built with Vite, served by nginx.
# Build context is clients/ (the app compiles ../shared straight from source):
#   docker build -f clients/web/Dockerfile clients

# ── Build ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY shared /app/shared
COPY web /app/web
# Optional: a fixed API address. Empty = the gateway on port 8000 of the host
# the page was opened from (works for localhost and for phones on the LAN).
ARG VITE_API_BASE=
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# ── Serve ────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
