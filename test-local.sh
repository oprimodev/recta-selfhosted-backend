#!/bin/bash
set -e

echo "🧪 Testing local server startup and health check..."

# Clean previous builds
echo "🧹 Cleaning..."
rm -rf dist

# Build
echo "🔨 Building..."
npm run build

# Start server in background with minimal env vars
echo "📡 Starting server..."
PORT=3001 \
DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" \
STRIPE_SECRET_KEY="sk_test_dummy" \
FIREBASE_PROJECT_ID="dummy" \
FIREBASE_CLIENT_EMAIL="dummy@dummy.com" \
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ndummy\n-----END PRIVATE KEY-----\n" \
NODE_ENV=development \
npm start > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start (10 seconds)..."
sleep 10

# Test health check
echo "🔍 Testing /health endpoint..."
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health || echo "000")

if [ "$HEALTH_CODE" = "200" ]; then
    echo "✅ Health check PASSED! (Status: $HEALTH_CODE)"
    echo "📋 Health check response:"
    curl -s http://localhost:3001/health | head -5
    echo ""
    echo "📋 Server logs (last 20 lines):"
    tail -20 server.log
    kill $SERVER_PID 2>/dev/null || true
    exit 0
else
    echo "❌ Health check FAILED! (Status: $HEALTH_CODE)"
    echo "📋 Server logs:"
    cat server.log
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

