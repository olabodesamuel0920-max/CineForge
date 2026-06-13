import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabase } from '@/lib/supabase';

// Schema for input block validation
const timelineBlockSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  title: z.string(),
  description: z.string(),
  visualCue: z.string(),
  audioAction: z.string(),
  speedRamp: z.string(),
  fracture: z.boolean().optional(),
  caption: z.string().optional()
});

// Request body validation schema
const requestSchema = z.object({
  projectId: z.string(),
  blockId: z.string(),
  blockPrompt: z.string(),
  currentBlock: timelineBlockSchema,
  currentBlueprint: z.any().optional(),
  selectedMode: z.string().optional(),
  platform: z.string().optional(),
  duration: z.string().optional(),
  brandTone: z.string().optional()
});

// Safe local rule-based fallback block generator when AI keys are missing
function generateSafeFallbackBlock(currentBlock: any, prompt: string): any {
  const cleanPrompt = (prompt || '').toLowerCase();
  
  let title = currentBlock.title;
  let description = currentBlock.description;
  let caption = currentBlock.caption || '';
  let visualCue = currentBlock.visualCue;
  let audioAction = currentBlock.audioAction;
  let speedRamp = currentBlock.speedRamp;

  // Rule 1: Dramatic / Epic / Climax
  if (cleanPrompt.includes('dramatic') || cleanPrompt.includes('epic') || cleanPrompt.includes('cinematic') || cleanPrompt.includes('climax')) {
    title = 'DRAMATIC CLIMAX';
    description = 'High-intensity cinematic visual reveal.';
    caption = cleanPrompt.includes('caption') || cleanPrompt.includes('subtitle') ? 'UNLEASH THE DRAMA' : (caption || 'THE DRAMATIC CLIMAX');
    visualCue = 'Dynamic camera tracking shot. High contrast cinematic lighting with rich grading highlights.';
    audioAction = 'Sub-bass impact rumble synchronizing with cinematic visual drops.';
    speedRamp = 'Slow-mo (50% Speed)';
  }
  
  // Rule 2: Neon / Glow / VFX
  else if (cleanPrompt.includes('neon') || cleanPrompt.includes('glow') || cleanPrompt.includes('light') || cleanPrompt.includes('vfx')) {
    title = 'VFX NEON PULSE';
    description = 'Vibrant neon light reflections tracking subject details.';
    visualCue = 'Stylized camera tracking. VFX overlay: warm neon tracing highlights tracing the vehicle body lines.';
    audioAction = 'Synthesizer rhythmic pulses aligned with electric neon sparks.';
    speedRamp = 'Slow-mo (50% Speed)';
  }

  // Rule 3: Fast / Speed / Hyper / Whip
  else if (cleanPrompt.includes('fast') || cleanPrompt.includes('speed') || cleanPrompt.includes('hyper') || cleanPrompt.includes('whip')) {
    title = 'HYPER PACE';
    description = 'Fast kinetic movement clip.';
    visualCue = 'Whiplash pan transition with high motion-blur streaks.';
    audioAction = 'Rhythmic high-tempo percussion drop.';
    speedRamp = 'Fast (300% Speed)';
  }

  // Fallback Rule 4: Match explicit text or caption in prompt if possible
  const captionMatch = prompt.match(/(?:caption|subtitle|text)\s+(?:says?|is|of|to)\s+["']([^"']+)["']/i) 
    || prompt.match(/["']([^"']+)["']/);
  if (captionMatch && captionMatch[1]) {
    caption = captionMatch[1].toUpperCase();
  } else if (cleanPrompt.includes('no caption') || cleanPrompt.includes('remove caption') || cleanPrompt.includes('without text')) {
    caption = '';
  }

  return {
    ...currentBlock,
    title: title.toUpperCase(),
    description,
    caption,
    visualCue,
    audioAction,
    speedRamp
  };
}

