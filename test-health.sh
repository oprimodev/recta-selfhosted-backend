#!/bin/bash
# Test script to verify health check works

echo "🧪 Testing health check..."

# Start server in background
echo "📡 Starting server..."
PORT=3001 npm start > server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# Test health check
echo "🔍 Testing /health endpoint..."
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)

if [ "$HEALTH_RESPONSE" = "200" ]; then
    echo "✅ Health check PASSED! (Status: $HEALTH_RESPONSE)"
    curl -s http://localhost:3001/health | jq .
    kill $SERVER_PID
    exit 0
else
    echo "❌ Health check FAILED! (Status: $HEALTH_RESPONSE)"
    echo "📋 Server logs:"
    cat server.log
    kill $SERVER_PID
    exit 1
fi

