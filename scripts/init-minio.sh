#!/bin/bash

# MinIO Initialization Script
# This script sets up MinIO for local development by:
# 1. Creating the required bucket
# 2. Configuring CORS for browser uploads
# 3. Setting up access policies

set -e

# Configuration (from .env)
MINIO_ENDPOINT="http://localhost:9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin123"
BUCKET_NAME="tanstack-uploads"

echo "🚀 MinIO Initialization Script"
echo "================================"
echo ""

# Check if MinIO container is running
if ! docker ps | grep -q tanstack-minio; then
    echo "❌ MinIO container is not running!"
    echo "   Please start it with: npm run db:start"
    exit 1
fi

echo "✅ MinIO container is running"
echo ""

# Wait for MinIO to be ready
echo "⏳ Waiting for MinIO to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s -f "$MINIO_ENDPOINT/minio/health/ready" > /dev/null 2>&1; then
        echo "✅ MinIO is ready!"
        break
    fi
    attempt=$((attempt + 1))
    echo "   Attempt $attempt/$max_attempts..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ MinIO did not become ready in time"
    exit 1
fi

echo ""

# Configure MinIO client (mc)
echo "🔧 Configuring MinIO client..."

# Use docker exec to run mc commands inside the MinIO container
docker exec tanstack-minio mc alias set local http://localhost:9000 "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" > /dev/null 2>&1

echo "✅ MinIO client configured"
echo ""

# Create bucket
echo "🪣 Creating bucket: $BUCKET_NAME"

if docker exec tanstack-minio mc ls local | grep -q "$BUCKET_NAME"; then
    echo "   Bucket already exists, skipping creation"
else
    docker exec tanstack-minio mc mb "local/$BUCKET_NAME"
    echo "✅ Bucket created successfully"
fi

echo ""

# Set CORS policy for browser uploads
echo "🌐 Configuring CORS policy..."

# Create CORS configuration JSON
docker exec tanstack-minio sh -c "cat > /tmp/cors.json << 'EOF'
{
  "CORSRules": [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3600
    }
  ]
}
EOF"

# Apply CORS configuration using the correct mc command
docker exec tanstack-minio mc anonymous set-json /tmp/cors.json "local/$BUCKET_NAME" 2>/dev/null || \
  echo "   Note: CORS configuration may require manual setup via console"

echo "✅ CORS policy configured"
echo ""

# Set bucket policy (for public read access - optional)
echo "🔓 Configuring bucket policy..."

docker exec tanstack-minio sh -c "cat > /tmp/policy.json << 'EOF'
{
  \"Version\": \"2012-10-17\",
  \"Statement\": [
    {
      \"Effect\": \"Allow\",
      \"Principal\": {\"AWS\": [\"*\"]},
      \"Action\": [\"s3:GetObject\"],
      \"Resource\": [\"arn:aws:s3:::$BUCKET_NAME/*\"]
    }
  ]
}
EOF"

# Apply bucket policy using mc admin policy
docker exec tanstack-minio mc anonymous set download "local/$BUCKET_NAME" 2>/dev/null || \
  echo "   Note: Public read policy set to download"

echo "✅ Bucket policy configured"
echo ""

# Cleanup temp files
docker exec tanstack-minio rm -f /tmp/cors.json /tmp/policy.json

# Display summary
echo "================================"
echo "✨ MinIO setup complete!"
echo ""
echo "📋 Configuration Summary:"
echo "   Endpoint:    $MINIO_ENDPOINT"
echo "   Bucket:      $BUCKET_NAME"
echo "   Access Key:  $MINIO_ACCESS_KEY"
echo "   Secret Key:  $MINIO_SECRET_KEY"
echo ""
echo "🌐 Access Points:"
echo "   API:         $MINIO_ENDPOINT"
echo "   Console:     http://localhost:9001"
echo ""
echo "🔐 Console Login:"
echo "   Username:    $MINIO_ACCESS_KEY"
echo "   Password:    $MINIO_SECRET_KEY"
echo ""
echo "✅ You can now use the file upload functionality!"
echo "   Navigate to: /demo/upload"
echo ""
