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
      const { data: success, error: rpcError } = await client.rpc('decrement_user_credit', {
        target_user_id: user.id
      });

      if (rpcError) {
        console.error('RPC decrement_user_credit failed:', rpcError.message);
        return NextResponse.json(
          { error: `Database error: ${rpcError.message}` },
          { status: 500 }
        );
      }

      if (!success) {
        return NextResponse.json(
          { error: 'Serverless Render Credits Exhausted. Upgrade to Premium for 50 Studio-Grade AI Exports.' },
          { status: 402 }
        );
      }
    }

    const body = await request.json();
    const { project } = body;
    
    if (!project || !project.id || !project.blueprint) {
      return NextResponse.json(
        { error: 'Invalid payload. Missing project metadata or blueprint registers.' },
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
      
      // Parse timestamp like "0.0s - 2.5s" or "2.5s - 7.0s"
      const matches = block.timestamp.match(/([\d\.]+)\s*s?\s*-\s*([\d\.]+)\s*s?/);
      if (matches) {
        start = parseFloat(matches[1]);
        end = parseFloat(matches[2]);
      }

      // Map speed ramps keywords to average numeric multipliers
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

    const isPortrait = project.platform !== 'YouTube';
    const targetResSetting = project.blueprint.maxQualitySettings?.resolution || (project.maxQualityMode ? '4K' : '1080p');
    const durSec = parseFloat(project.duration) || 0;

    // Face Restoration API validation guards
    if (project.blueprint.maxQualitySettings?.faceRestoration) {
      if (durSec > 10) {
        return NextResponse.json(
          { success: false, error: 'Face Restoration is restricted to clips under 10 seconds.' },
          { status: 400 }
        );
      }
      if (targetResSetting === '16K') {
        return NextResponse.json(
          { success: false, error: 'Face Restoration is restricted to 8K output. Choose classical MaxQuality or AI upscaling (up to 8K) for face restoration.' },
          { status: 400 }
        );
      }
      const provider = project.blueprint.maxQualitySettings.faceProvider || 'gfpgan';
      if (provider.toLowerCase() === 'codeformer') {
        return NextResponse.json(
          { success: false, error: 'CodeFormer is blocked in production. Please use approved commercial-safe providers.' },
          { status: 400 }
        );
      }
      const fidelity = project.blueprint.maxQualitySettings.faceFidelity ?? 0.6;
      if (fidelity < 0.5 || fidelity > 0.8) {
        return NextResponse.json(
          { success: false, error: 'Face Restoration fidelity must be clamped between 0.5 and 0.8.' },
          { status: 400 }
        );
      }
    }

    if (targetResSetting === '8K' && durSec > 10) {
      return NextResponse.json(
        { success: false, error: '8K export is restricted to clips under 10 seconds.' },
        { status: 400 }
      );
    }

    if (targetResSetting === '16K' && durSec > 5) {
      return NextResponse.json(
        { success: false, error: '16K export is restricted to clips under 5 seconds.' },
        { status: 400 }
      );
    }

    if (targetResSetting === '16K' && project.blueprint.maxQualitySettings?.neuralUpscale) {
      return NextResponse.json(
        { success: false, error: 'AI Super-Resolution is restricted to 8K output. Choose classical MaxQuality for 16K upscale.' },
        { status: 400 }
      );
    }
    
    let resolution = isPortrait ? [1080, 1920] : [1920, 1080];
    if (targetResSetting === '720p') {
      resolution = isPortrait ? [720, 1280] : [1280, 720];
    } else if (targetResSetting === '4K') {
      resolution = isPortrait ? [2160, 3840] : [3840, 2160];
    } else if (targetResSetting === '8K') {
      resolution = isPortrait ? [4320, 7680] : [7680, 4320];
    } else if (targetResSetting === '16K') {
      resolution = isPortrait ? [8640, 15360] : [15360, 8640];
    }

    const fps = project.maxQualityMode ? 60 : 30;
    const codec = project.blueprint.export?.codec || (project.maxQualityMode ? 'hevc' : 'h264');

    // 4. Assemble the Zod-compatible Render Engine Payload
    const isDemo = project.sourceType === 'demo' || project.mediaFilename === 'promo.mp4' || project.mediaFilename === '/uploads/promo.mp4';
    const sourceVideoGcsUrl = isDemo
      ? `gs://${bucketName}/raw/promo.mp4`
      : `gs://${bucketName}/raw/${project.mediaFilename}`;

    const renderPayload = {
      sourceVideoGcsUrl,
      projectDuration: project.duration,
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
          fps,
          codec
        },
        selected_mode: project.selectedMode,
        viewer_emotion: project.blueprint.viewerEmotion,
        hook_intensity: project.maxQualityMode ? 1.5 : 0.8,
        max_quality_settings: project.blueprint.maxQualitySettings || {
          stabilization: false,
          denoise: false,
          sharpen: false,
          colorRecovery: false,
          upscaleFactor: 'none',
          resolution: '1080p'
        }
      },
      taskId: project.id,
      outputGcsUrl: `gs://${bucketName}/rendered/output-${project.id}.mp4`
    };

    console.log('Forwarding render payload to Cloud Run Render Node:', JSON.stringify(renderPayload, null, 2));

    // 5. POST to Cloud Run rendering endpoint
    const response = await fetch(`${renderNodeUrl}/render`, {
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
    console.error('Failed to parse and proxy render request:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
