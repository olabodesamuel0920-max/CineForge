"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGcsUri = parseGcsUri;
exports.downloadFromGcs = downloadFromGcs;
exports.uploadToGcs = uploadToGcs;
exports.generateGcsSignedUrl = generateGcsSignedUrl;
const storage_1 = require("@google-cloud/storage");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let storageClient = null;
function getStorage() {
    if (process.env.RENDER_MODE === 'local') {
        return null;
    }
    if (!storageClient) {
        try {
            storageClient = new storage_1.Storage();
        }
        catch (e) {
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
function parseGcsUri(uri) {
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
async function downloadFromGcs(gcsUri, destPath, maxRetries = 3, baseDelayMs = 1000) {
    const client = getStorage();
    if (!client) {
        console.log(`[Local GCS Fallback] Copying input file: ${gcsUri} -> ${destPath}`);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        let sourcePath = gcsUri;
        // Bypassing protocol prefixes if passed (e.g. gs:// or file://)
        if (sourcePath.startsWith('gs://')) {
            // In local mode, treat gs://bucket/filename as just filename in public/uploads/ or root workspace
            const filename = path.basename(sourcePath);
            const workspaceRoot = path.join(__dirname, '..', '..');
            const pathsToCheck = [
                path.join(workspaceRoot, 'public', 'uploads', filename),
                path.join(workspaceRoot, 'public', filename),
                path.join(workspaceRoot, filename)
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
        }
        catch (error) {
            console.warn(`GCS download attempt ${attempt}/${maxRetries} failed for ${gcsUri}:`, error);
            if (attempt === maxRetries) {
                throw new Error(`GCS download failed after ${maxRetries} attempts: ${error.message}`);
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
async function uploadToGcs(localFilePath, targetGcsUri, contentType = 'video/mp4') {
    const client = getStorage();
    if (!client) {
        console.log(`[Local GCS Fallback] Saving rendered output: ${localFilePath} -> ${targetGcsUri}`);
        let destinationPath = targetGcsUri;
        // Map gs:// or output key to public/renders
        if (destinationPath.startsWith('gs://') || destinationPath.includes('output-')) {
            const filename = path.basename(destinationPath);
            const workspaceRoot = path.join(__dirname, '..', '..');
            const rendersDir = path.join(workspaceRoot, 'public', 'renders');
            if (!fs.existsSync(rendersDir)) {
                fs.mkdirSync(rendersDir, { recursive: true });
            }
            destinationPath = path.join(rendersDir, filename);
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
async function generateGcsSignedUrl(gcsUri, expiresInSeconds = 604800) {
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
