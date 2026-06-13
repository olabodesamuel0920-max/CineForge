import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabase } from '@/lib/supabase';
import { getGcsStorage } from '@/lib/gcsClient';

const requestSchema = z.object({
  projectId: z.string(),
  versionId: z.string()
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];

    if (!token) {
      return NextResponse.json({ error: 'Authentication token is required.' }, { status: 401 });
    }

    const client = getSupabase();
    if (!client) {
      return NextResponse.json({ error: 'Supabase client is not configured.' }, { status: 500 });
    }

    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) {
      console.error('[Sign URL] Auth failed:', authError?.message);
      return NextResponse.json({ error: 'Invalid or expired authentication token.' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json({ error: `Invalid request payload: ${parseResult.error.message}` }, { status: 400 });
    }

    const { projectId, versionId } = parseResult.data;

    // 1. Verify project ownership
    const { data: project, error: projectError } = await client
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError) {
      console.error('[Sign URL] Failed to query project:', projectError.message);
      return NextResponse.json({ error: `Database error: ${projectError.message}` }, { status: 500 });
    }

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }

    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied. You do not own this project.' }, { status: 403 });
    }

    // 2. Look up the stored output_path in project_versions for that versionId and projectId
    const { data: version, error: versionError } = await client
      .from('project_versions')
      .select('output_path')
      .eq('id', versionId)
      .eq('project_id', projectId)
      .maybeSingle();

    if (versionError) {
      console.error('[Sign URL] Failed to query project version:', versionError.message);
      return NextResponse.json({ error: `Database error: ${versionError.message}` }, { status: 500 });
    }

    if (!version || !version.output_path) {
      return NextResponse.json({ error: 'Project version not found or output path is empty.' }, { status: 404 });
    }

    const outputPath = version.output_path;

    // 3. Check GCS Cloud configuration
    const isCloud = process.env.RENDER_MODE === 'cloud';
    if (!isCloud) {
      // Local mode fallback URL
      return NextResponse.json({ url: outputPath.startsWith('/') ? outputPath : `/${outputPath}` });
    }

    // Generate signed GCS URL
    try {
      const bucketName = process.env.GCS_BUCKET_NAME || 'cineforge-media-bucket';
      const storage = getGcsStorage();
      
      // Clean path (remove leading slashes or gs:// prefixes if present)
      let cleanPath = outputPath;
      if (cleanPath.startsWith('gs://')) {
        const parts = cleanPath.replace('gs://', '').split('/');
        parts.shift(); // remove bucket name
        cleanPath = parts.join('/');
      } else if (cleanPath.startsWith('/')) {
        cleanPath = cleanPath.substring(1);
      }

      const file = storage.bucket(bucketName).file(cleanPath);
      const [signedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000 // 1 hour expiration
      });

      return NextResponse.json({ url: signedUrl });
    } catch (gcsError) {
      console.error('[Sign URL] GCS signing failed:', gcsError);
      return NextResponse.json({ error: 'Failed to generate secure presigned URL from Cloud Storage.' }, { status: 500 });
    }
  } catch (err) {
    console.error('[Sign URL] Unexpected handler collapse:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
