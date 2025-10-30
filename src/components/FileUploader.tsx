import { useState, useRef, type DragEvent, type ChangeEvent } from 'react'
import { useMultipartUpload, type MultipartUploadConfig } from '../hooks/useMultipartUpload'
import { Upload, X, CheckCircle, AlertCircle, Loader } from 'lucide-react'

export interface FileUploaderProps {
  /** Callback when upload completes successfully */
  onUploadComplete?: (result: { key: string; location?: string }) => void
  /** Callback when upload fails */
  onUploadError?: (error: string) => void
  /** Upload configuration */
  config?: MultipartUploadConfig
  /** Accepted file types (e.g., ".3mf,.stl,.gcode") */
  accept?: string
  /** Maximum file size in bytes */
  maxSize?: number
  /** Custom CSS class */
  className?: string
}

/**
 * File uploader component with drag & drop support
 *
 * Features:
 * - Drag and drop file upload
 * - Click to select file
 * - Progress tracking
 * - Error handling
 * - Upload cancellation
 * - Visual feedback
 *
 * @example
 * ```tsx
 * <FileUploader
 *   accept=".3mf,.stl,.gcode"
 *   maxSize={1024 * 1024 * 1024} // 1GB
 *   onUploadComplete={(result) => console.log('Upload complete:', result.key)}
 * />
 * ```
 */
export function FileUploader({
  onUploadComplete,
  onUploadError,
  config,
  accept = '.jpg,.jpeg,.png,.webp,.gif,.3mf,.stl,.gcode',
  maxSize = 1024 * 1024 * 1024, // 1GB default
  className = '',
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    uploadFile,
    cancelUpload,
    reset,
    isUploading,
    progress,
    error,
    isComplete,
    uploadedParts,
    totalParts,
  } = useMultipartUpload(config)

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Validate file before upload
   */
  const validateFile = (file: File): string | null => {
    if (file.size > maxSize) {
      return `File size (${formatFileSize(file.size)}) exceeds maximum allowed size of ${formatFileSize(maxSize)}`
    }

    if (file.size === 0) {
      return 'File is empty'
    }

    return null
  }

  /**
   * Handle file selection
   */
  const handleFileSelect = async (file: File) => {
    const validationError = validateFile(file)
    if (validationError) {
      onUploadError?.(validationError)
      return
    }

    setSelectedFile(file)

    // Start upload
    const result = await uploadFile(file)

    if (result) {
      onUploadComplete?.(result)
    } else if (error) {
      onUploadError?.(error)
    }
  }

  /**
   * Handle drag events
   */
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  /**
   * Handle file input change
   */
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  /**
   * Open file picker
   */
  const openFilePicker = () => {
    fileInputRef.current?.click()
  }

  /**
   * Handle upload cancellation
   */
  const handleCancel = () => {
    cancelUpload()
    reset()
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  /**
   * Handle reset after completion or error
   */
  const handleReset = () => {
    reset()
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Upload area */}
      {!isUploading && !isComplete && !error && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFilePicker}
          className={`
            border-2 border-dashed rounded-lg p-8
            transition-colors cursor-pointer
            ${
              isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
            }
          `}
        >
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <Upload className="w-12 h-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                Drop your file here or click to browse
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Supports: Images, 3D models (.3mf, .stl), G-code
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Maximum file size: {formatFileSize(maxSize)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && selectedFile && (
        <div className="border rounded-lg p-6 bg-white dark:bg-gray-800">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                {selectedFile.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Cancel upload"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="mb-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Progress details */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
              <Loader className="w-4 h-4 animate-spin" />
              <span>
                Uploading... {progress}% ({uploadedParts} / {totalParts} parts)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Upload complete */}
      {isComplete && selectedFile && (
        <div className="border border-green-300 dark:border-green-700 rounded-lg p-6 bg-green-50 dark:bg-green-950">
          <div className="flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-green-900 dark:text-green-100 mb-1">
                Upload complete!
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mb-1">
                {selectedFile.name}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 font-medium text-sm"
            >
              Upload another
            </button>
          </div>
        </div>
      )}

      {/* Upload error */}
      {error && (
        <div className="border border-red-300 dark:border-red-700 rounded-lg p-6 bg-red-50 dark:bg-red-950">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-900 dark:text-red-100 mb-1">
                Upload failed
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
            <button
              onClick={handleReset}
              className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 font-medium text-sm"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
