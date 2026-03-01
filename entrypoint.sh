#!/bin/sh
# Ensure the data directory is writable — Railway volumes mount as root,
# which overrides the ownership set during the Docker build.
mkdir -p /app/data
chown nextjs:nodejs /app/data 2>/dev/null || true

exec su-exec nextjs node server.js
