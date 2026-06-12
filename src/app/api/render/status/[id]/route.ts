import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';
import { getRenderNodeUrl } from '@/lib/renderUrl';
import { getGcsStorage } from '@/lib/gcsClient';

type FrontendStatus = "draft" | "uploaded" | "blueprint_ready" | "analysis_preparing" | "rendering" | "completed" | "failed" | "queued";

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delay = 200): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.status >= 500 && i < retries - 1) {
        console.warn(`Status proxy server returned ${response.status}. Retrying (${i + 1}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      return response;
    } catch (error) {
      if (i < retries - 1) {
        console.warn(`Status proxy fetch failed: ${(error as Error).message}. Retrying (${i + 1}/${retries})...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Fetch failed after maximum retries');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const renderNodeUrl = getRenderNodeUrl();
    
    const response = await fetchWithRetry(
      `${renderNodeUrl}/status/${id}`,
      {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'x-cineforge-worker-secret': process.env.RENDER_WORKER_SECRET || '',
        }
      },
      3,
      200
    );
    
    if (response.status === 404) {
      // Gracefully handle missing task (e.g. worker restarted) to prevent frontend crashes
      return NextResponse.json({
        status: 'failed',
        progress: 0,
        estimatedTimeRemaining: 0,
        error: 'Render task not found on worker node (it may have restarted).'
      });
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Render node status check returned status code ${response.status}` },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    
    // Map backend status strings to frontend status schema
    let status: FrontendStatus = 'analysis_preparing';
    const backendStatus = (result.status || 'UNKNOWN').toUpperCase();
    const progress = result.percent ?? 0;
    
    if (backendStatus === 'COMPLETED' || progress === 100) {
      status = 'completed';
    } else if (backendStatus === 'FAILED') {
      status = 'failed';
    } else if (backendStatus.startsWith('QUEUED')) {
      status = 'queued';
    } else if (backendStatus === 'DOWNLOADING' || backendStatus === 'ANALYZING') {
      status = 'analysis_preparing';
    } else if (backendStatus === 'RENDERING' || backendStatus === 'UPLOADING') {
      status = 'rendering';
    }

    // Estimate remaining time (seconds) - standard render duration is approximately 12-15 seconds
    let estimatedTimeRemaining = status === 'completed'
      ? 0
      : status === 'failed'
        ? 0
        : Math.max(1, Math.round((100 - progress) * 0.15)); // Simple linear decay estimation

    if (status === 'queued') {
      const pos = result.queuePosition || 1;
      estimatedTimeRemaining = pos * 90; // 90 seconds per queued job
    }

    // In cloud mode, dynamically compile a secure GCS presigned read URL on demand
    let outputUrl = undefined;
    if (!result.error) {
      if (process.env.RENDER_MODE === 'cloud') {
        try {
          const bucketName = process.env.GCS_BUCKET_NAME || 'cineforge-media-bucket';
          const storage = getGcsStorage();
          const file = storage.bucket(bucketName).file(`rendered/output-${id}.mp4`);
          const [presignedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000 // 1 hour expiration
          });
          outputUrl = presignedUrl;
        } catch (e) {
          console.error('Failed to generate presigned URL for output asset:', e);
          outputUrl = `/renders/output-${id}.mp4`; // fallback
        }
      } else {
        outputUrl = `/renders/output-${id}.mp4`;
      }
    }

    return NextResponse.json({
      status,
      progress,
      estimatedTimeRemaining,
      error: result.error || undefined,
      outputUrl,
      diagnostics: result.diagnostics,
      queuePosition: result.queuePosition
    });

  } catch (error) {
    console.error('Failed to proxy status request:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
