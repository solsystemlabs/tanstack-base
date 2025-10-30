import { createServerFn } from '@tanstack/react-start'
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type CompletedPart,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3Client, getS3Bucket, generateS3Key } from '../lib/s3'

/**
 * Allowed MIME types for upload
 * Supports: Images, 3D models (.3mf, .stl), and G-code files
 */
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  // 3D Model formats
  'application/vnd.ms-package.3dmanufacturing-3dmodel+xml', // .3mf (official)
  'model/3mf', // .3mf (common browser type)
  'model/stl', // .stl
  'application/sla', // .stl alternative
  'application/vnd.ms-pki.stl', // .stl alternative
  // G-code
  'text/plain', // .gcode files are plain text
  'application/x-gcode', // .gcode
  'text/x-gcode', // .gcode alternative
  // Generic fallbacks
  'application/octet-stream', // Generic binary
]

/**
 * Maximum file size: 1GB
 */
const MAX_FILE_SIZE = 1024 * 1024 * 1024 // 1GB in bytes

/**
 * Minimum part size for multipart upload: 5MB
 * AWS S3 requirement (except for the last part)
 */
const MIN_PART_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * Default part size: 10MB
 * Good balance between number of parts and upload chunk size
 */
const DEFAULT_PART_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * Maximum number of parts in a multipart upload
 * AWS S3 limit
 */
const MAX_PARTS = 10000

/**
 * Presigned URL expiration time (in seconds)
 * 1 hour should be enough for most uploads
 */
const PRESIGNED_URL_EXPIRATION = 3600 // 1 hour

/**
 * Validate file metadata before starting upload
 */
function validateFile(
  filename: string,
  fileSize: number,
  contentType: string
): void {
  // Check file size
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
    )
  }

  if (fileSize <= 0) {
    throw new Error('File size must be greater than 0')
  }

  // Check content type
  if (!ALLOWED_MIME_TYPES.includes(contentType)) {
    throw new Error(
      `Content type "${contentType}" is not allowed. ` +
        `Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    )
  }

  // Check filename
  if (!filename || filename.length === 0) {
    throw new Error('Filename is required')
  }

  if (filename.length > 255) {
    throw new Error('Filename is too long (max 255 characters)')
  }
}

/**
 * Calculate the number of parts needed for a multipart upload
 */
function calculatePartCount(fileSize: number, partSize: number = DEFAULT_PART_SIZE): number {
  return Math.ceil(fileSize / partSize)
}

/**
 * Initiate a multipart upload
 *
 * This server function:
 * 1. Validates the file metadata
 * 2. Creates a unique S3 key
 * 3. Initiates the multipart upload
 * 4. Returns the upload ID and key for subsequent operations
 */
export const initiateMultipartUpload = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    filename: string
    fileSize: number
    contentType: string
    prefix?: string
  }) => data)
  .handler(async ({ data }) => {
    const { filename, fileSize, contentType, prefix } = data

    // Validate file
    validateFile(filename, fileSize, contentType)

    // Calculate optimal part size and count
    const partSize = DEFAULT_PART_SIZE
    const partCount = calculatePartCount(fileSize, partSize)

    // Check if we exceed max parts
    if (partCount > MAX_PARTS) {
      throw new Error(
        `File is too large for multipart upload. ` +
          `Maximum ${MAX_PARTS} parts allowed.`
      )
    }

    // Generate unique S3 key
    const key = generateS3Key(filename, prefix)
    const bucket = getS3Bucket()

    try {
      // Initiate multipart upload
      const command = new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        Metadata: {
          originalFilename: filename,
          uploadedAt: new Date().toISOString(),
        },
      })

      const response = await s3Client.send(command)

      if (!response.UploadId) {
        throw new Error('Failed to initiate multipart upload: No upload ID returned')
      }

      return {
        uploadId: response.UploadId,
        key,
        partSize,
        partCount,
      }
    } catch (error) {
      console.error('Error initiating multipart upload:', error)
      throw new Error(
        `Failed to initiate upload: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })

/**
 * Get a presigned URL for uploading a specific part
 *
 * This server function generates a presigned URL that allows the client
 * to upload a part directly to S3 without going through the server.
 */
export const getUploadPartUrl = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    uploadId: string
    key: string
    partNumber: number
  }) => data)
  .handler(async ({ data }) => {
    const { uploadId, key, partNumber } = data

    // Validate inputs
    if (!uploadId || !key) {
      throw new Error('Upload ID and key are required')
    }

    if (partNumber < 1 || partNumber > MAX_PARTS) {
      throw new Error(`Part number must be between 1 and ${MAX_PARTS}`)
    }

    const bucket = getS3Bucket()

    try {
      // Create command for uploading a part
      const command = new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      })

      // Generate presigned URL
      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: PRESIGNED_URL_EXPIRATION,
      })

      return {
        presignedUrl,
        partNumber,
      }
    } catch (error) {
      console.error('Error generating presigned URL for part:', error)
      throw new Error(
        `Failed to generate upload URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })

/**
 * Complete a multipart upload
 *
 * This server function finalizes the multipart upload by telling S3
 * to assemble all the uploaded parts into a single object.
 */
export const completeMultipartUpload = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    uploadId: string
    key: string
    parts: Array<{ partNumber: number; etag: string }>
  }) => data)
  .handler(async ({ data }) => {
    const { uploadId, key, parts } = data

    // Validate inputs
    if (!uploadId || !key) {
      throw new Error('Upload ID and key are required')
    }

    if (!parts || parts.length === 0) {
      throw new Error('At least one part is required')
    }

    // Validate parts
    const sortedParts = parts
      .map((part) => ({
        PartNumber: part.partNumber,
        ETag: part.etag,
      }))
      .sort((a, b) => a.PartNumber - b.PartNumber)

    // Check for missing part numbers
    for (let i = 0; i < sortedParts.length; i++) {
      if (sortedParts[i].PartNumber !== i + 1) {
        throw new Error(`Missing part number ${i + 1}`)
      }
    }

    const bucket = getS3Bucket()

    try {
      // Complete the multipart upload
      const command = new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: sortedParts,
        },
      })

      const response = await s3Client.send(command)

      return {
        location: response.Location,
        bucket: response.Bucket,
        key: response.Key,
        etag: response.ETag,
      }
    } catch (error) {
      console.error('Error completing multipart upload:', error)
      throw new Error(
        `Failed to complete upload: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })

/**
 * Abort a multipart upload
 *
 * This server function cancels an in-progress multipart upload and
 * cleans up any uploaded parts.
 */
export const abortMultipartUpload = createServerFn({ method: 'POST' })
  .inputValidator((data: {
    uploadId: string
    key: string
  }) => data)
  .handler(async ({ data }) => {
    const { uploadId, key } = data

    // Validate inputs
    if (!uploadId || !key) {
      throw new Error('Upload ID and key are required')
    }

    const bucket = getS3Bucket()

    try {
      // Abort the multipart upload
      const command = new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      })

      await s3Client.send(command)

      return {
        success: true,
        message: 'Upload aborted successfully',
      }
    } catch (error) {
      console.error('Error aborting multipart upload:', error)
      throw new Error(
        `Failed to abort upload: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  })
