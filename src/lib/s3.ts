import { S3Client } from '@aws-sdk/client-s3'

/**
 * S3 Client Configuration
 *
 * This module provides an S3-compatible client that works with both:
 * - MinIO (local development)
 * - Cloudflare R2 (production)
 *
 * Configuration is pulled from environment variables:
 * - S3_ENDPOINT: The S3 endpoint URL
 * - S3_ACCESS_KEY_ID: Access key for authentication
 * - S3_SECRET_ACCESS_KEY: Secret key for authentication
 * - S3_REGION: AWS region (use 'auto' for R2)
 * - S3_BUCKET: Default bucket name
 * - S3_FORCE_PATH_STYLE: Whether to use path-style URLs (required for MinIO)
 */

// Validate required environment variables
const requiredEnvVars = [
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
  'S3_BUCKET',
  'S3_REGION',
]

const missingVars = requiredEnvVars.filter(
  (varName) => !process.env[varName]
)

if (missingVars.length > 0) {
  console.warn(
    `Missing S3 environment variables: ${missingVars.join(', ')}. ` +
      'File upload functionality will not work until these are configured.'
  )
}

/**
 * Create and configure the S3 client
 *
 * Configuration details:
 * - endpoint: Custom endpoint for MinIO or R2
 * - region: AWS region or 'auto' for R2
 * - credentials: Access key and secret
 * - forcePathStyle: Required for MinIO, optional for R2
 */
export function createS3Client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT
  const region = process.env.S3_REGION || 'us-east-1'
  const accessKeyId = process.env.S3_ACCESS_KEY_ID
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true'

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3 configuration is incomplete. Please check your environment variables.'
    )
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // Force path-style URLs for MinIO compatibility
    // MinIO requires: http://localhost:9000/bucket/key
    // vs virtual-hosted style: http://bucket.localhost:9000/key
    forcePathStyle,
  })
}

/**
 * Get the configured S3 bucket name
 */
export function getS3Bucket(): string {
  const bucket = process.env.S3_BUCKET
  if (!bucket) {
    throw new Error('S3_BUCKET environment variable is not set')
  }
  return bucket
}

/**
 * Get the configured S3 region
 */
export function getS3Region(): string {
  return process.env.S3_REGION || 'us-east-1'
}

/**
 * Get the S3 endpoint URL
 */
export function getS3Endpoint(): string {
  const endpoint = process.env.S3_ENDPOINT
  if (!endpoint) {
    throw new Error('S3_ENDPOINT environment variable is not set')
  }
  return endpoint
}

/**
 * Check if S3 is properly configured
 */
export function isS3Configured(): boolean {
  return requiredEnvVars.every((varName) => !!process.env[varName])
}

/**
 * Generate a unique S3 key for a file
 *
 * @param filename - Original filename
 * @param prefix - Optional prefix for organizing files (e.g., 'uploads/', 'models/')
 * @returns A unique S3 key
 */
export function generateS3Key(filename: string, prefix: string = 'uploads/'): string {
  const timestamp = Date.now()
  const randomStr = Math.random().toString(36).substring(2, 15)
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_')

  return `${prefix}${timestamp}-${randomStr}-${sanitizedFilename}`
}

/**
 * Get the public URL for an S3 object
 * Note: This assumes the bucket has public read access configured.
 * For private files, use presigned URLs instead.
 *
 * @param key - The S3 object key
 * @returns The public URL for the object
 */
export function getPublicUrl(key: string): string {
  const endpoint = getS3Endpoint()
  const bucket = getS3Bucket()
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true'

  if (forcePathStyle) {
    // Path-style URL: http://endpoint/bucket/key
    return `${endpoint}/${bucket}/${key}`
  } else {
    // Virtual-hosted style: http://bucket.endpoint/key
    const url = new URL(endpoint)
    return `${url.protocol}//${bucket}.${url.host}/${key}`
  }
}

// Export a singleton instance
export const s3Client = createS3Client()
