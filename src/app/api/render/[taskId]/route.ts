import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    let renderNodeUrl = process.env.RENDER_NODE_URL || process.env.NEXT_PUBLIC_RENDER_NODE_URL;
    if (renderNodeUrl && !/^https?:\/\//i.test(renderNodeUrl)) {
      const isLocalhost = renderNodeUrl.includes('localhost') || renderNodeUrl.includes('127.0.0.1');
      renderNodeUrl = (isLocalhost ? 'http://' : 'https://') + renderNodeUrl.trim();
    }
    
    if (!renderNodeUrl) {
      return NextResponse.json(
        { error: 'Render Node URL is not configured. Please set RENDER_NODE_URL in your environment variables.' },
        { status: 500 }
      );
    }
    
    renderNodeUrl = renderNodeUrl.replace(/\/$/, '');
    
    const response = await fetch(`${renderNodeUrl}/status/${taskId}`, {
      method: 'GET',
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
