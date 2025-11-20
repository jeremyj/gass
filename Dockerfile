FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Create app user for security
RUN addgroup -g 1001 -S gass && \
    adduser -S -u 1001 -G gass gass

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY --chown=gass:gass . .

# Create data directory for SQLite database
RUN mkdir -p /app/data && \
    chown -R gass:gass /app/data

# Switch to non-root user
USER gass

# Expose application port
EXPOSE 3000

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "server.js"]
