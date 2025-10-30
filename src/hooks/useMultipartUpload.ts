import { useState, useCallback, useRef } from 'react'
import {
  initiateMultipartUpload,
  getUploadPartUrl,
  completeMultipartUpload,
  abortMultipartUpload,
} from '../server/uploads'

/**
 * Configuration for multipart upload
 */
export interface MultipartUploadConfig {
  /** Maximum number of concurrent part uploads (default: 4) */
  maxConcurrentUploads?: number
  /** Maximum number of retry attempts for failed parts (default: 3) */
  maxRetries?: number
  /** Initial retry delay in ms (default: 1000) */
  retryDelay?: number
  /** Whether to use exponential backoff for retries (default: true) */
  exponentialBackoff?: boolean
  /** S3 key prefix for organizing files (default: 'uploads/') */
  prefix?: string
}

/**
 * State of the upload process
 */
export interface UploadState {
  /** Whether an upload is currently in progress */
  isUploading: boolean
  /** Overall upload progress (0-100) */
  progress: number
  /** Error message if upload failed */
  error: string | null
  /** Upload ID from S3 */
  uploadId: string | null
  /** S3 key for the uploaded file */
  key: string | null
  /** Whether upload completed successfully */
  isComplete: boolean
  /** Number of parts uploaded successfully */
  uploadedParts: number
  /** Total number of parts */
  totalParts: number
}

/**
 * Part upload status
 */
interface PartStatus {
  partNumber: number
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  etag?: string
  retries: number
  error?: string
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<Omit<MultipartUploadConfig, 'prefix'>> = {
  maxConcurrentUploads: 4,
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
}

/**
 * Hook for managing multipart file uploads to S3-compatible storage
 *
 * Features:
 * - Automatic file chunking
 * - Parallel part uploads with configurable concurrency
 * - Progress tracking
 * - Automatic retry with exponential backoff
 * - Cleanup on failure
 *
 * @param config - Upload configuration options
 * @returns Upload state and control functions
 *
 * @example
 * ```tsx
 * const { uploadFile, progress, isUploading, error } = useMultipartUpload({
 *   maxConcurrentUploads: 4,
 *   maxRetries: 3,
 * })
 *
 * const handleFileSelect = async (file: File) => {
 *   const result = await uploadFile(file)
 *   if (result) {
 *     console.log('Upload complete:', result.key)
 *   }
 * }
 * ```
 */
export function useMultipartUpload(config: MultipartUploadConfig = {}) {
  const {
    maxConcurrentUploads,
    maxRetries,
    retryDelay,
    exponentialBackoff,
    prefix,
  } = { ...DEFAULT_CONFIG, ...config }

  const [state, setState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null,
    uploadId: null,
    key: null,
    isComplete: false,
    uploadedParts: 0,
    totalParts: 0,
  })

  // Track part statuses
  const partStatusesRef = useRef<Map<number, PartStatus>>(new Map())

  // Track abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null)

  /**
   * Update overall progress based on part statuses
   */
  const updateProgress = useCallback(() => {
    const parts = Array.from(partStatusesRef.current.values())
    const totalParts = parts.length
    const uploadedParts = parts.filter((p) => p.status === 'completed').length

    const progress = totalParts > 0 ? Math.round((uploadedParts / totalParts) * 100) : 0

    setState((prev) => ({
      ...prev,
      progress,
      uploadedParts,
      totalParts,
    }))
  }, [])

  /**
   * Sleep for a given duration (for retry delays)
   */
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  /**
   * Upload a single part with retry logic
   */
  const uploadPart = useCallback(
    async (
      file: File,
      uploadId: string,
      key: string,
      partNumber: number,
      start: number,
      end: number
    ): Promise<string> => {
      const partStatus = partStatusesRef.current.get(partNumber)!

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        // Check if upload was aborted
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Upload cancelled')
        }

        try {
          partStatus.status = 'uploading'
          partStatus.retries = attempt
          updateProgress()

          // Get presigned URL for this part
          const { presignedUrl } = await getUploadPartUrl({
            data: { uploadId, key, partNumber },
          })

          // Extract the chunk
          const chunk = file.slice(start, end)

          // Upload the chunk directly to S3
          const response = await fetch(presignedUrl, {
            method: 'PUT',
            body: chunk,
            signal: abortControllerRef.current?.signal,
            headers: {
              'Content-Type': file.type,
            },
          })

          if (!response.ok) {
            throw new Error(`Upload failed with status ${response.status}`)
          }

          // Get ETag from response (required for completing multipart upload)
          const etag = response.headers.get('ETag')
          if (!etag) {
            throw new Error('No ETag returned from upload')
          }

          partStatus.status = 'completed'
          partStatus.etag = etag
          updateProgress()

          return etag
        } catch (error) {
          partStatus.status = 'failed'
          partStatus.error =
            error instanceof Error ? error.message : 'Unknown error'

          // Don't retry if cancelled
          if (abortControllerRef.current?.signal.aborted) {
            throw error
          }

          // If we've exhausted retries, throw the error
          if (attempt === maxRetries) {
            throw error
          }

          // Calculate retry delay with exponential backoff
          const delay = exponentialBackoff
            ? retryDelay * Math.pow(2, attempt)
            : retryDelay

          console.warn(
            `Part ${partNumber} failed (attempt ${attempt + 1}/${maxRetries + 1}), ` +
              `retrying in ${delay}ms...`,
            error
          )

          await sleep(delay)
        }
      }

