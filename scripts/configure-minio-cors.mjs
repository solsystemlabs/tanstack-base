#!/usr/bin/env node

/**
 * Configure MinIO CORS using AWS SDK
 *
 * This script properly configures CORS for the MinIO bucket
 * to allow browser-based uploads.
 */

import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3'

const BUCKET_NAME = 'tanstack-uploads'

const s3Client = new S3Client({
  endpoint: 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'minioadmin',
    secretAccessKey: 'minioadmin123',
  },
  forcePathStyle: true,
})

const corsConfiguration = {
  CORSRules: [
    {
      AllowedOrigins: ['*'],
      AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      AllowedHeaders: ['*'],
      ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type', 'x-amz-request-id'],
      MaxAgeSeconds: 3600,
    },
  ],
}

async function configureCORS() {
  try {
    console.log('🌐 Configuring CORS for MinIO bucket...')
    console.log(`   Bucket: ${BUCKET_NAME}`)

    const command = new PutBucketCorsCommand({
      Bucket: BUCKET_NAME,
      CORSConfiguration: corsConfiguration,
    })

    await s3Client.send(command)

    console.log('✅ CORS configuration applied successfully!')
    console.log('')
    console.log('CORS Rules:')
    console.log('  - Allowed Origins: *')
    console.log('  - Allowed Methods: GET, PUT, POST, DELETE, HEAD')
    console.log('  - Allowed Headers: *')
    console.log('  - Exposed Headers: ETag, Content-Length, Content-Type, x-amz-request-id')
    console.log('  - Max Age: 3600 seconds')
    console.log('')
    console.log('✨ Your MinIO bucket is now ready for browser uploads!')

  } catch (error) {
    console.error('❌ Failed to configure CORS:', error.message)
    process.exit(1)
  }
}

configureCORS()
