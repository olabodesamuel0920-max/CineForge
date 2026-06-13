import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabase } from '@/lib/supabase';
import { AutoDirectorAnalysis } from '@/types/autodirector';

const requestSchema = z.object({
  projectId: z.string(),
  assetPath: z.string(),
  selectedNiche: z.string(),
  analysisSettings: z.record(z.string(), z.any()).optional(),
  referenceDnaId: z.string().optional()
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

    const { projectId, assetPath, selectedNiche, referenceDnaId } = parseResult.data;

    // 3. Project ownership check (if authenticated)
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

    // 4. Return G4.1 placeholder analysis response
    // (Actual heavy visual processing like OpenCV or LLM video probe will run on the Cloud Run worker in future phases)
    const mockAnalysis: AutoDirectorAnalysis = {
      detectedNiche: selectedNiche,
      dominantColorPalette: ['#1a1a2e', '#16213e', '#0f3460'],
      usableDuration: 15.0,
      unusableClips: [],
      compositionSequence: [
        {
          startTime: 0.0,
          endTime: 3.0,
          shotType: 'wide_establishing',
          subjectDescription: `Establishing showcase segment conformed to ${selectedNiche} aesthetics.`,
          motionIntensity: 'slow_drift',
          usableScore: 9.5
        },
        {
          startTime: 3.0,
          endTime: 8.0,
          shotType: 'medium_action',
          subjectDescription: `Action detail sequence showing core ${selectedNiche} subject interaction.`,
          motionIntensity: 'rapid_pan',
          usableScore: 8.8
        },
        {
          startTime: 8.0,
          endTime: 15.0,
          shotType: 'close_up',
          subjectDescription: `Macro focus shot framing highlight product and call-to-action outtro.`,
          motionIntensity: 'static',
          usableScore: 9.2
        }
      ]
    };

    return NextResponse.json({
      success: true,
      projectId,
      assetPath,
      referenceDnaId: referenceDnaId || null,
      analysis: mockAnalysis
    });
  } catch (err) {
    console.error('[AutoDirector Inspect] Unexpected handler collapse:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
