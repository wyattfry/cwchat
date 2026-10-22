# CW Contact: a static Vite build served by nginx on port 8080.
# Runs as UID 10001 with a read-only root filesystem; nginx writes only to /tmp.

FROM node:22-alpine AS build
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY --chown=node:node . .
RUN npm test && npm run build

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER 10001
EXPOSE 8080
ENTRYPOINT ["/usr/sbin/nginx", "-g", "daemon off;"]
CMD []
