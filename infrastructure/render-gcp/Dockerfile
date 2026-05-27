# --- Stage 1: Build the TypeScript codebase ---
FROM node:20-slim AS builder
WORKDIR /app

# Copy package configurations and install ALL dependencies
COPY package*.json ./
RUN npm ci

# Copy tsconfig and source files
COPY tsconfig.json ./
COPY types ./types
COPY *.ts ./

# Compile TypeScript to JavaScript
RUN npx tsc

# --- Stage 2: Production execution environment ---
FROM node:20-slim
WORKDIR /app

# 1. Install FFmpeg and FFprobe system packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# 2. Verify FFmpeg installation
RUN ffmpeg -version && ffprobe -version

# 3. Copy production package configs and install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# 4. Copy compiled files from builder stage
COPY --from=builder /app/dist ./dist

# 5. Copy static assets (bundled font)
COPY assets ./assets

# Expose container port (Cloud Run defaults to 8080)
EXPOSE 8080

# Environment variables defaults
ENV PORT=8080
ENV NODE_ENV=production

# Start Express server
CMD ["node", "dist/server.js"]
