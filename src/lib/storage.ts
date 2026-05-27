import { Project, CreateProjectInput } from '@/types/project';
import { generateEditDNABlueprint } from './blueprints';

const LOCAL_STORAGE_KEY = 'cineforge_projects';

// Safe helper to check if window is defined (client-side)
const isClient = () => typeof window !== 'undefined';

export function getLocalProjects(): Project[] {
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

export function saveLocalProject(input: CreateProjectInput): Project {
  // Generate a local timestamp-based ID or random ID
  const id = Math.random().toString(36).substring(2, 11);
  const createdAt = new Date().toISOString();

  const status = {
    blueprintEngine: 'Active' as const,
    maxQualityPlanning: input.maxQualityMode ? ('Active' as const) : ('Inactive' as const),
    mediaAnalysis: 'Preparing' as const,
    renderEngine: 'Provider Connection Pending' as const,
  };

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
      const projects = getLocalProjects();
      projects.unshift(newProject);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
    } catch (error) {
      console.error('Failed to save new project to localStorage', error);
    }
  }

  return newProject;
}

export function updateLocalProject(project: Project): Project {
  if (isClient()) {
    try {
      const projects = getLocalProjects();
      const idx = projects.findIndex((p) => p.id === project.id);
      if (idx !== -1) {
        projects[idx] = project;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
      }
    } catch (error) {
      console.error('Failed to update project in localStorage', error);
    }
  }
  return project;
}

export function deleteLocalProject(id: string): void {
  if (!isClient()) return;
  try {
    const projects = getLocalProjects();
    const filtered = projects.filter((project) => project.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete project from localStorage', error);
  }
}
