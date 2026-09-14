# syntax=docker/dockerfile:1

# ---------- stage 1: build the static bundle ----------
FROM node:20-alpine AS build
WORKDIR /app

# Dependencies first so this layer is cached between source edits
COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

# ---------- stage 2: serve it ----------
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="MPU Workstation" \
      org.opencontainers.image.description="Interactive 8085 / 8086 microprocessor workstation and execution debugger" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.licenses="MIT"

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
