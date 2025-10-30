# File Storage Setup Guide

This project uses S3-compatible storage for file uploads:
- **Local Development**: MinIO (via Docker)
- **Production**: Cloudflare R2

## Quick Start (Local Development)

### 1. Start Services

```bash
npm run db:start
```

This starts both PostgreSQL and MinIO containers.

### 2. Initialize MinIO

```bash
npm run minio:init
```

This creates the `tanstack-uploads` bucket and sets basic permissions.

### 3. Configure CORS (Manual Step)

MinIO requires CORS configuration for browser uploads. Follow these steps:

1. Open MinIO Console: http://localhost:9001
2. Login with:
   - Username: `minioadmin`
   - Password: `minioadmin123`
3. Navigate to **Buckets** → **tanstack-uploads**
4. Click **Anonymous** tab
5. Add anonymous policy or configure through **Configuration** tab

Alternatively, CORS can be configured by restarting MinIO with environment variables:

```yaml
environment:
  MINIO_API_CORS_ALLOW_ORIGIN: "*"
```

### 4. Run Migrations

```bash
npm run db:migrate
```

### 5. Start Development Server

```bash
npm run dev
```

### 6. Test Upload

Navigate to: http://localhost:3000/demo/upload

## Environment Variables

### Local Development (`.env.local`)

```bash
# MinIO S3-compatible storage
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin123
S3_BUCKET=tanstack-uploads
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

### Production (`.env.production`)

```bash
# Cloudflare R2 Storage
S3_ENDPOINT=https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your_r2_access_key_id
S3_SECRET_ACCESS_KEY=your_r2_secret_access_key
S3_BUCKET=tanstack-production
S3_REGION=auto
S3_FORCE_PATH_STYLE=false
```

## Cloudflare R2 Setup (Production)

### 1. Create R2 Bucket

1. Log in to Cloudflare Dashboard
2. Navigate to **R2 Object Storage**
3. Click **Create bucket**
4. Name your bucket (e.g., `tanstack-production`)
5. Choose a location (or leave as default)

### 2. Generate API Tokens

1. Go to **R2** → **Manage R2 API Tokens**
2. Click **Create API token**
3. Set permissions: **Object Read & Write**
4. Optionally restrict to your specific bucket
5. Copy the credentials:
   - Access Key ID
   - Secret Access Key
   - Endpoint URL (format: `https://<account-id>.r2.cloudflarestorage.com`)

### 3. Configure CORS for R2

R2 requires CORS configuration for browser uploads. In your Cloudflare dashboard:

1. Navigate to your bucket → **Settings** → **CORS Policy**
2. Add the following policy:

```json
[
  {
    "AllowedOrigins": ["https://your-site.netlify.app"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Or use the Wrangler CLI:

```bash
wrangler r2 bucket cors put tanstack-production \
  --rules '[{"AllowedOrigins":["https://your-site.netlify.app"],"AllowedMethods":["GET","PUT","POST","DELETE","HEAD"],"AllowedHeaders":["*"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3600}]'
```

### 4. Set Netlify Environment Variables

In your Netlify dashboard:

1. Go to **Site settings** → **Environment variables**
2. Add the following variables:

| Variable | Value | Secret? |
|----------|-------|---------|
| `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` | No |
| `S3_ACCESS_KEY_ID` | Your R2 Access Key ID | **Yes ⚠️** |
| `S3_SECRET_ACCESS_KEY` | Your R2 Secret Access Key | **Yes ⚠️** |
| `S3_BUCKET` | `tanstack-production` | No |
| `S3_REGION` | `auto` | No |
| `S3_FORCE_PATH_STYLE` | `false` | No |

**Important:** Set these variables for the **Production** and **Deploy Preview** contexts.

#### Understanding Secret vs Non-Secret Values

**Actual Secrets (Never commit these!):**
- `S3_ACCESS_KEY_ID` - Grants access to your R2 storage
- `S3_SECRET_ACCESS_KEY` - Used to authenticate API requests

**Non-Secret Configuration (Safe to appear in docs/code):**
- `S3_ENDPOINT` - Public endpoint URL
- `S3_BUCKET` - Bucket name (not sensitive)
- `S3_REGION` - AWS region or "auto" for R2
- `S3_FORCE_PATH_STYLE` - Boolean configuration flag

The `netlify.toml` file includes `SECRETS_SCAN_OMIT_KEYS` to tell Netlify's secrets scanner that bucket names, regions, and path style settings are safe to appear in documentation and build output.

### 5. Verify Build Settings

Your `netlify.toml` should already be configured correctly:

```toml
[build]
command = "prisma migrate deploy && vite build"
dir = "dist/client"
environment = { SECRETS_SCAN_OMIT_KEYS = "S3_REGION,S3_BUCKET,S3_FORCE_PATH_STYLE" }

