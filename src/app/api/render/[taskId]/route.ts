import { NextResponse } from 'next/server';
import { getRenderNodeUrl } from '@/lib/renderUrl';

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
    
    if (!response.ok) {
      return NextResponse.json(
        { error: `Render node returned status ${response.status}` },
        { status: response.status }
      );
    }
    
    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to proxy status request:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
