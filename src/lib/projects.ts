import { supabase, getSupabase } from './supabase';
import {
  getLocalProjects,
  saveLocalProject,
  updateLocalProject,
  deleteLocalProject
} from './storage';
import { Project, CreateProjectInput, PlatformStatus, ProjectDuration, ProjectPlatform, EditDNABlueprint, ProjectVersion, BrandPreset } from '@/types/project';
import { generateEditDNABlueprint } from './blueprints';
import { parseSoundDirection, serializeSoundDirection } from './soundDesignCompiler';

export type { CreateProjectInput };

export async function getActiveUser() {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

// Helper: map db status enum to frontend PlatformStatus structure
function mapDbStatusToPlatformStatus(dbStatus: string, maxQualityMode: boolean): PlatformStatus {
  const status: PlatformStatus = {
    blueprintEngine: 'Active',
    maxQualityPlanning: maxQualityMode ? 'Active' : 'Inactive',
    mediaAnalysis: 'Active',
    renderEngine: 'Provider Connection Pending'
  };

  switch (dbStatus) {
    case 'draft':
    case 'uploaded':
      status.mediaAnalysis = 'Preparing';
      status.renderEngine = 'Inactive';
      break;
    case 'blueprint_ready':
      status.mediaAnalysis = 'Active';
      status.renderEngine = 'Provider Connection Pending';
      break;
    case 'analysis_preparing':
      status.mediaAnalysis = 'Preparing';
      status.renderEngine = 'Preparing';
      break;
    case 'rendering':
      status.mediaAnalysis = 'Active';
      status.renderEngine = 'Preparing';
      break;
    case 'completed':
      status.mediaAnalysis = 'Active';
      status.renderEngine = 'Active';
      break;
    case 'failed':
      status.mediaAnalysis = 'Active';
      status.renderEngine = 'Inactive';
      break;
  }
  return status;
}

// Helper: map frontend PlatformStatus to db status enum
function mapPlatformStatusToDbStatus(status: PlatformStatus): 'draft' | 'uploaded' | 'blueprint_ready' | 'analysis_preparing' | 'rendering' | 'completed' | 'failed' {
  if (status.renderEngine === 'Active') return 'completed';
  if (status.renderEngine === 'Inactive') return 'failed';
  if (status.renderEngine === 'Preparing') return 'rendering';
  if (status.mediaAnalysis === 'Preparing') return 'analysis_preparing';
  return 'blueprint_ready';
}

// Helper: map raw database rows back to Domain models
function mapRowToProject(row: any): Project {
  const bp = row.blueprints ? (Array.isArray(row.blueprints) ? row.blueprints[0] : row.blueprints) : null;
  const isDemo = row.media_filename === 'promo.mp4' || row.media_filename === '/uploads/promo.mp4';
  
  return {
    id: row.id,
    title: row.title,
    selectedMode: row.selected_mode,
    maxQualityMode: row.max_quality_mode ?? false,
    mediaFilename: row.media_filename,
    mediaSize: row.media_size,
    duration: row.duration as ProjectDuration,
    platform: row.platform as ProjectPlatform,
    status: mapDbStatusToPlatformStatus(row.status, row.max_quality_mode ?? false),
    createdAt: row.created_at,
    sourceType: row.source_type ?? (isDemo ? 'demo' : 'upload'),
    sourceUrl: row.source_url ?? (isDemo ? '/uploads/promo.mp4' : undefined),
    blueprint: bp ? (() => {
      const parsedSound = parseSoundDirection(bp.sound_direction, bp.sound_direction || '');
      return {
        editTitle: bp.edit_title,
        viewerEmotion: bp.viewer_emotion,
        hookStrategy: bp.hook_strategy,
        timelineBlocks: bp.timeline_blocks || [],
        cutRhythm: bp.cut_rhythm,
        speedRampPlan: bp.speed_ramp_plan,
        vfxDirection: bp.vfx_direction,
        captionStyle: bp.caption_style,
        colorGrade: bp.color_grade,
        soundDirection: parsedSound.direction,
        maxQualityPlan: bp.max_quality_plan,
        exportRecommendation: bp.export_recommendation,
        soundDesignSettings: parsedSound.settings,
        soundEvents: parsedSound.events
      };
    })() : {
      editTitle: row.title,
      viewerEmotion: row.viewer_emotion || '',
      hookStrategy: '',
      timelineBlocks: [],
      cutRhythm: '',
      speedRampPlan: '',
      vfxDirection: '',
      captionStyle: '',
      colorGrade: '',
      soundDirection: '',
      maxQualityPlan: '',
      exportRecommendation: '',
    }
  };
}

export async function getProjects(): Promise<Project[]> {
  const user = await getActiveUser();
  if (!user) {
    return getLocalProjects();
  }
  const client = getSupabase();
  if (!client) {
    return getLocalProjects();
  }
  try {
    const { data, error } = await client
      .from('projects')
      .select('*, blueprints(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch projects from Supabase:', error.message);
      return [];
    }

    return (data || []).map(mapRowToProject);
  } catch (e) {
    console.warn('Supabase query failed, using local storage fallback.', e);
    return getLocalProjects();
  }
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const user = await getActiveUser();
  if (!user) {
    const local = getLocalProjects();
    return local.find((p) => p.id === id);
  }
  const client = getSupabase();
  if (!client) {
    const local = getLocalProjects();
    return local.find((p) => p.id === id);
  }
  try {
    const { data, error } = await client
      .from('projects')
      .select('*, blueprints(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error(`Failed to fetch project ${id} from Supabase:`, error.message);
      throw error;
    }

    return data ? mapRowToProject(data) : undefined;
  } catch (e) {
    console.error(`Supabase query threw an error for project ${id}:`, e);
    throw e;
  }
}

