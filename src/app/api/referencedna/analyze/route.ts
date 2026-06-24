import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabase } from '@/lib/supabase';
import { getRenderNodeUrl, handleWorkerResponse } from '@/lib/renderUrl';

const requestSchema = z.object({
  title: z.string().min(1, 'title is required'),
  assetPath: z.string().min(1, 'assetPath is required'),
  projectId: z.string().optional()
});

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

    const { title, assetPath, projectId } = parseResult.data;

    // 3. Reject invalid/missing asset references
    if (!assetPath.startsWith('gs://') && !assetPath.startsWith('renders/') && !assetPath.startsWith('uploads/') && !assetPath.startsWith('/uploads/') && !assetPath.startsWith('promo.mp4')) {
      return NextResponse.json(
        { error: `Invalid asset path format: ${assetPath}. Must be a valid GCS key or local reference.` },
        { status: 400 }
      );
    }

    // 4. Project ownership check (if projectId provided and authenticated)
    if (client && userId && projectId) {
      const { data: project, error: projectError } = await client
        .from('projects')
        .select('id, user_id')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) {
        console.error('[ReferenceDNA Analyze] Database project check error:', projectError.message);
        return NextResponse.json({ error: 'Database project check failed.' }, { status: 500 });
      }

      if (project && project.user_id !== userId) {
        return NextResponse.json({ error: 'Access denied. You do not own the associated project.' }, { status: 403 });
      }
    }

    // 5. Forward request to Cloud Run Worker Node
    const renderNodeUrl = getRenderNodeUrl();
    const workerSecret = process.env.RENDER_WORKER_SECRET || 'cf_sec_8f93a2e9b1d0c4d7b5f2c3a5e8f1a23b';

    console.log(`[ReferenceDNA Analyze] Dispatching style inspection task to worker: ${renderNodeUrl}/referencedna/inspect`);
    
    const workerResponse = await fetch(`${renderNodeUrl}/referencedna/inspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cineforge-worker-secret': workerSecret
      },
      body: JSON.stringify({
        title,
        assetPath,
        maxAnalyzeSeconds: 60
      })
    });

    let workerResult;
    try {
      workerResult = await handleWorkerResponse(workerResponse);
    } catch (err) {
      const errText = (err as Error).message;
      console.error(`[ReferenceDNA Analyze] Worker rejected task:`, errText);
      return NextResponse.json(
        { error: errText.includes('Worker service unavailable') ? errText : `Inspection worker failed: ${errText}` },
        { status: workerResponse.status >= 400 && workerResponse.status < 600 ? workerResponse.status : 500 }
      );
    }

    // 6. Save ReferenceDNA to Supabase or return for localStorage guest mode
    if (client && userId) {
      console.log(`[ReferenceDNA Analyze] Saving ReferenceDNA profile to Supabase database...`);
      const { data, error: dbError } = await client
        .from('reference_dnas')
        .insert({
          user_id: userId,
          title: workerResult.title,
          source_filename: workerResult.sourceFilename,
          pacing_rhythm: workerResult.pacingRhythm,
          average_shot_duration: workerResult.averageShotDuration,
          dominant_color_grade: workerResult.dominantColorGrade,
          caption_placement: workerResult.captionPlacement,
          transition_styles: workerResult.transitionStyles
        })
        .select()
        .single();

      if (dbError) {
        console.error('[ReferenceDNA Analyze] Database insert failed:', dbError.message);
        return NextResponse.json({ error: `Failed to save ReferenceDNA profile: ${dbError.message}` }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        referenceDna: data
      });
    } else {
      console.log(`[ReferenceDNA Analyze] Guest/Local mode. Returning ReferenceDNA object.`);
      // Mock unique ID for guest mode
      const guestDna = {
        id: 'guest-dna-' + Math.random().toString(36).substring(2, 9),
        title: workerResult.title,
        sourceFilename: workerResult.sourceFilename,
        pacingRhythm: workerResult.pacingRhythm,
        averageShotDuration: workerResult.averageShotDuration,
        dominantColorGrade: workerResult.dominantColorGrade,
        captionPlacement: workerResult.captionPlacement,
        transitionStyles: workerResult.transitionStyles,
        createdAt: new Date().toISOString()
      };
      
      return NextResponse.json({
        success: true,
        guest: true,
        referenceDna: guestDna
      });
    }

  } catch (err) {
    console.error('[ReferenceDNA Analyze] Unexpected handler collapse:', err);
    return NextResponse.json({ error: `Internal server error: ${(err as Error).message}` }, { status: 500 });
  }
}
