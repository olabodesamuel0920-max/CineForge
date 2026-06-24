import { NextResponse } from 'next/server';
import { getRenderNodeUrl, handleWorkerResponse } from '@/lib/renderUrl';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    const renderNodeUrl = getRenderNodeUrl();
    
    const response = await fetch(`${renderNodeUrl}/status/${taskId}`, {
      method: 'GET',
      headers: {
        'x-cineforge-worker-secret': process.env.RENDER_WORKER_SECRET || '',
      }
    });
    
    try {
      const result = await handleWorkerResponse(response);
      return NextResponse.json(result);
    } catch (err) {
      const errText = (err as Error).message;
      console.error(`[Cancel API] Worker call failed:`, errText);
      return NextResponse.json(
        { error: errText.includes('Worker service unavailable') ? errText : `Cancel worker failed: ${errText}` },
        { status: response.status >= 400 && response.status < 600 ? response.status : 500 }
      );
    }
  } catch (error) {
    console.error('Failed to proxy status request:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
