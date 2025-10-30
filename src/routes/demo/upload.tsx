import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { FileUploader } from '@/components/FileUploader'

export const Route = createFileRoute('/demo/upload')({
  component: DemoUpload,
})

function DemoUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ key: string; filename: string; timestamp: string }>
  >([])
  const [lastError, setLastError] = useState<string | null>(null)

  const handleUploadComplete = (result: { key: string; location?: string }) => {
    // Extract filename from key (format: uploads/timestamp-random-filename)
    const filename = result.key.split('/').pop()?.split('-').slice(2).join('-') || result.key

    setUploadedFiles((prev) => [
      {
        key: result.key,
        filename,
        timestamp: new Date().toLocaleString(),
      },
      ...prev,
    ])
    setLastError(null)
  }

  const handleUploadError = (error: string) => {
    setLastError(error)
  }

  return (
    <div className="min-h-[calc(100vh-32px)] p-8 flex items-center justify-center w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="w-full max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">File Upload Demo</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Multipart upload to S3-compatible storage (MinIO/R2)
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Upload Your File</h2>
          <FileUploader
            accept=".jpg,.jpeg,.png,.webp,.gif,.3mf,.stl,.gcode"
            maxSize={1024 * 1024 * 1024} // 1GB
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            config={{
              maxConcurrentUploads: 4,
              maxRetries: 3,
              prefix: 'uploads/',
            }}
          />
        </div>

        {/* Recent uploads */}
        {uploadedFiles.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl mb-8">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Recent Uploads</h2>
            <div className="space-y-3">
              {uploadedFiles.map((file, index) => (
                <div
                  key={`${file.key}-${index}`}
                  className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white mb-1">{file.filename}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        S3 Key: <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">{file.key}</code>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{file.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technical details */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Technical Details</h2>
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Features</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>Multipart upload for files up to 1GB</li>
                <li>10MB chunk size with 4 concurrent uploads</li>
                <li>Automatic retry with exponential backoff</li>
                <li>Direct client-to-storage upload (no proxy)</li>
                <li>Progress tracking per part and overall</li>
                <li>Upload cancellation support</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Supported File Types</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>Images: JPEG, PNG, WebP, GIF, SVG</li>
                <li>3D Models: .3mf, .stl</li>
                <li>CNC/3D Printing: .gcode</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Storage Backend</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>Local: MinIO (S3-compatible) via Docker</li>
                <li>Production: Cloudflare R2</li>
                <li>Uses AWS SDK v3 with presigned URLs</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Architecture</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>TanStack Start server functions for presigned URLs</li>
                <li>React hook for upload state management</li>
                <li>Netlify Functions compatible (no file proxying)</li>
                <li>Client-side chunking and parallel uploads</li>
              </ul>
            </div>

            {lastError && (
              <div className="border border-red-300 dark:border-red-700 rounded-lg p-4 bg-red-50 dark:bg-red-950">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">Last Error</h3>
                <p className="text-red-600 dark:text-red-300 text-xs">{lastError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Setup instructions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl mt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Local Development Setup</h2>
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">1. Start MinIO</h3>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded p-3 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto border border-gray-200 dark:border-gray-700">
                npm run db:start
              </pre>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                MinIO will be available at:
                <br />
                API: <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">http://localhost:9000</code>
                <br />
                Console: <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">http://localhost:9001</code>
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">2. Create Bucket</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Log in to MinIO console (minioadmin / minioadmin123) and create a bucket named:{' '}
                <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">tanstack-uploads</code>
              </p>
              <p className="text-gray-600 dark:text-gray-400">Or use the initialization script:</p>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded p-3 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto border border-gray-200 dark:border-gray-700 mt-2">
                ./scripts/init-minio.sh
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">3. Configure CORS</h3>
              <p className="text-gray-600 dark:text-gray-400">
                CORS should be configured automatically by the init script to allow browser uploads.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">4. Environment Variables</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Already configured in <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">.env.local</code>:
              </p>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded p-3 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto border border-gray-200 dark:border-gray-700">
{`S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123
S3_BUCKET=tanstack-uploads
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true`}
              </pre>
            </div>
          </div>
        </div>

        {/* Netlify Production Setup */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 shadow-xl mt-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Netlify Production Setup</h2>
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">1. Create Cloudflare R2 Bucket</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>Log in to Cloudflare Dashboard</li>
                <li>Navigate to <strong>R2 Object Storage</strong></li>
                <li>Click <strong>Create bucket</strong></li>
                <li>Name your bucket (e.g., <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">tanstack-production</code>)</li>
                <li>Choose a location (or leave as default)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">2. Generate R2 API Tokens</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 mb-2">
                <li>Go to <strong>R2</strong> → <strong>Manage R2 API Tokens</strong></li>
                <li>Click <strong>Create API token</strong></li>
                <li>Set permissions: <strong>Object Read & Write</strong></li>
                <li>Optionally restrict to your specific bucket</li>
                <li>Copy the credentials (you'll need these next)</li>
              </ul>
              <p className="text-gray-600 dark:text-gray-400">
                You'll get:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-4">
                <li>Access Key ID</li>
                <li>Secret Access Key</li>
                <li>Endpoint URL (format: <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">https://&lt;account-id&gt;.r2.cloudflarestorage.com</code>)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">3. Configure R2 CORS Policy</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                R2 requires CORS configuration for browser uploads. In your Cloudflare dashboard:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 mb-2">
                <li>Navigate to your bucket → <strong>Settings</strong> → <strong>CORS Policy</strong></li>
                <li>Add the following policy (or use the Wrangler CLI):</li>
              </ul>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded p-3 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto border border-gray-200 dark:border-gray-700">
{`[
  {
    "AllowedOrigins": ["https://your-site.netlify.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]`}
              </pre>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Using Wrangler CLI:
              </p>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded p-3 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto border border-gray-200 dark:border-gray-700 mt-2">
{`wrangler r2 bucket cors put tanstack-production \\
  --rules '[{"AllowedOrigins":["https://your-site.netlify.app"],...}]'`}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">4. Set Netlify Environment Variables</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                In your Netlify dashboard:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 mb-2">
                <li>Go to <strong>Site settings</strong> → <strong>Environment variables</strong></li>
                <li>Add the following variables:</li>
              </ul>
              <div className="bg-gray-100 dark:bg-gray-900 rounded p-4 border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-300 dark:border-gray-700">
                      <th className="text-left py-2 text-gray-900 dark:text-white">Variable</th>
                      <th className="text-left py-2 text-gray-900 dark:text-white">Value</th>
                      <th className="text-left py-2 text-gray-900 dark:text-white">Secret?</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-800 dark:text-gray-200">
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <td className="py-2 font-mono">S3_ENDPOINT</td>
                      <td className="py-2">https://&lt;account-id&gt;.r2.cloudflarestorage.com</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">No</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-red-50 dark:bg-red-950">
                      <td className="py-2 font-mono">S3_ACCESS_KEY_ID</td>
                      <td className="py-2">Your R2 Access Key ID</td>
                      <td className="py-2 text-red-600 dark:text-red-400 font-semibold">Yes ⚠️</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-red-50 dark:bg-red-950">
                      <td className="py-2 font-mono">S3_SECRET_ACCESS_KEY</td>
                      <td className="py-2">Your R2 Secret Access Key</td>
                      <td className="py-2 text-red-600 dark:text-red-400 font-semibold">Yes ⚠️</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <td className="py-2 font-mono">S3_BUCKET</td>
                      <td className="py-2">tanstack-production</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">No</td>
                    </tr>
                    <tr className="border-b border-gray-200 dark:border-gray-800">
                      <td className="py-2 font-mono">S3_REGION</td>
                      <td className="py-2">auto</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">No</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">S3_FORCE_PATH_STYLE</td>
                      <td className="py-2">false</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400">No</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
                <p className="text-xs text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Set these variables for the <strong>Production</strong> and <strong>Deploy Preview</strong> contexts.
                </p>
              </div>
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                <p className="text-xs text-red-800 dark:text-red-200 mb-2">
                  <strong>⚠️ Security Warning:</strong> Only <code className="bg-red-100 dark:bg-red-900 px-1 rounded">S3_ACCESS_KEY_ID</code> and <code className="bg-red-100 dark:bg-red-900 px-1 rounded">S3_SECRET_ACCESS_KEY</code> are actual secrets!
                </p>
                <p className="text-xs text-red-800 dark:text-red-200">
                  The other values (endpoint, bucket name, region) are safe to appear in documentation and code.
                  Netlify's secrets scanner is configured to skip scanning for these non-sensitive values.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">5. Verify Build Settings</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Your <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">netlify.toml</code> should already be configured:
              </p>
              <pre className="bg-gray-100 dark:bg-gray-900 rounded p-3 text-xs text-gray-800 dark:text-gray-200 overflow-x-auto border border-gray-200 dark:border-gray-700">
{`[build]
command = "prisma migrate deploy && vite build"
dir = "dist/client"
environment = { SECRETS_SCAN_OMIT_KEYS = "S3_REGION,S3_BUCKET,S3_FORCE_PATH_STYLE" }

[functions]
node_bundler = "esbuild"
external_node_modules = ["@prisma/client", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"]`}
              </pre>
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded">
                <p className="text-xs text-yellow-800 dark:text-yellow-200 mb-2">
                  <strong>Important:</strong> The AWS SDK packages must be externalized to work properly in Netlify Functions.
                </p>
                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                  <strong>Secrets Scanning:</strong> <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">SECRETS_SCAN_OMIT_KEYS</code> tells
                  Netlify that bucket name, region, and path style settings are safe to appear in code/docs.
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">6. Deploy and Test</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
                <li>Push your code to your repository (GitHub/GitLab/etc.)</li>
                <li>Netlify will automatically deploy</li>
                <li>Visit <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">https://your-site.netlify.app/demo/upload</code></li>
                <li>Test uploading a file to verify R2 integration works</li>
                <li>Check Netlify Function logs if you encounter issues</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">7. Common Issues & Troubleshooting</h3>
              <div className="space-y-2">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">CORS Errors</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-4 text-xs">
                    <li>Verify CORS policy includes your Netlify domain</li>
                    <li>Check that <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">ExposeHeaders</code> includes "ETag"</li>
                    <li>Ensure <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">AllowedMethods</code> includes "PUT" for uploads</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">Function Timeout</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-4 text-xs">
                    <li>This architecture uses presigned URLs - files don't go through functions</li>
                    <li>Functions only generate URLs (very fast, no timeout issues)</li>
                    <li>If you still get timeouts, check server function execution time in logs</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">Environment Variables Not Found</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-4 text-xs">
                    <li>Redeploy after adding environment variables</li>
                    <li>Ensure variables are set for correct deploy context (Production/Preview)</li>
                    <li>Variable names are case-sensitive</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">Prisma Build Errors</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-4 text-xs">
                    <li>Verify <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">binaryTargets</code> includes "rhel-openssl-3.0.x"</li>
                    <li>Check that <code className="bg-gray-100 dark:bg-gray-900 px-1 rounded">@prisma/client</code> is externalized in netlify.toml</li>
                    <li>Ensure DATABASE_URL is set in Netlify environment variables</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
