import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';
import { getRenderNodeUrl } from '@/lib/renderUrl';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    
    const client = getSupabase();
    let user = null;
    if (client && token) {
      const { data: { user: authUser }, error: authError } = await client.auth.getUser(token);
      if (!authError && authUser) {
        user = authUser;
      }
    }

    if (user && client) {
      const { data: profile, error: profileError } = await client
        .from('profiles')
        .select('credits')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Failed to query user profile for preview credits:', profileError.message);
        return NextResponse.json(
          { error: `Database error: ${profileError.message}` },
          { status: 500 }
        );
      }

      if (!profile || (profile.credits ?? 0) <= 0) {
        return NextResponse.json(
          { error: 'Serverless Render Credits Exhausted. Upgrade to Premium for 50 Studio-Grade AI Exports.' },
          { status: 402 }
        );
      }
    }

    const body = await request.json();
    const { project, previewStart, previewDuration } = body;
    
    if (!project || !project.id || !project.blueprint) {
      return NextResponse.json(
        { error: 'Invalid payload. Missing project metadata or blueprint registers.' },
        { status: 400 }
      );
    }

    if (previewStart === undefined || previewDuration === undefined) {
      return NextResponse.json(
        { error: 'Invalid payload. Missing previewStart or previewDuration parameters.' },
        { status: 400 }
      );
    }

    const renderNodeUrl = getRenderNodeUrl();
    const bucketName = process.env.GCS_BUCKET_NAME || 'cineforge-media-bucket';

    const STRUCTURAL_TITLE_PATTERN = /^(intro|detail|energy|thematic|visual|narrative|hook|sequence|build|rise|drop|climax|cta|loop|seamless|atmospheric|opener|subject|introduction|motion|kinetic|peak|vfx|outro|block)/i;

    function cleanTitle(title?: string): string | undefined {
      if (!title) return undefined;
      return STRUCTURAL_TITLE_PATTERN.test(title.trim()) ? undefined : title.toUpperCase();
    }

    // 1. Map human-readable timeline blocks to engine-executable segments
    const timeline = project.blueprint.timelineBlocks.map((block: any) => {
      let start = 0.0;
      let end = 5.0;
      
      const matches = block.timestamp.match(/([\d\.]+)\s*s?\s*-\s*([\d\.]+)\s*s?/);
      if (matches) {
        start = parseFloat(matches[1]);
        end = parseFloat(matches[2]);
      }

      let speed = 1.0;
      const speedRampLower = (block.speedRamp || '').toLowerCase();
      if (speedRampLower.includes('25%') || speedRampLower.includes('quarter')) {
        speed = 0.25;
      } else if (speedRampLower.includes('50%') || speedRampLower.includes('half') || speedRampLower.includes('slow')) {
        speed = 0.5;
      } else if (speedRampLower.includes('400%') || speedRampLower.includes('hyper')) {
        speed = 4.0;
      } else if (speedRampLower.includes('300%')) {
        speed = 3.0;
      } else if (speedRampLower.includes('200%') || speedRampLower.includes('fast')) {
        speed = 2.0;
      }

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
        text: cleanTitle(block.caption),
        vfx: vfx.length > 0 ? vfx : undefined,
        fracture: block.fracture ?? false,
        speedRamp: block.speedRamp || ''
      };
    });

    // 2. Map color grade configurations
    let warmth = 1.0;
    let contrast = 1.0;
    let saturation = 1.0;
    
    const colorGradeLower = (project.blueprint.colorGrade || '').toLowerCase();
    if (colorGradeLower.includes('gold') || colorGradeLower.includes('warm')) {
      warmth = 1.2;
    } else if (colorGradeLower.includes('cold') || colorGradeLower.includes('teal') || colorGradeLower.includes('cool')) {
      warmth = 0.85;
    }
    
    if (colorGradeLower.includes('high contrast') || colorGradeLower.includes('drama')) {
      contrast = 1.15;
    }
    
    if (colorGradeLower.includes('desaturated') || colorGradeLower.includes('editorial') || colorGradeLower.includes('monochrome')) {
      saturation = 0.35;
    }

    // 3. Map export format configurations (forced to libx264 for fast preview)
    const isPortrait = project.platform !== 'YouTube';
    const resolution = isPortrait ? [1080, 1920] : [1920, 1080];

    // 4. Assemble the Zod-compatible Render Engine Payload
    const isDemo = project.sourceType === 'demo' || project.mediaFilename === 'promo.mp4' || project.mediaFilename === '/uploads/promo.mp4';
    const sourceVideoGcsUrl = isDemo
      ? `gs://${bucketName}/raw/promo.mp4`
      : `gs://${bucketName}/raw/${project.mediaFilename}`;

    const renderPayload = {
      sourceVideoGcsUrl,
      blueprint: {
        timeline,
        audio: {
          bpm: 120,
          drop_at: 0,
          settings: project.blueprint.soundDesignSettings || {
            enabled: true,
            intensity: 'balanced',
            preserveOriginal: 'auto',
            musicMood: 'luxury_track',
            foleyEnabled: true
          },
          events: project.blueprint.soundEvents || []
        },
        color_grade: {
          warmth,
          contrast,
          saturation
        },
        export: {
          resolution,
          fps: 30, // forced to 30fps for preview velocity
          codec: 'h264' // forced to libx264 for preview velocity
        },
        selected_mode: project.selectedMode,
        viewer_emotion: project.blueprint.viewerEmotion,
        hook_intensity: 0.8 // low intensity for preview
      },
      taskId: project.id,
      outputGcsUrl: `gs://${bucketName}/rendered/output-${project.id}.mp4`,
      previewStart: parseFloat(previewStart),
      previewDuration: parseFloat(previewDuration)
    };

    console.log('Forwarding preview payload to Cloud Run Render Node:', JSON.stringify(renderPayload, null, 2));

    // 5. POST to Cloud Run preview rendering endpoint
    const response = await fetch(`${renderNodeUrl}/render/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cineforge-worker-secret': process.env.RENDER_WORKER_SECRET || '',
      },
      body: JSON.stringify(renderPayload),
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
  } catch (error) {
    console.error('Failed to parse and proxy preview render request:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