export async function createProject(input: CreateProjectInput, customBlueprint?: EditDNABlueprint): Promise<Project> {
  const user = await getActiveUser();
  if (!user) {
    return saveLocalProject(input, customBlueprint);
  }
  const client = getSupabase();
  if (!client) {
    return saveLocalProject(input, customBlueprint);
  }
  try {
    const blueprint = customBlueprint || generateEditDNABlueprint(
      input.title,
      input.selectedMode,
      input.prompt,
      input.duration,
      input.platform,
      input.maxQualityMode
    );

    const dbStatus = 'draft';

    const { data: projectRow, error: projectError } = await client
      .from('projects')
      .insert({
        user_id: user.id,
        title: input.title || 'Untitled Edit',
        selected_mode: input.selectedMode,
        viewer_emotion: blueprint.viewerEmotion,
        duration: input.duration,
        platform: input.platform,
        status: dbStatus,
        media_filename: input.mediaFilename || 'uploaded_media.mp4',
        max_quality_mode: input.maxQualityMode,
        media_size: input.mediaSize || '14.2 MB'
      })
      .select()
      .single();

    if (projectError || !projectRow) {
      console.error('Failed to create project in Supabase:', projectError?.message);
      throw new Error(projectError?.message || 'Failed to create project in Supabase');
    }

    const { error: blueprintError } = await client
      .from('blueprints')
      .insert({
        project_id: projectRow.id,
        edit_title: blueprint.editTitle,
        viewer_emotion: blueprint.viewerEmotion,
        hook_strategy: blueprint.hookStrategy,
        timeline_blocks: blueprint.timelineBlocks,
        cut_rhythm: blueprint.cutRhythm,
        speed_ramp_plan: blueprint.speedRampPlan,
        vfx_direction: blueprint.vfxDirection,
        caption_style: blueprint.captionStyle,
        color_grade: blueprint.colorGrade,
        sound_direction: serializeSoundDirection(
          blueprint.soundDirection,
          blueprint.soundDesignSettings || {
            enabled: true,
            intensity: 'balanced',
            preserveOriginal: 'auto',
            musicMood: 'luxury_track',
            foleyEnabled: true
          },
          blueprint.soundEvents || []
        ),
        max_quality_plan: blueprint.maxQualityPlan,
        export_recommendation: blueprint.exportRecommendation
      });

    if (blueprintError) {
      console.error('Failed to create blueprint in Supabase:', blueprintError.message);
      await client.from('projects').delete().eq('id', projectRow.id).eq('user_id', user.id);
      throw new Error(blueprintError.message);
    }

    return mapRowToProject({ ...projectRow, blueprints: [blueprint] });
  } catch (e) {
    console.warn('Supabase createProject failed, using local storage fallback.', e);
    return saveLocalProject(input, customBlueprint);
  }
}
export async function updateProject(project: Project): Promise<Project> {
  const user = await getActiveUser();
  if (!user) {
    return updateLocalProject(project);
  }
  const client = getSupabase();
  if (!client) {
    return updateLocalProject(project);
  }
  try {
    const dbStatus = mapPlatformStatusToDbStatus(project.status);

    const { error: projectError } = await client
      .from('projects')
      .update({
        title: project.title,
        media_filename: project.mediaFilename,
        status: dbStatus,
        max_quality_mode: project.maxQualityMode,
        media_size: project.mediaSize
      })
      .eq('id', project.id)
      .eq('user_id', user.id);

    if (projectError) {
      console.error(`Failed to update project ${project.id} in Supabase:`, projectError.message);
      throw new Error(projectError.message);
    }

    // Update the blueprints table
    const { error: blueprintError } = await client
      .from('blueprints')
      .update({
        edit_title: project.blueprint.editTitle,
        viewer_emotion: project.blueprint.viewerEmotion,
        hook_strategy: project.blueprint.hookStrategy,
        timeline_blocks: project.blueprint.timelineBlocks,
        cut_rhythm: project.blueprint.cutRhythm,
        speed_ramp_plan: project.blueprint.speedRampPlan,
        vfx_direction: project.blueprint.vfxDirection,
        caption_style: project.blueprint.captionStyle,
        color_grade: project.blueprint.colorGrade,
        sound_direction: serializeSoundDirection(
          project.blueprint.soundDirection,
          project.blueprint.soundDesignSettings || {
            enabled: true,
            intensity: 'balanced',
            preserveOriginal: 'auto',
            musicMood: 'luxury_track',
            foleyEnabled: true
          },
          project.blueprint.soundEvents || []
        ),
        max_quality_plan: project.blueprint.maxQualityPlan,
        export_recommendation: project.blueprint.exportRecommendation
      })
      .eq('project_id', project.id);

    if (blueprintError) {
      console.error(`Failed to update blueprint for project ${project.id} in Supabase:`, blueprintError.message);
      throw new Error(blueprintError.message);
    }

    return project;
  } catch (e) {
    console.warn(`Supabase updateProject failed for ${project.id}, writing to localStorage instead.`, e);
    return updateLocalProject(project);
  }
}
export async function deleteProject(id: string): Promise<void> {
  const user = await getActiveUser();
  if (!user) {
    return deleteLocalProject(id);
  }
  const client = getSupabase();
  if (!client) {
    return deleteLocalProject(id);
  }
  try {
    const { error } = await client
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error(`Failed to delete project ${id} from Supabase:`, error.message);
      throw new Error(error.message);
    }

    return;
  } catch (e) {
    console.warn(`Supabase deleteProject failed for ${id}, deleting from localStorage.`, e);
    return deleteLocalProject(id);
  }
}