[functions]
node_bundler = "esbuild"
external_node_modules = ["@prisma/client", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"]
```

**Important Notes:**
- The AWS SDK packages must be externalized to work properly in Netlify Functions
- `SECRETS_SCAN_OMIT_KEYS` tells Netlify's secrets scanner to skip non-sensitive config values (bucket name, region, etc.)
- Only `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY` are actual secrets that should never appear in code or documentation

### 6. Deploy and Test

1. Push your code to your repository (GitHub/GitLab/etc.)
2. Netlify will automatically deploy
3. Visit `https://your-site.netlify.app/demo/upload`
4. Test uploading a file to verify R2 integration works
5. Check Netlify Function logs if you encounter issues

## Architecture

### Upload Flow

1. **Client** requests upload initiation from server
2. **Server** generates upload ID and presigned URLs
3. **Client** chunks file (10MB pieces) and uploads directly to MinIO/R2
4. **Client** notifies server when all parts uploaded
5. **Server** completes multipart upload on S3

### Key Features

- **Multipart Upload**: Handles files up to 1GB
- **Direct Upload**: Files upload directly to storage (no proxy through serverless functions)
- **Parallel Uploads**: 4 concurrent part uploads
- **Progress Tracking**: Real-time progress per part and overall
- **Retry Logic**: Automatic retry with exponential backoff
- **Netlify Compatible**: Works within 10-second function timeout

### Supported File Types

- **Images**: JPEG, PNG, WebP, GIF, SVG
- **3D Models**: .3mf, .stl
- **CNC/3D Printing**: .gcode

## Troubleshooting

### Local Development Issues

#### Port 9000 Already in Use

```bash
# Find and kill the process
lsof -i :9000
kill -9 <PID>

# Or use a different port in docker-compose.yml
```

#### CORS Errors (Local)

If you see CORS errors in the browser:

1. Verify MinIO is running: http://localhost:9001
2. Check bucket exists: `tanstack-uploads`
3. Configure CORS through MinIO console
4. Restart dev server

#### Upload Fails with 403

- Check S3 credentials in `.env.local`
- Verify bucket permissions
- Ensure presigned URLs haven't expired (1-hour timeout)

### Production/Netlify Issues

#### CORS Errors (Production)

- Verify CORS policy includes your Netlify domain
- Check that `ExposeHeaders` includes "ETag"
- Ensure `AllowedMethods` includes "PUT" for uploads
- R2 CORS changes may take a few minutes to propagate

#### Function Timeout

- This architecture uses presigned URLs - files don't go through functions
- Functions only generate URLs (very fast, no timeout issues)
- If you still get timeouts, check server function execution time in Netlify logs

#### Environment Variables Not Found

- Redeploy after adding environment variables
- Ensure variables are set for correct deploy context (Production/Preview)
- Variable names are case-sensitive
- Check that all `S3_*` variables are set

#### Prisma Build Errors

- Verify `binaryTargets` includes "rhel-openssl-3.0.x" in schema.prisma
- Check that `@prisma/client` is externalized in netlify.toml
- Ensure `DATABASE_URL` is set in Netlify environment variables
- Clear build cache and redeploy if issues persist

#### AWS SDK Errors in Netlify Functions

If you see errors like "Cannot find module @aws-sdk/client-s3":

1. Verify netlify.toml has the correct external_node_modules:
```toml
[functions]
external_node_modules = ["@prisma/client", "@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner"]
```

2. Clear Netlify build cache and redeploy
3. Check that packages are in package.json dependencies (not devDependencies)

## API Reference

### Server Functions

- `initiateMultipartUpload` - Start a new upload
- `getUploadPartUrl` - Get presigned URL for a part
- `completeMultipartUpload` - Finalize upload
- `abortMultipartUpload` - Cancel upload

### React Hook

```tsx
import { useMultipartUpload } from '@/hooks/useMultipartUpload'

const { uploadFile, progress, isUploading, error } = useMultipartUpload({
  maxConcurrentUploads: 4,
  maxRetries: 3,
  prefix: 'uploads/',
})

const handleUpload = async (file: File) => {
  const result = await uploadFile(file)
  if (result) {
    console.log('Uploaded:', result.key)
  }
}
```

### Component

```tsx
import { FileUploader } from '@/components/FileUploader'

<FileUploader
  accept=".jpg,.png,.3mf,.stl,.gcode"
  maxSize={1024 * 1024 * 1024} // 1GB
  onUploadComplete={(result) => console.log(result.key)}
  onUploadError={(error) => console.error(error)}
/>
```

## Database Schema

The `Upload` model tracks uploaded files:

```prisma
model Upload {
  id          Int      @id @default(autoincrement())
  key         String   @unique  // S3 object key
  filename    String              // Original filename
  size        Int                 // File size in bytes
  contentType String              // MIME type
  createdAt   DateTime @default(now())
}
```

To save upload metadata to the database, add this to your upload completion handler:

```tsx
import { prisma } from '@/lib/prisma'

const result = await uploadFile(file)
if (result) {
  await prisma.upload.create({
    data: {
      key: result.key,
      filename: file.name,
      size: file.size,
      contentType: file.type,
    },
  })
}
```
