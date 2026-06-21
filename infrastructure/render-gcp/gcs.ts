import { Storage } from '@google-cloud/storage';
import * as fs from 'fs';
import * as path from 'path';

let storageClient: Storage | null = null;

function getStorage(): Storage | null {
  if (process.env.RENDER_MODE !== 'cloud') {
    process.env.RENDER_MODE = 'local';
    return null;
  }
  if (!storageClient) {
    try {
      storageClient = new Storage();
    } catch (e) {
      console.warn('Google Cloud Storage client failed to initialize. Falling back to local file copy.', e);
      process.env.RENDER_MODE = 'local';
      return null;
    }
  }
  return storageClient;
}

/**
 * Parses a GCS URI (gs://bucket/key) into its bucket and key components.
 */
export function parseGcsUri(uri: string): { bucket: string; key: string } {
  if (!uri.startsWith('gs://')) {
    throw new Error(`Invalid GCS URI protocol: ${uri}. Must start with gs://`);
  }
  const pathPart = uri.slice(5);
  const slashIndex = pathPart.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(`Invalid GCS URI path layout: ${uri}. Format must be gs://bucket-name/key-path`);
  }
  const bucket = pathPart.slice(0, slashIndex);
  const key = pathPart.slice(slashIndex + 1);
  return { bucket, key };
}

/**
 * Downloads a file from GCS or copies it from local disk in local mode.
 */
export async function downloadFromGcs(
  gcsUri: string,
  destPath: string,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<void> {
  const client = getStorage();
  if (!client) {
    console.log(`[Local GCS Fallback] Copying input file: ${gcsUri} -> ${destPath}`);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    
    let sourcePath = gcsUri;
    
    // Bypassing protocol prefixes if passed (e.g. gs:// or file://)
    if (sourcePath.startsWith('gs://')) {
      // In local mode, treat gs://bucket/filename as just filename in public/uploads/ or root workspace
      const filename = path.basename(sourcePath);
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      const targetDir = (!fs.existsSync(uploadsDir) && fs.existsSync(path.join(process.cwd(), '..', '..', 'public', 'uploads')))
        ? path.join(process.cwd(), '..', '..', 'public', 'uploads')
        : uploadsDir;
      
      const pathsToCheck = [
        path.join(targetDir, filename),
        path.join(path.dirname(targetDir), filename),
        path.join(path.dirname(targetDir), 'renders', filename),
        path.join(path.dirname(path.dirname(targetDir)), filename)
      ];
      
      let found = false;
      for (const p of pathsToCheck) {
        if (fs.existsSync(p)) {
          sourcePath = p;
          found = true;
          break;
        }
      }
      
      if (!found) {
        // If file not found, check if there's any file in the workspace we can use as a fallback placeholder
        // E.g., we can copy the first mp4 we find or create an empty file just so it doesn't fail
        throw new Error(`Local source file not found for GCS URI: ${gcsUri}. Placed media files should be in Next.js public/uploads/ or public/ directory.`);
      }
    }

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Local source file does not exist: ${sourcePath}`);
    }

    fs.copyFileSync(sourcePath, destPath);
    return;
  }

  const { bucket, key } = parseGcsUri(gcsUri);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Ensure containing directory exists
      fs.mkdirSync(path.dirname(destPath), { recursive: true });

      await client.bucket(bucket).file(key).download({ destination: destPath });
      return; // Download succeeded, exit function
    } catch (error) {
      console.warn(`GCS download attempt ${attempt}/${maxRetries} failed for ${gcsUri}:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`GCS download failed after ${maxRetries} attempts: ${(error as Error).message}`);
      }

      // Exponential backoff delay
      const backoffTime = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffTime));
    }
  }
}

/**
 * Uploads a local file to GCS or copies it to local Next.js renders directory.
 */
export async function uploadToGcs(
  localFilePath: string,
  targetGcsUri: string,
  contentType = 'video/mp4'
): Promise<void> {
  const client = getStorage();
  if (!client) {
    console.log(`[Local GCS Fallback] Saving rendered output: ${localFilePath} -> ${targetGcsUri}`);
    
    let destinationPath = targetGcsUri;
    // Map gs:// or output key to public/renders
    if (destinationPath.startsWith('gs://') || destinationPath.includes('output-')) {
      const filename = path.basename(destinationPath);
      const rendersDir = path.join(process.cwd(), 'public', 'renders');
      const targetRendersDir = (!fs.existsSync(rendersDir) && fs.existsSync(path.join(process.cwd(), '..', '..', 'public', 'renders')))
        ? path.join(process.cwd(), '..', '..', 'public', 'renders')
        : rendersDir;
      
      if (!fs.existsSync(targetRendersDir)) {
        fs.mkdirSync(targetRendersDir, { recursive: true });
      }
      destinationPath = path.join(targetRendersDir, filename);
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    fs.copyFileSync(localFilePath, destinationPath);
    return;
  }

  const { bucket, key } = parseGcsUri(targetGcsUri);

  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Local file does not exist for upload: ${localFilePath}`);
  }

  await client.bucket(bucket).upload(localFilePath, {
    destination: key,
    metadata: {
      contentType: contentType,
    },
  });
}

/**
 * Generates a signed URL to retrieve an object from GCS or returns local path route.
 */
export async function generateGcsSignedUrl(
  gcsUri: string,
  expiresInSeconds = 604800
): Promise<string> {
  const client = getStorage();
  if (!client) {
    // In local mode, return relative public URL
    const filename = path.basename(gcsUri);
    return `/renders/${filename}`;
  }

  const { bucket, key } = parseGcsUri(gcsUri);
  const file = client.bucket(bucket).file(key);

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInSeconds * 1000,
  });

  return url;
}
