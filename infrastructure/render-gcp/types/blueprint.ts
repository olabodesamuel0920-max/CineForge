export interface TimelineBlock {
  start: number;
  end: number;
  type?: string;
  speed: number;
  vfx?: string[];
  text?: string;
  sourceStart?: number;
  sourceEnd?: number;
  fracture?: boolean;
  speedRamp?: string;
}

import { SoundDesignSettings, SoundEvent } from '../soundDesignCompiler';

export interface AudioConfig {
  bpm?: number;
  drop_at?: number;
  settings?: SoundDesignSettings;
  events?: SoundEvent[];
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
  selected_mode?: string;
  viewer_emotion?: string;
  hook_intensity?: number;
}