// ==========================================
// 3. Project Versions & Brand Presets Helpers
// ==========================================

function getLocalProjectVersions(projectId: string): ProjectVersion[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(`cf_versions_${projectId}`);
    if (!data) return [];
    return JSON.parse(data) || [];
  } catch (e) {
    console.error('Failed to load local versions:', e);
    return [];
  }
}

function saveLocalProjectVersion(
  projectId: string,
  versionData: { blueprint: EditDNABlueprint; outputPath: string; diagnostics?: any }
): ProjectVersion {
  const localList = getLocalProjectVersions(projectId);
  const nextVer = localList.length > 0 ? Math.max(...localList.map(v => v.versionNumber)) + 1 : 1;
  
  const newVer: ProjectVersion = {
    id: `ver-${Math.random().toString(36).substring(2, 9)}`,
    projectId,
    versionNumber: nextVer,
    blueprint: versionData.blueprint,
    outputPath: versionData.outputPath,
    diagnostics: versionData.diagnostics,
    createdAt: new Date().toISOString()
  };

  if (typeof window !== 'undefined') {
    try {
      localList.unshift(newVer);
      localStorage.setItem(`cf_versions_${projectId}`, JSON.stringify(localList));
    } catch (e) {
      console.error('Failed to save version to localStorage:', e);
    }
  }

  return newVer;
}

