import { supabase, getSupabase } from './supabase';
import {
  getLocalProjects,
  saveLocalProject,
  updateLocalProject,
  deleteLocalProject
} from './storage';
import { Project, CreateProjectInput, PlatformStatus, ProjectDuration, ProjectPlatform, EditDNABlueprint } from '@/types/project';
import { generateEditDNABlueprint } from './blueprints';

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
    blueprint: bp ? {
      editTitle: bp.edit_title,
      viewerEmotion: bp.viewer_emotion,
      hookStrategy: bp.hook_strategy,
      timelineBlocks: bp.timeline_blocks || [],
      cutRhythm: bp.cut_rhythm,
      speedRampPlan: bp.speed_ramp_plan,
      vfxDirection: bp.vfx_direction,
      captionStyle: bp.caption_style,
      colorGrade: bp.color_grade,
      soundDirection: bp.sound_direction,
      maxQualityPlan: bp.max_quality_plan,
      exportRecommendation: bp.export_recommendation,
    } : {
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
        sound_direction: blueprint.soundDirection,
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
