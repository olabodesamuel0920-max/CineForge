import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabase } from '@/lib/supabase';
import { getRenderNodeUrl, handleWorkerResponse } from '@/lib/renderUrl';

// Stricter request validation
const requestSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  assetPath: z.string().min(1, 'assetPath is required'),
  selectedNiche: z.string().min(1, 'selectedNiche is required'),
  selectedPreset: z.string().min(1, 'selectedPreset is required'),
  maxAnalyzeSeconds: z.number().int().positive().optional().default(60),
  useGemini: z.boolean().optional().default(false),
  analysisSettings: z.record(z.string(), z.any()).optional()
});

// Server-side in-memory cache to prevent redundant analysis calls for the same asset
const analysisCache = new Map<string, any>();

export async function POST(request: Request) {
  try {
    // 1. Authenticate user session
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    let userId: string | undefined = undefined;
    const client = getSupabase();
    if (client && token) {
      const { data: { user }, error: authError } = await client.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
      }
    }

    // 2. Parse and validate body
    const body = await request.json();
    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: `Invalid request payload: ${parseResult.error.message}` },
        { status: 400 }
      );
    }

    const { projectId, assetPath, selectedNiche, selectedPreset, maxAnalyzeSeconds } = parseResult.data;

    // 3. Reject invalid/missing asset references
    if (!assetPath.startsWith('gs://') && !assetPath.startsWith('renders/') && !assetPath.startsWith('uploads/') && !assetPath.startsWith('/uploads/') && !assetPath.startsWith('promo.mp4')) {
      return NextResponse.json(
        { error: `Invalid asset path format: ${assetPath}. Must be a valid GCS key or local reference.` },
        { status: 400 }
      );
    }

    // 4. Project ownership check (if authenticated)
    if (client && userId) {
      const { data: project, error: projectError } = await client
        .from('projects')
        .select('id, user_id')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) {
        console.error('[AutoDirector Inspect] Database error:', projectError.message);
        return NextResponse.json({ error: 'Database verification failed.' }, { status: 500 });
      }

      if (project && project.user_id !== userId) {
        return NextResponse.json({ error: 'Access denied. You do not own this project.' }, { status: 403 });
      }
    }

    // 5. Cache check to avoid repeated Gemini/analysis costs
    const cacheKey = `${projectId}-${assetPath}-${selectedNiche}-${selectedPreset}-${maxAnalyzeSeconds}`;
    if (analysisCache.has(cacheKey)) {
      console.log(`[AutoDirector Inspect] Serving cached analysis for key: ${cacheKey}`);
      return NextResponse.json(analysisCache.get(cacheKey));
    }

    // 6. Forward request to Cloud Run Worker Node
    const renderNodeUrl = getRenderNodeUrl();
    const workerSecret = process.env.RENDER_WORKER_SECRET || 'cf_sec_8f93a2e9b1d0c4d7b5f2c3a5e8f1a23b';

    console.log(`[AutoDirector Inspect] Dispatching inspection task to worker: ${renderNodeUrl}/autodirector/inspect`);
    
    const workerResponse = await fetch(`${renderNodeUrl}/autodirector/inspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cineforge-worker-secret': workerSecret
      },
      body: JSON.stringify({
        projectId,
        assetPath,
        selectedNiche,
        selectedPreset,
        maxAnalyzeSeconds
      })
    });

    try {
      const workerResult = await handleWorkerResponse(workerResponse);
      
      // Cache the successful result
      analysisCache.set(cacheKey, workerResult);

      return NextResponse.json(workerResult);
    } catch (err) {
      const errText = (err as Error).message;
      console.error(`[AutoDirector Inspect] Worker rejected task:`, errText);
      return NextResponse.json(
        { error: errText.includes('Worker service unavailable') ? errText : `Inspection worker failed: ${errText}` },
        { status: workerResponse.status >= 400 && workerResponse.status < 600 ? workerResponse.status : 500 }
      );
    }

  } catch (err) {
    console.error('[AutoDirector Inspect] Unexpected handler collapse:', err);
    return NextResponse.json({ error: `Internal server error: ${(err as Error).message}` }, { status: 500 });
  }
}
