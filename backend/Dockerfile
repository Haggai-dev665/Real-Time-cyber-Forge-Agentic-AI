# CyberForge backend, for docker-compose.yml at the repository root.
#
# NOT RUN YET: this file was written on a machine without Docker. Its inputs
# are checked by a test (backend/tests/contracts/compose.test.js); the image
# itself has not been built. Treat the first build as the test.
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY public ./public
COPY appwrite.config.json ./

# The logger writes to ./logs; the process does not run as root.
RUN mkdir -p logs && chown -R node:node logs
USER node

EXPOSE 8000
CMD ["node", "src/server.js"]
