#!/bin/bash

# Deploy script for FitManager360
# This script should be run on the production server

set -e

echo "🚀 Starting FitManager360 deployment..."

# Configuration
PROJECT_DIR="/opt/fitmanager360"
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"

# Check if project directory exists
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Project directory does not exist: $PROJECT_DIR"
    exit 1
fi

cd $PROJECT_DIR

# Pull latest code
echo "📥 Pulling latest code from repository..."
git pull origin main

# Check if .env.prod exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Environment file not found: $ENV_FILE"
    echo "Please copy .env.prod.example to .env.prod and configure it"
    exit 1
fi

# Load environment variables
source $ENV_FILE

# Login to GitHub Container Registry
echo "🔐 Logging into GitHub Container Registry..."
echo $GITHUB_TOKEN | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin

# Pull latest images
echo "📦 Pulling latest Docker images..."
docker-compose -f $DOCKER_COMPOSE_FILE pull

# Stop services gracefully
echo "🛑 Stopping existing services..."
docker-compose -f $DOCKER_COMPOSE_FILE down --remove-orphans

# Start services
echo "🚀 Starting services..."
docker-compose -f $DOCKER_COMPOSE_FILE up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 30

# Health check
echo "🏥 Performing health checks..."
GATEWAY_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:8081"

# Check API Gateway
if curl -f $GATEWAY_URL/health > /dev/null 2>&1; then
    echo "✅ API Gateway is healthy"
else
    echo "❌ API Gateway health check failed"
    exit 1
fi

# Check Frontend
if curl -f $FRONTEND_URL > /dev/null 2>&1; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend health check failed"
    exit 1
fi

# Clean up old images
echo "🧹 Cleaning up old Docker images..."
docker image prune -af

echo "🎉 Deployment completed successfully!"
echo "🌐 Application is available at:"
echo "   Frontend: http://your-domain.com"
echo "   API: http://your-domain.com/api"
echo "   Monitoring: http://your-domain.com:3005 (Grafana)"
echo "   Metrics: http://your-domain.com:9090 (Prometheus)"
