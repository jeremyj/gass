# Stage 1: Build — compile native modules (bcrypt, better-sqlite3)
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: Runtime — clean Alpine image without build tools (~200MB smaller)
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S gass && \
    adduser -S -u 1001 -G gass gass

WORKDIR /app

# Copy built node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY --chown=gass:gass . .

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    chown -R gass:gass /app/data

USER gass

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
