import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { Storage } from '@google-cloud/storage';
import { getGcsStorage } from '@/lib/gcsClient';

const MAX_SIZE_LIMIT = 100 * 1024 * 1024; // 100MB limit

let storageClient: Storage | null = null;
function getStorageClient(): Storage | null {
  if (process.env.RENDER_MODE === 'local') {
    return null;
  }
  const hasGcsKeys = process.env.GCP_PROJECT_ID && process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY;
  if (process.env.RENDER_MODE !== 'cloud' && !hasGcsKeys) {
    return null;
  }
  if (!storageClient) {
    try {
      storageClient = getGcsStorage();
    } catch (e) {
      console.warn('GCS Storage initialization failed. Defaulting upload route to local mode.', e);
      return null;
    }
  }
  return storageClient;
}

/**
 * Sanitizes the filename by removing special characters and appends a Unix timestamp.
 */
function getSanitizedFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const base = path.basename(originalName, ext);
  const cleanBase = base.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
  const timestamp = Math.floor(Date.now() / 1000);
  return `${cleanBase}_${timestamp}${ext}`;
}

/**
 * Validates allowed MIME types (standard video and image types).
 */
function isValidMimeType(contentType: string): boolean {
  const allowed = [
    'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska',
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp'
  ];
  return allowed.includes(contentType.toLowerCase());
}

export async function POST(request: Request) {
  try {
    // 1. Enforce payload size limit at header check level
    const contentLength = parseInt(request.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_SIZE_LIMIT) {
      return NextResponse.json(
        { error: 'Payload exceeds the 100MB limit constraint.' },
        { status: 413 }
      );
    }

    const contentTypeHeader = request.headers.get('content-type') || '';

    // --- CASE A: Negotiation JSON Request (Cloud Presigned URL / Local Target Check) ---
    if (contentTypeHeader.includes('application/json')) {
      const body = await request.json();
      const { fileName, contentType, fileSize, projectId } = body;

      if (!fileName || !contentType || !fileSize) {
        return NextResponse.json(
          { error: 'Missing negotiation properties: fileName, contentType, and fileSize are required.' },
          { status: 400 }
        );
      }

      if (!isValidMimeType(contentType)) {
        return NextResponse.json(
          { error: `Forbidden media content-type: ${contentType}. Supported: MP4, MOV, WebM, PNG, JPG, WebP.` },
          { status: 400 }
        );
      }

      if (fileSize > MAX_SIZE_LIMIT) {
        return NextResponse.json(
          { error: 'Payload exceeds the 100MB limit constraint.' },
          { status: 413 }
        );
      }

      const sanitizedName = getSanitizedFilename(fileName);
      const isLocal = process.env.RENDER_MODE === 'local';
      const storage = getStorageClient();

      if (isLocal || !storage) {
        // Return local upload target instructions
        const localPath = projectId
          ? `/uploads/user-uploads/${projectId}/${sanitizedName}`
          : `/uploads/${sanitizedName}`;

        return NextResponse.json({
          success: true,
          mode: 'local',
          uploadUrl: '/api/upload',
          filePath: localPath,
          fileName: sanitizedName,
          fileSize,
          contentType
        });
      } else {
        // Cloud Mode: Generate GCP V4 Presigned PUT URL
        try {
          const bucketName = process.env.GCS_BUCKET_NAME || 'cineforge-media-bucket';
          const gcsKey = projectId
            ? `raw/user-uploads/${projectId}/${sanitizedName}`
            : `raw/${sanitizedName}`;

          const file = storage.bucket(bucketName).file(gcsKey);

          const [uploadUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes expiration
            contentType: contentType
          });

          return NextResponse.json({
            success: true,
            mode: 'cloud',
            uploadUrl,
            filePath: `gs://${bucketName}/${gcsKey}`,
            fileName: sanitizedName,
            fileSize,
            contentType
          });
        } catch (e) {
          console.warn('GCS Presigned URL generation failed. Defaulting upload route to local mode.', e);
          const localPath = projectId
            ? `/uploads/user-uploads/${projectId}/${sanitizedName}`
            : `/uploads/${sanitizedName}`;

          return NextResponse.json({
            success: true,
            mode: 'local',
            uploadUrl: '/api/upload',
            filePath: localPath,
            fileName: sanitizedName,
            fileSize,
            contentType
          });
        }
      }
    }

    // --- CASE B: Multipart Upload Handling (Local Multipart Upload execution) ---
    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const explicitFileName = formData.get('fileName') as string | null;
      const projectId = formData.get('projectId') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'Multipart parameter error: Missing file field.' }, { status: 400 });
      }

      if (file.size > MAX_SIZE_LIMIT) {
        return NextResponse.json({ error: 'Multipart upload exceeds 100MB limit.' }, { status: 413 });
      }

      if (!isValidMimeType(file.type)) {
        return NextResponse.json(
          { error: `Forbidden media type: ${file.type}.` },
          { status: 400 }
        );
      }

      const sanitizedName = explicitFileName || getSanitizedFilename(file.name);
      
      // Ensure target directory exists (either with nested projectId or default public/uploads)
      const uploadDir = projectId
        ? path.join(process.cwd(), 'public', 'uploads', 'user-uploads', projectId)
        : path.join(process.cwd(), 'public', 'uploads');

      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const targetPath = path.join(uploadDir, sanitizedName);
      const writeStream = fs.createWriteStream(targetPath);

      // Memory-Safe Stream Pipe from web ReadableStream to local file WriteStream
      const reader = file.stream().getReader();
      
      await new Promise<void>((resolve, reject) => {
        writeStream.on('error', (err) => reject(err));
        writeStream.on('finish', () => resolve());

        const pump = async () => {
          try {
            const { done, value } = await reader.read();
            if (done) {
              writeStream.end();
              return;
            }
            writeStream.write(Buffer.from(value), (err) => {
              if (err) {
                reject(err);
              } else {
                pump();
              }
            });
          } catch (err) {
            reject(err);
          }
        };
        pump();
      });

      const localPath = projectId
        ? `/uploads/user-uploads/${projectId}/${sanitizedName}`
        : `/uploads/${sanitizedName}`;

      return NextResponse.json({
        success: true,
        mode: 'local',
        filePath: localPath,
        fileName: sanitizedName,
        fileSize: file.size,
        contentType: file.type
      });
    }

    return NextResponse.json({ error: 'Unsupported Content-Type header.' }, { status: 415 });

  } catch (error) {
    console.error('Unhandled upload route error:', error);
    return NextResponse.json(
      { error: `Server crash: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}
