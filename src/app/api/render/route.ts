import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { project } = body;
    
    if (!project || !project.id || !project.blueprint) {
      return NextResponse.json(
        { error: 'Invalid payload. Missing project metadata or blueprint registers.' },
        { status: 400 }
      );
    }

    const renderNodeUrl = process.env.RENDER_NODE_URL || process.env.NEXT_PUBLIC_RENDER_NODE_URL;
    const bucketName = process.env.GCS_BUCKET_NAME || 'cineforge-media-bucket';
    
    if (!renderNodeUrl) {
      return NextResponse.json(
        { error: 'Render Node URL is not configured. Please set RENDER_NODE_URL in your environment variables.' },
        { status: 500 }
      );
    }

    // 1. Map human-readable timeline blocks to engine-executable segments
    const timeline = project.blueprint.timelineBlocks.map((block: any) => {
      let start = 0.0;
      let end = 5.0;
      
      // Parse timestamp like "0.0s - 2.5s" or "2.5s - 7.0s"
      const matches = block.timestamp.match(/([\d\.]+)\s*s?\s*-\s*([\d\.]+)\s*s?/);
      if (matches) {
        start = parseFloat(matches[1]);
        end = parseFloat(matches[2]);
      }

      // Map speed ramps keywords to average numeric multipliers
      let speed = 1.0;
      const speedRampLower = (block.speedRamp || '').toLowerCase();
      if (speedRampLower.includes('slow') || speedRampLower.includes('25%') || speedRampLower.includes('50%')) {
        speed = 0.5;
      } else if (speedRampLower.includes('fast') || speedRampLower.includes('200%') || speedRampLower.includes('300%')) {
        speed = 1.5;
      }

      // Map VFX tags
      const vfx: string[] = [];
      const titleLower = (block.title || '').toLowerCase();
      const descLower = (block.description || '').toLowerCase();
      const visualLower = (block.visualCue || '').toLowerCase();
      
      if (titleLower.includes('glow') || descLower.includes('glow') || visualLower.includes('glow')) {
        vfx.push('glow_text');
      }
      if (titleLower.includes('warm') || descLower.includes('warm') || visualLower.includes('warm') || visualLower.includes('gold')) {
        vfx.push('warm_push');
      }

      return {
        start,
        end,
        speed,
        text: block.title ? block.title.toUpperCase() : 'CINEFORGE SHOT',
        vfx: vfx.length > 0 ? vfx : undefined
      };
    });

    // 2. Map color grade configurations
    let warmth = 1.0;
    let contrast = 1.0;
    let saturation = 1.0;
    
    const colorGradeLower = (project.blueprint.colorGrade || '').toLowerCase();
    if (colorGradeLower.includes('gold') || colorGradeLower.includes('warm')) {
      warmth = 1.2;
    } else if (colorGradeLower.includes('cold') || colorGradeLower.includes('teal')) {
      warmth = 0.85;
    }
    
    if (colorGradeLower.includes('high contrast') || colorGradeLower.includes('drama')) {
      contrast = 1.15;
    }
    
    if (colorGradeLower.includes('desaturated') || colorGradeLower.includes('editorial')) {
      saturation = 0.85;
    }

    // 3. Map export format configurations
    const isPortrait = project.platform !== 'YouTube';
    const resolution = isPortrait ? [1080, 1920] : [1920, 1080];
    const fps = project.maxQualityMode ? 60 : 30;
    const codec = project.maxQualityMode ? 'hevc' : 'h264';

    // 4. Assemble the Zod-compatible Render Engine Payload
    const renderPayload = {
      sourceVideoGcsUrl: `gs://${bucketName}/raw/${project.mediaFilename}`,
      blueprint: {
        timeline,
        color_grade: {
          warmth,
          contrast,
          saturation
        },
        export: {
          resolution,
          fps,
          codec
        },
        selected_mode: project.selectedMode,
        viewer_emotion: project.blueprint.viewerEmotion,
        hook_intensity: project.maxQualityMode ? 1.5 : 0.8
      },
      taskId: project.id,
      outputGcsUrl: `gs://${bucketName}/rendered/output-${project.id}.mp4`
    };

    console.log('Forwarding render payload to Cloud Run Render Node:', JSON.stringify(renderPayload, null, 2));

    // 5. POST to Cloud Run rendering endpoint
    const response = await fetch(`${renderNodeUrl.replace(/\/$/, '')}/render`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(renderPayload),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error('Failed to parse and proxy render request:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