export async function POST(request: Request) {
  let projectId = '';
  let currentBlock: any = null;
  let blockPrompt = '';

  try {
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    
    const client = getSupabase();
    let user = null;
    
    // Validate token if present. If invalid, return 401 immediately.
    if (token) {
      if (!client) {
        return NextResponse.json(
          { error: 'Supabase client is not configured but token was provided.' },
          { status: 500 }
        );
      }
      const { data: { user: authUser }, error: authError } = await client.auth.getUser(token);
      if (authError || !authUser) {
        console.error('[AI Block Regen] Failed to authenticate token:', authError?.message);
        return NextResponse.json(
          { error: 'Invalid or expired authentication token.' },
          { status: 401 }
        );
      }
      user = authUser;
    }

    const body = await request.json();
    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: `Invalid request parameters: ${parseResult.error.message}` },
        { status: 400 }
      );
    }
    
    const data = parseResult.data;
    projectId = data.projectId;
    currentBlock = data.currentBlock;
    blockPrompt = data.blockPrompt;

    const {
      selectedMode = 'custom',
      platform = 'TikTok',
      duration = '15s',
      brandTone = 'Neutral'
    } = data;

    // Prompt checks
    if (!blockPrompt || typeof blockPrompt !== 'string' || !blockPrompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt cannot be empty.' },
        { status: 400 }
      );
    }
    if (blockPrompt.length > 500) {
      return NextResponse.json(
        { error: 'Prompt exceeds the limit of 500 characters.' },
        { status: 400 }
      );
    }

    // Verify ownership if authenticated user
    if (user && client) {
      const { data: projectRow, error: projectError } = await client
        .from('projects')
        .select('id, user_id')
        .eq('id', projectId)
        .maybeSingle();

      if (projectError) {
        console.error('[AI Block Regen] Failed to query project for ownership validation:', projectError.message);
        return NextResponse.json(
          { error: `Database query error: ${projectError.message}` },
          { status: 500 }
        );
      }

      if (!projectRow) {
        return NextResponse.json(
          { error: 'Project not found.' },
          { status: 404 }
        );
      }

      if (projectRow.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Access denied. You do not own this project.' },
          { status: 403 }
        );
      }
    }

    // AI API Keys resolution
    const googleApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    // Fallback if no keys
    if (!googleApiKey && !openaiApiKey) {
      console.log('[AI Block Regen] No API keys configured. Running safe fallback.');
      const updatedBlock = generateSafeFallbackBlock(currentBlock, blockPrompt);
      return NextResponse.json({ success: true, block: updatedBlock, corrected: true });
    }

    const systemInstruction = `You are an elite cinematic director and video editor. Your task is to update the creative details of a SINGLE timeline edit block based on a user prompt.
You MUST preserve the block's timing and structural parameters:
- Keep the block's 'id' exactly as provided.
- Keep the block's 'timestamp' exactly as provided.
- Do NOT alter any other structural properties.

Only modify the creative, pacing, and visual cue fields:
- 'title': A concise, uppercase structural block title matching the new vibe.
- 'description': An internal descriptive log of what happens in this scene.
- 'caption': The overlay text subtitles to render on screen. (If the prompt asks for no text, set to "").
- 'visualCue': Visual camera details, lighting cues, actions, VFX overlays, composition, and movements.
- 'audioAction': Music beats sync, SFX cues, rhythmic audio guidelines.
- 'speedRamp': Select the best matching speed ramp preset from this EXACT list:
  * "Normal"
  * "Slow-mo (50% Speed)"
  * "Quarter Speed (25% Speed)"
  * "Fast-In / Slow-Out (200% -> 100%)"
  * "Fast (300% Speed)"
  * "Super Fast (400% Speed)"

Context of the project edit:
- CineForge Mode: ${selectedMode}
- Target Platform: ${platform}
- Target Total Duration: ${duration}
- Brand Mood/Tone: ${brandTone}

User prompt instructing how to modify this specific block:
"${blockPrompt}"

Current block details:
${JSON.stringify(currentBlock, null, 2)}

You must return a strictly formatted JSON object matching the requested schema. Do not return markdown, prefix text, or conversational replies.`;

    let rawText = '';

    if (googleApiKey) {
      console.log('[AI Block Regen] Dispatching block regeneration request to Google Gemini API...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `User request prompt for block update: "${blockPrompt}"` }]
              }
            ],
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  description: { type: 'STRING' },
                  caption: { type: 'STRING' },
                  visualCue: { type: 'STRING' },
                  audioAction: { type: 'STRING' },
                  speedRamp: { type: 'STRING' }
                },
                required: ['title', 'description', 'caption', 'visualCue', 'audioAction', 'speedRamp']
              }
            }
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API returned status code ${response.status}`);
      }

      const resJson = await response.json();
      const rawTextCandidate = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawTextCandidate) {
        throw new Error('Gemini API returned empty text content.');
      }
      rawText = rawTextCandidate;

    } else if (openaiApiKey) {
      console.log('[AI Block Regen] Dispatching block regeneration request to OpenAI API...');
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `${systemInstruction}\nYou must respond with a strictly formatted JSON object matching the requested schema.` },
            { role: 'user', content: `Modify this block according to: "${blockPrompt}"` }
          ],
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API returned status code ${response.status}`);
      }

      const resJson = await response.json();
      const rawTextCandidate = resJson.choices?.[0]?.message?.content;
      if (!rawTextCandidate) {
        throw new Error('OpenAI API returned empty text message content.');
      }
      rawText = rawTextCandidate;
    }

    const rawJson = JSON.parse(rawText);
    
    // Sanitize and limit creative fields length
    const sanitizedTitle = (rawJson.title || currentBlock.title || 'BLOCK').trim().substring(0, 80);
    const sanitizedDescription = (rawJson.description || currentBlock.description || '').trim().substring(0, 500);
    const sanitizedCaption = (rawJson.caption || '').trim().substring(0, 150);
    const sanitizedVisualCue = (rawJson.visualCue || currentBlock.visualCue || '').trim().substring(0, 500);
    const sanitizedAudioAction = (rawJson.audioAction || currentBlock.audioAction || '').trim().substring(0, 500);
    
    // Validate speed ramp mapping
    const validSpeedRamps = [
      "Normal",
      "Slow-mo (50% Speed)",
      "Quarter Speed (25% Speed)",
      "Fast-In / Slow-Out (200% -> 100%)",
      "Fast (300% Speed)",
      "Super Fast (400% Speed)"
    ];
    let speedRamp = rawJson.speedRamp || currentBlock.speedRamp || 'Normal';
    if (!validSpeedRamps.includes(speedRamp)) {
      speedRamp = 'Normal';
    }

    const updatedBlock = {
      ...currentBlock, // Keep id, timestamp, fracture
      title: sanitizedTitle,
      description: sanitizedDescription,
      caption: sanitizedCaption,
      visualCue: sanitizedVisualCue,
      audioAction: sanitizedAudioAction,
      speedRamp
    };

    return NextResponse.json({ success: true, block: updatedBlock });

  } catch (error) {
    console.error('[AI Block Regen] AI block regeneration failed. Falling back to rule-based fallback:', error);
    try {
      const fallbackBlock = generateSafeFallbackBlock(currentBlock, blockPrompt);
      return NextResponse.json({ success: true, block: fallbackBlock, corrected: true });
    } catch (fallbackError) {
      console.error('[AI Block Regen] Rule-based fallback also failed:', fallbackError);
      return NextResponse.json(
        { error: 'Failed to process block regeneration request.' },
        { status: 500 }
      );
    }
  }
}
