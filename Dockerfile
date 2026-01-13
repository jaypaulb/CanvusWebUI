# CanvusWebUI - Standalone Container
# Designed to run alongside Canvus Server containers, sharing SSL certs

FROM node:20-alpine

LABEL maintainer="MultiTaction"
LABEL description="Web UI for Canvus API - file uploads, notes, and widget macros"

WORKDIR /app

# Install dependencies first (layer caching)
COPY webui/package*.json ./
RUN npm ci --only=production

# Copy application code
COPY webui/ ./

# Create uploads directory
RUN mkdir -p uploads

# Default port (can be overridden)
ENV PORT=8443

# Expose the port
EXPOSE 8443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || \
        wget --no-verbose --tries=1 --spider --no-check-certificate https://localhost:${PORT}/ || exit 1

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs && \
    chown -R nodejs:nodejs /app
USER nodejs

CMD ["node", "server.js"]