export async function getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
  const user = await getActiveUser();
  if (!user) {
    return getLocalProjectVersions(projectId);
  }
  const client = getSupabase();
  if (!client) {
    return getLocalProjectVersions(projectId);
  }
  try {
    const { data, error } = await client
      .from('project_versions')
      .select('*')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error(`Failed to fetch versions for project ${projectId}:`, error.message);
      return getLocalProjectVersions(projectId);
    }

    return (data || []).map(row => ({
      id: row.id,
      projectId: row.project_id,
      versionNumber: row.version_number,
      blueprint: row.blueprint,
      outputPath: row.output_path,
      diagnostics: row.diagnostics,
      createdAt: row.created_at
    }));
  } catch (e) {
    console.warn('Supabase query failed, falling back to local storage.', e);
    return getLocalProjectVersions(projectId);
  }
}

export async function createProjectVersion(
  projectId: string,
  versionData: { blueprint: EditDNABlueprint; outputPath: string; diagnostics?: any }
): Promise<ProjectVersion> {
  const user = await getActiveUser();
  if (!user) {
    return saveLocalProjectVersion(projectId, versionData);
  }
  const client = getSupabase();
  if (!client) {
    return saveLocalProjectVersion(projectId, versionData);
  }

  try {
    const { data: existing, error: fetchError } = await client
      .from('project_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .order('version_number', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Failed to resolve version number:', fetchError.message);
      throw fetchError;
    }

    const nextVer = existing && existing.length > 0 ? existing[0].version_number + 1 : 1;

    const { data: inserted, error: insertError } = await client
      .from('project_versions')
      .insert({
        project_id: projectId,
        version_number: nextVer,
        blueprint: versionData.blueprint,
        output_path: versionData.outputPath,
        diagnostics: versionData.diagnostics || null
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('unique constraint')) {
        console.warn(`[createProjectVersion] Unique key conflict for version ${nextVer}. Fetching existing record.`);
        const { data: existingVer, error: fetchExistingError } = await client
          .from('project_versions')
          .select('*')
          .eq('project_id', projectId)
          .eq('version_number', nextVer)
          .maybeSingle();

        if (existingVer && !fetchExistingError) {
          return {
            id: existingVer.id,
            projectId: existingVer.project_id,
            versionNumber: existingVer.version_number,
            blueprint: existingVer.blueprint,
            outputPath: existingVer.output_path,
            diagnostics: existingVer.diagnostics,
            createdAt: existingVer.created_at
          };
        }
      }
      console.error('Failed to insert project version:', insertError.message);
      throw insertError;
    }

    return {
      id: inserted.id,
      projectId: inserted.project_id,
      versionNumber: inserted.version_number,
      blueprint: inserted.blueprint,
      outputPath: inserted.output_path,
      diagnostics: inserted.diagnostics,
      createdAt: inserted.created_at
    };
  } catch (e) {
    console.warn('Supabase createProjectVersion failed, falling back to local storage.', e);
    return saveLocalProjectVersion(projectId, versionData);
  }
}

function getLocalBrandPresets(): BrandPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem('cf_brand_presets');
    if (!data) return [];
    return JSON.parse(data) || [];
  } catch (e) {
    console.error('Failed to load local brand presets:', e);
    return [];
  }
}