      throw new Error(`Part ${partNumber} failed after ${maxRetries + 1} attempts`)
    },
    [maxRetries, retryDelay, exponentialBackoff, updateProgress]
  )

  /**
   * Upload all parts with controlled concurrency
   */
  const uploadAllParts = useCallback(
    async (
      file: File,
      uploadId: string,
      key: string,
      partSize: number,
      partCount: number
    ): Promise<Array<{ partNumber: number; etag: string }>> => {
      // Initialize part statuses
      partStatusesRef.current.clear()
      for (let i = 1; i <= partCount; i++) {
        partStatusesRef.current.set(i, {
          partNumber: i,
          status: 'pending',
          retries: 0,
        })
      }

      // Create queue of part upload tasks
      const parts: Array<{ partNumber: number; etag: string }> = []
      const queue: Array<() => Promise<void>> = []

      for (let partNumber = 1; partNumber <= partCount; partNumber++) {
        const start = (partNumber - 1) * partSize
        const end = Math.min(start + partSize, file.size)

        queue.push(async () => {
          const etag = await uploadPart(file, uploadId, key, partNumber, start, end)
          parts.push({ partNumber, etag })
        })
      }

      // Execute uploads with controlled concurrency
      const executing: Promise<void>[] = []
      for (const task of queue) {
        const promise = task()
        executing.push(promise)

        if (executing.length >= maxConcurrentUploads) {
          await Promise.race(executing)
          executing.splice(
            executing.findIndex((p) => p === promise),
            1
          )
        }
      }

      // Wait for all uploads to complete
      await Promise.all(executing)

      // Sort parts by part number
      return parts.sort((a, b) => a.partNumber - b.partNumber)
    },
    [maxConcurrentUploads, uploadPart]
  )

  /**
   * Upload a file using multipart upload
   */
  const uploadFile = useCallback(
    async (file: File): Promise<{ key: string; location?: string } | null> => {
      // Reset state
      setState({
        isUploading: true,
        progress: 0,
        error: null,
        uploadId: null,
        key: null,
        isComplete: false,
        uploadedParts: 0,
        totalParts: 0,
      })

      // Create abort controller
      abortControllerRef.current = new AbortController()

      let uploadId: string | null = null
      let key: string | null = null

      try {
        // Step 1: Initiate multipart upload
        const initResult = await initiateMultipartUpload({
          data: {
            filename: file.name,
            fileSize: file.size,
            contentType: file.type || 'application/octet-stream',
            prefix,
          },
        })

        uploadId = initResult.uploadId
        key = initResult.key

        setState((prev) => ({
          ...prev,
          uploadId,
          key,
          totalParts: initResult.partCount,
        }))

        // Step 2: Upload all parts
        const parts = await uploadAllParts(
          file,
          uploadId,
          key,
          initResult.partSize,
          initResult.partCount
        )

        // Step 3: Complete multipart upload
        const completeResult = await completeMultipartUpload({
          data: {
            uploadId,
            key,
            parts,
          },
        })

        setState((prev) => ({
          ...prev,
          isUploading: false,
          isComplete: true,
          progress: 100,
        }))

        return {
          key,
          location: completeResult.location,
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error occurred'

        setState((prev) => ({
          ...prev,
          isUploading: false,
          error: errorMessage,
        }))

        // Abort the multipart upload if it was initiated
        if (uploadId && key) {
          try {
            await abortMultipartUpload({
              data: { uploadId, key },
            })
          } catch (abortError) {
            console.error('Failed to abort multipart upload:', abortError)
          }
        }

        return null
      } finally {
        abortControllerRef.current = null
      }
    },
    [uploadAllParts, prefix]
  )

  /**
   * Cancel an in-progress upload
   */
  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  /**
   * Reset the upload state
   */
  const reset = useCallback(() => {
    setState({
      isUploading: false,
      progress: 0,
      error: null,
      uploadId: null,
      key: null,
      isComplete: false,
      uploadedParts: 0,
      totalParts: 0,
    })
    partStatusesRef.current.clear()
  }, [])

  return {
    ...state,
    uploadFile,
    cancelUpload,
    reset,
  }
}
