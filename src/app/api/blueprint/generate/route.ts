import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateEditDNABlueprint } from '@/lib/blueprints';
import { ProjectDuration, ProjectPlatform, EditDNABlueprint } from '@/types/project';

// Zod schemas for input validation
const requestSchema = z.object({
  prompt: z.string(),
  selectedMode: z.string(),
  viewerEmotion: z.string(),
  duration: z.number().positive(),
  platform: z.string(),
  videoDuration: z.number().positive().optional()
});

// Zod schema for validation of raw LLM output
const llmTimelineBlockSchema = z.object({
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  title: z.string(),
  description: z.string(),
  visualCue: z.string(),
  audioAction: z.string(),
  speedRamp: z.string(),
  fracture: z.boolean()
});

const llmBlueprintSchema = z.object({
  editTitle: z.string(),
  viewerEmotion: z.string(),
  hookStrategy: z.string(),
  timelineBlocks: z.array(llmTimelineBlockSchema).nonempty(),
  cutRhythm: z.string(),
  speedRampPlan: z.string(),
  vfxDirection: z.string(),
  captionStyle: z.string(),
  colorGrade: z.string(),
  soundDirection: z.string(),
  maxQualityPlan: z.string(),
  exportRecommendation: z.string()
});

export async function POST(request: Request) {
  let prompt = '';
  let selectedMode = '';
  let viewerEmotion = '';
  let duration = 15;
  let platform = 'TikTok';
  let videoDuration: number | undefined = undefined;

  try {
    const body = await request.json();
    const parsedRequest = requestSchema.parse(body);
    prompt = parsedRequest.prompt;
    selectedMode = parsedRequest.selectedMode;
    viewerEmotion = parsedRequest.viewerEmotion;
    duration = parsedRequest.duration;
    platform = parsedRequest.platform;
    videoDuration = parsedRequest.videoDuration;
  } catch (error) {
    console.warn('Invalid request schema, falling back to rule-based compiler:', error);
    const fallback = generateSafeFallback('Untitled Edit', 'luxury-demon-reveal', 'Neutral', 15, 'TikTok');
    return NextResponse.json({ success: true, blueprint: fallback, corrected: true });
  }

  // 1. Resolve audio track for current mode and query transient peak analyzer on render node
  const DEFAULT_TRACKS: Record<string, string> = {
    'luxury-demon-reveal': 'luxury_track.mp3',
    'stadium-god-mode': 'stadium_track.mp3',
    'sugar-storm-3d': 'sugar_track.mp3',
    'fashion-drop-impact': 'fashion_track.mp3',
    'boss-entrance': 'boss_track.mp3',
    'cinematic-brand-trailer': 'brand_track.mp3',
    'street-pulse-edit': 'street_track.mp3',
    'product-awakening': 'product_track.mp3'
  };

  const trackName = DEFAULT_TRACKS[selectedMode] || 'luxury_track.mp3';
  let bpm = 120;
  let beatInterval = 0.50;
  let transients: number[] = [];

  const renderNodeUrl = process.env.RENDER_NODE_URL || process.env.NEXT_PUBLIC_RENDER_NODE_URL || 'http://localhost:8080';
  try {
    console.log(`[AI Blueprint] Fetching audio transient peaks from: ${renderNodeUrl}/analyze-audio?track=${trackName}`);
    const analysisRes = await fetch(`${renderNodeUrl}/analyze-audio?track=${trackName}`, { 
      signal: AbortSignal.timeout(6000) 
    });
    if (analysisRes.ok) {
      const analysisData = await analysisRes.json();
      bpm = analysisData.bpm || 120;
      beatInterval = analysisData.beatInterval || 0.50;
      transients = analysisData.transients || [];
      console.log(`[AI Blueprint] Audio analysis loaded. BPM: ${bpm} | Transients: ${transients.length} peaks`);
    } else {
      console.warn(`[AI Blueprint] Audio analysis route returned status ${analysisRes.status}. Using defaults.`);
    }
  } catch (err) {
    console.warn('[AI Blueprint] Failed to fetch audio analysis, falling back to standard grids:', (err as Error).message);
  }

  const googleApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;

  const systemInstruction = `You are an elite, world-class cinematic director and viral short-form short content editor. Dissect the user text prompt and create a frame-by-frame production blueprint.
You must break down the source video (from 0.0 to ${videoDuration !== undefined ? videoDuration : duration} seconds) into a sequential, perfectly matched array of timeline blocks. Every single frame block must include explicit numerical tracking values, visual canvas descriptions, and caption texts optimized for retention.

Creative parameters to follow:
- Cinematic Pacing/Style Mode: ${selectedMode}
- Target Viewer Emotion: ${viewerEmotion}
- Source Media Duration: ${videoDuration !== undefined ? videoDuration : duration} seconds (The total start-to-end duration of the source video. Your timeline blocks MUST start at 0.0 and end exactly at this duration.)
- Target Output Duration: ${duration} seconds
- Output Platform: ${platform}

SOUNDTRACK & BEAT-SNAPPING PARAMETERS:
- Soundtrack Tempo: ${bpm} BPM (Beat Interval: ${beatInterval.toFixed(3)}s)
- Rhythmic Peak Transients (Seconds): ${transients.length > 0 ? JSON.stringify(transients) : 'No high-energy transients detected. Snap to multiples of ' + beatInterval.toFixed(3) + 's instead.'}

CRITICAL PACING, TRANSITION, AND FRACTURE LAWS:
1. Every timeline block's endTime MUST fall exactly on one of the provided Rhythmic Peak Transients, or land on an integer multiple of the Beat Interval (${beatInterval.toFixed(3)}s).
2. The transition from "Energy Build" to "Climax" is the most high-impact moment. You MUST snap this block boundary to a transient timestamp.
3. Scale speed multipliers and ramp-downs (e.g. 0.5x or 0.25x slow-mo) to land precisely at the beat cut. Note: Limit audio slow-down requests to >= 0.5x to prevent pitch-distortion issues, or accept that sub-0.5x speeds will apply pitch-shift corrections.
4. Define the fracture boolean flag for each block. Set fracture: true on high-energy blocks (like the Detail Sequence, Energy Build, and Climax) when you want the rendering worker to chop the segment into rapid, beat-synced micro-clips. Keep it false for slow, linear, outro, or atmospheric opener segments.

Ensure you scale the pacing parameters, cut frequencies, and visual intensity based on these constraints. For instance, vertical formats like TikTok or YouTube Shorts need immediate high-impact hooks and rapid speed ramping, whereas YouTube landscape clips can support a slower cinematic build-up.`;

  // --- Fallback execution if no API keys are present ---
  if (!googleApiKey && !openaiApiKey) {
    console.log('[AI Blueprint] No API keys configured. Running rule-based compiler.');
    const fallback = generateSafeFallback(prompt, selectedMode, viewerEmotion, duration, platform, videoDuration);
    return NextResponse.json({ success: true, blueprint: fallback, corrected: true });
  }

  try {
    let rawText = '';
    
    // --- Google Gemini Flow ---
    if (googleApiKey) {
      console.log('[AI Blueprint] Dispatching request to Google Gemini API...');
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${googleApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: `User request prompt: "${prompt}"` }]
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
                  editTitle: { type: 'STRING' },
                  viewerEmotion: { type: 'STRING' },
                  hookStrategy: { type: 'STRING' },
                  timelineBlocks: {
                    type: 'ARRAY',
                    items: {
                      type: 'OBJECT',
                      properties: {
                        startTime: { type: 'NUMBER' },
                        endTime: { type: 'NUMBER' },
                        title: { type: 'STRING' },
                        description: { type: 'STRING' },
                        visualCue: { type: 'STRING' },
                        audioAction: { type: 'STRING' },
                        speedRamp: { type: 'STRING' },
                        fracture: { type: 'BOOLEAN' }
                      },
                      required: ['startTime', 'endTime', 'title', 'description', 'visualCue', 'audioAction', 'speedRamp', 'fracture']
                    }
                  },
                  cutRhythm: { type: 'STRING' },
                  speedRampPlan: { type: 'STRING' },
                  vfxDirection: { type: 'STRING' },
                  captionStyle: { type: 'STRING' },
                  colorGrade: { type: 'STRING' },
                  soundDirection: { type: 'STRING' },
                  maxQualityPlan: { type: 'STRING' },
                  exportRecommendation: { type: 'STRING' }
                },
                required: [
                  'editTitle', 'viewerEmotion', 'hookStrategy', 'timelineBlocks',
                  'cutRhythm', 'speedRampPlan', 'vfxDirection', 'captionStyle',
                  'colorGrade', 'soundDirection', 'maxQualityPlan', 'exportRecommendation'
                ]
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

    // --- OpenAI Flow ---
    } else if (openaiApiKey) {
      console.log('[AI Blueprint] Dispatching request to OpenAI Chat Completions API...');
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
            { role: 'user', content: `Create a blueprint for: "${prompt}"` }
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

    // --- Parsing and Validation Layer ---
    const rawJson = JSON.parse(rawText);
    const parsedLlmOutput = llmBlueprintSchema.parse(rawJson);

    // --- Normalization Loop ---
    let currentStart = 0.0;
    const maxDuration = videoDuration !== undefined ? videoDuration : duration;
    const finalBlocks = parsedLlmOutput.timelineBlocks.map((block, index) => {
      let start = currentStart;
      let end = block.endTime;

      if (index > 0) {
        // Force startTime to match previous block's endTime
        start = parsedLlmOutput.timelineBlocks[index - 1].endTime;
      }

      // Snapping final block's endTime to target duration parameter
      if (index === parsedLlmOutput.timelineBlocks.length - 1) {
        end = maxDuration;
      }

      // Update block boundaries to flow into the next iteration
      block.startTime = start;
      block.endTime = end;
      currentStart = end;

      // Compile back to strict Domain interface model type
      return {
        id: `cf-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: `${start.toFixed(1)}s - ${end.toFixed(1)}s`,
        title: block.title,
        description: block.description,
        visualCue: block.visualCue,
        audioAction: block.audioAction,
        speedRamp: block.speedRamp,
        fracture: block.fracture
      };
    });

    const validatedBlueprint: EditDNABlueprint = {
      editTitle: parsedLlmOutput.editTitle,
      viewerEmotion: parsedLlmOutput.viewerEmotion,
      hookStrategy: parsedLlmOutput.hookStrategy,
      timelineBlocks: finalBlocks,
      cutRhythm: parsedLlmOutput.cutRhythm,
      speedRampPlan: parsedLlmOutput.speedRampPlan,
      vfxDirection: parsedLlmOutput.vfxDirection,
      captionStyle: parsedLlmOutput.captionStyle,
      colorGrade: parsedLlmOutput.colorGrade,
      soundDirection: parsedLlmOutput.soundDirection,
      maxQualityPlan: parsedLlmOutput.maxQualityPlan,
      exportRecommendation: parsedLlmOutput.exportRecommendation
    };

    return NextResponse.json({ success: true, blueprint: validatedBlueprint });

  } catch (error) {
    // Catch model format collapses, parse errors, or validation constraint failures
    console.error('AI Blueprint validation failed. Falling back to pre-calibrated default:', error);
    const fallback = generateSafeFallback(prompt, selectedMode, viewerEmotion, duration, platform, videoDuration);
    return NextResponse.json({ success: true, blueprint: fallback, corrected: true });
  }
}

// Generates a fully compatible fallback EditDNABlueprint using the static rule-compiler
function generateSafeFallback(
  prompt: string,
  selectedMode: string,
  viewerEmotion: string,
  duration: number,
  platform: string,
  videoDuration?: number
): EditDNABlueprint {
  const finalDuration = videoDuration !== undefined ? videoDuration : duration;
  const durationParam = (finalDuration ? `${finalDuration}s` : '15s') as ProjectDuration;
  const platformParam = (platform || 'TikTok') as ProjectPlatform;
  
  const baseBlueprint = generateEditDNABlueprint(
    prompt.substring(0, 30) || 'Untitled Edit',
    selectedMode,
    prompt || '',
    durationParam,
    platformParam,
    false
  );

  // If we conformed based on a videoDuration that differs from standard splits,
  // we scale the blocks' start and end times in baseBlueprint.timelineBlocks
  if (videoDuration !== undefined && videoDuration !== duration) {
    const scaleFactor = videoDuration / duration;
    let currentStart = 0.0;
    
    baseBlueprint.timelineBlocks = baseBlueprint.timelineBlocks.map((block, index) => {
      const originalStart = index === 0 ? 0 : parseFloat(baseBlueprint.timelineBlocks[index - 1].timestamp.split(' - ')[1]);
      const originalEnd = parseFloat(block.timestamp.split(' - ')[1]);
      
      const newStart = currentStart;
      let newEnd = originalEnd * scaleFactor;
      if (index === baseBlueprint.timelineBlocks.length - 1) {
        newEnd = videoDuration;
      }
      currentStart = newEnd;
      
      return {
        ...block,
        timestamp: `${newStart.toFixed(1)}s - ${newEnd.toFixed(1)}s`
      };
    });
  }

  return baseBlueprint;
}
