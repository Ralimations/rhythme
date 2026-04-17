
export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  file: File;
  url: string;
  duration: number;
}

export type VisualizerMode = 'waveform' | 'spectrogram' | 'particles';

export interface EQBand {
  frequency: number;
  gain: number;
}

export enum AppView {
  Library = 'library',
  Player = 'player',
  Equalizer = 'equalizer',
  BeatRunner = 'beat-runner'
}

export interface BeatNote {
  lane: number;
  time: number; // Offset in seconds from start
  duration?: number; // Optional duration for hold notes
}

export interface BeatMap {
  id: string;
  trackId: string;
  name: string;
  notes: BeatNote[];
  createdAt: number;
}
