import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

const s3Client = new S3Client({});

/**
 * Parses an S3 URI (s3://bucket/key) into its bucket name and key components.
 */
export function parseS3Uri(uri: string): { bucket: string; key: string } {
  if (!uri.startsWith('s3://')) {
    throw new Error(`Invalid S3 URI protocol: ${uri}. Must start with s3://`);
  }
  const pathPart = uri.slice(5);
  const slashIndex = pathPart.indexOf('/');
  if (slashIndex === -1) {
    throw new Error(`Invalid S3 URI path layout: ${uri}. Format must be s3://bucket-name/key-path`);
  }
  const bucket = pathPart.slice(0, slashIndex);
  const key = pathPart.slice(slashIndex + 1);
  return { bucket, key };
}

/**
 * Downloads a file from S3 to a local destination path, featuring 3x retry capability with exponential backoff.
 */
export async function downloadFromS3(
  s3Uri: string,
  destPath: string,
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<void> {
  const { bucket, key } = parseS3Uri(s3Uri);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error('Received empty response body from S3 bucket');
      }

      // Ensure containing directory exists
      fs.mkdirSync(path.dirname(destPath), { recursive: true });

      const fileWriteStream = fs.createWriteStream(destPath);
      const s3ReadableStream = response.Body as Readable;

      await new Promise<void>((resolve, reject) => {
        s3ReadableStream.pipe(fileWriteStream)
          .on('finish', () => resolve())
          .on('error', (err) => {
            fileWriteStream.close();
            reject(err);
          });
      });

      return; // Download succeeded, exit function
    } catch (error) {
      console.warn(`S3 download attempt ${attempt}/${maxRetries} failed for ${s3Uri}:`, error);
      
      if (attempt === maxRetries) {
        throw new Error(`S3 download failed after ${maxRetries} attempts: ${(error as Error).message}`);
      }

      // Exponential backoff delay
      const backoffTime = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffTime));
    }
  }
}

/**
 * Uploads a local file to S3 at the specified S3 URI.
 */
export async function uploadToS3(
  localFilePath: string,
  targetS3Uri: string,
  contentType = 'video/mp4'
): Promise<void> {
  const { bucket, key } = parseS3Uri(targetS3Uri);

  if (!fs.existsSync(localFilePath)) {
    throw new Error(`Local file does not exist for upload: ${localFilePath}`);
  }

  const fileStream = fs.createReadStream(localFilePath);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: fileStream,
    ContentType: contentType
  });

  await s3Client.send(command);
}

/**
 * Generates a presigned URL to retrieve an object from S3. Default expiration is 7 days.
 */
export async function generatePresignedUrl(
  s3Uri: string,
  expiresInSeconds = 604800 // 7 days (maximum allowed for sigv4)
): Promise<string> {
  const { bucket, key } = parseS3Uri(s3Uri);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}
