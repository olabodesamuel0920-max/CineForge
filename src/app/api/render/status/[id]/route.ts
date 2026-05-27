import { NextResponse } from 'next/server';
import { Storage } from '@google-cloud/storage';

type FrontendStatus = "draft" | "uploaded" | "blueprint_ready" | "analysis_preparing" | "rendering" | "completed" | "failed";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const renderNodeUrl = process.env.RENDER_NODE_URL || process.env.NEXT_PUBLIC_RENDER_NODE_URL;
    
    if (!renderNodeUrl) {
      return NextResponse.json(
        { error: 'Render Node URL is not configured. Please set RENDER_NODE_URL in your environment variables.' },
        { status: 500 }
      );
    }
    
    // Fetch current progress from the Render Node server status endpoint
    const response = await fetch(`${renderNodeUrl.replace(/\/$/, '')}/status/${id}`, {
      method: 'GET',
      cache: 'no-store'
    });
    
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
    } else if (backendStatus === 'DOWNLOADING' || backendStatus === 'ANALYZING') {
      status = 'analysis_preparing';
    } else if (backendStatus === 'RENDERING' || backendStatus === 'UPLOADING') {
      status = 'rendering';
    }

    // Estimate remaining time (seconds) - standard render duration is approximately 12-15 seconds
    const estimatedTimeRemaining = status === 'completed'
      ? 0
      : status === 'failed'
        ? 0
        : Math.max(1, Math.round((100 - progress) * 0.15)); // Simple linear decay estimation

    // In cloud mode, dynamically compile a secure GCS presigned read URL on demand
    let outputUrl = undefined;
    if (!result.error) {
      if (process.env.RENDER_MODE === 'cloud') {
        try {
          const bucketName = process.env.GCS_BUCKET_NAME || 'cineforge-media-bucket';
          const storage = new Storage();
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
      outputUrl
    });

  } catch (error) {
    console.error('Failed to proxy status request:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
