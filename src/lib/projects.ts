import { Project, ProjectDuration, ProjectPlatform, PlatformStatus } from '@/types/project';
import { generateEditDNABlueprint } from './blueprints';

const LOCAL_STORAGE_KEY = 'cineforge_projects';

// Safe helper to check if window is defined (client-side)
const isClient = () => typeof window !== 'undefined';

export function getProjects(): Project[] {
  if (!isClient()) return [];
  try {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load projects from localStorage', error);
    return [];
  }
}

export function getProjectById(id: string): Project | undefined {
  const projects = getProjects();
  return projects.find((project) => project.id === id);
}

export interface CreateProjectInput {
  title: string;
  selectedMode: string;
  maxQualityMode: boolean;
  mediaFilename: string;
  mediaSize?: string;
  duration: ProjectDuration;
  platform: ProjectPlatform;
  prompt: string;
}

export function createProject(input: CreateProjectInput): Project {
  const id = Math.random().toString(36).substring(2, 11);
  const createdAt = new Date().toISOString();

  // Determine engine statuses honestly
  const status: PlatformStatus = {
    blueprintEngine: 'Active',
    maxQualityPlanning: input.maxQualityMode ? 'Active' : 'Inactive',
    mediaAnalysis: 'Preparing',
    renderEngine: 'Provider Connection Pending',
  };

  // Generate EditDNA Blueprint
  const blueprint = generateEditDNABlueprint(
    input.title,
    input.selectedMode,
    input.prompt,
    input.duration,
    input.platform,
    input.maxQualityMode
  );

  const newProject: Project = {
    id,
    title: input.title || 'Untitled Edit',
    selectedMode: input.selectedMode,
    maxQualityMode: input.maxQualityMode,
    mediaFilename: input.mediaFilename || 'uploaded_media.mp4',
    mediaSize: input.mediaSize || '14.2 MB',
    duration: input.duration,
    platform: input.platform,
    status,
    createdAt,
    blueprint,
  };

  if (isClient()) {
    try {
      const projects = getProjects();
      projects.unshift(newProject); // Prepend so newest is at the top
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
    } catch (error) {
      console.error('Failed to save new project to localStorage', error);
    }
  }

  return newProject;
}

export function deleteProject(id: string): void {
  if (!isClient()) return;
  try {
    const projects = getProjects();
    const filtered = projects.filter((project) => project.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete project from localStorage', error);
  }
}
