export interface TimelineBlock {
  start: number;
  end: number;
  type?: string;
  speed: number;
  vfx?: string[];
  text?: string;
}

export interface AudioConfig {
  bpm?: number;
  drop_at?: number;
}

export interface ColorGrade {
  warmth?: number;
  contrast?: number;
  saturation?: number;
}

export interface ExportConfig {
  resolution?: [number, number];
  fps?: number;
  codec?: string;
}

export interface Blueprint {
  timeline: TimelineBlock[];
  audio?: AudioConfig;
  color_grade?: ColorGrade;
  export?: ExportConfig;
}