function saveLocalBrandPreset(presetData: Omit<BrandPreset, 'id' | 'createdAt'>): BrandPreset {
  const localList = getLocalBrandPresets();
  const newPreset: BrandPreset = {
    id: `bp-${Math.random().toString(36).substring(2, 9)}`,
    name: presetData.name,
    tone: presetData.tone,
    colorMood: presetData.colorMood,
    captionStyle: presetData.captionStyle,
    ctaStyle: presetData.ctaStyle,
    platformPreference: presetData.platformPreference,
    motionStyle: presetData.motionStyle,
    soundDesignStyle: presetData.soundDesignStyle,
    createdAt: new Date().toISOString()
  };

  if (typeof window !== 'undefined') {
    try {
      localList.unshift(newPreset);
      localStorage.setItem('cf_brand_presets', JSON.stringify(localList));
    } catch (e) {
      console.error('Failed to save brand preset to localStorage:', e);
    }
  }

  return newPreset;
}

function deleteLocalBrandPreset(presetId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const presets = getLocalBrandPresets();
    const filtered = presets.filter(p => p.id !== presetId);
    localStorage.setItem('cf_brand_presets', JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to delete brand preset from localStorage:', e);
  }
}

export async function getBrandPresets(): Promise<BrandPreset[]> {
  const user = await getActiveUser();
  if (!user) {
    return getLocalBrandPresets();
  }
  const client = getSupabase();
  if (!client) {
    return getLocalBrandPresets();
  }
  try {
    const { data, error } = await client
      .from('brand_presets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch brand presets:', error.message);
      return getLocalBrandPresets();
    }

    return (data || []).map(row => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      tone: row.tone,
      colorMood: row.color_mood,
      captionStyle: row.caption_style,
      ctaStyle: row.cta_style,
      platformPreference: row.platform_preference,
      motionStyle: row.motion_style,
      soundDesignStyle: row.sound_design_style,
      createdAt: row.created_at
    }));
  } catch (e) {
    console.warn('Supabase getBrandPresets failed, falling back to local storage.', e);
    return getLocalBrandPresets();
  }
}

export async function createBrandPreset(presetData: Omit<BrandPreset, 'id' | 'createdAt'>): Promise<BrandPreset> {
  const user = await getActiveUser();
  if (!user) {
    return saveLocalBrandPreset(presetData);
  }
  const client = getSupabase();
  if (!client) {
    return saveLocalBrandPreset(presetData);
  }
  try {
    const { data, error } = await client
      .from('brand_presets')
      .insert({
        user_id: user.id,
        name: presetData.name,
        tone: presetData.tone,
        color_mood: presetData.colorMood,
        caption_style: presetData.captionStyle,
        cta_style: presetData.ctaStyle,
        platform_preference: presetData.platformPreference,
        motion_style: presetData.motionStyle,
        sound_design_style: presetData.soundDesignStyle
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Failed to create brand preset:', error?.message);
      throw error || new Error('Failed to create preset.');
    }

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      tone: data.tone,
      colorMood: data.color_mood,
      captionStyle: data.caption_style,
      ctaStyle: data.cta_style,
      platformPreference: data.platform_preference,
      motionStyle: data.motion_style,
      soundDesignStyle: data.sound_design_style,
      createdAt: data.created_at
    };
  } catch (e) {
    console.warn('Supabase createBrandPreset failed, falling back to local storage.', e);
    return saveLocalBrandPreset(presetData);
  }
}

export async function deleteBrandPreset(presetId: string): Promise<void> {
  const user = await getActiveUser();
  if (!user) {
    return deleteLocalBrandPreset(presetId);
  }
  const client = getSupabase();
  if (!client) {
    return deleteLocalBrandPreset(presetId);
  }
  try {
    const { error } = await client
      .from('brand_presets')
      .delete()
      .eq('id', presetId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to delete brand preset:', error.message);
      throw error;
    }
  } catch (e) {
    console.warn('Supabase deleteBrandPreset failed, deleting locally instead.', e);
    return deleteLocalBrandPreset(presetId);
  }
}
