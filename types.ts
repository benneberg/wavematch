
export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'custom';

export interface AudioState {
  frequency: number;
  detune: number; // In cents
  waveType: WaveType;
  gain: number;
  filterFreq: number; // Lowpass cutoff in Hz
}

export interface LevelTolerance {
  frequency: number; // +/- Hz
  gain: number; // +/- 0.0 to 1.0
  detune: number; // +/- cents
  filterFreq?: number; // +/- Hz
}

export interface LevelConfig {
  id: number;
  difficultyTier: 0 | 1 | 2 | 3; // 0=ToneDeaf, 1=WannaBe, 2=ProDJ, 3=Guru
  name: string;
  description: string;
  target: AudioState;
  tolerance: LevelTolerance;
  locked: boolean;
}

export interface MatchResult {
  isMatch: boolean;
  scorePercent: number;
  details: {
    freqMatch: number;
    gainMatch: number;
    typeMatch: boolean;
    filterMatch: number;
    playbackRate?: number;
  }
}

export type SampleSlotId = 'ui_click' | 'ui_win' | 'ui_lose' | 'wave_custom';

export interface SampleSlot {
    id: SampleSlotId;
    name: string;
    hasAudio: boolean;
    buffer?: AudioBuffer;
}

export type GameState = 'MENU' | 'MAP' | 'PLAYING' | 'WON' | 'LOST' | 'SAMPLER';

export type GameMode = 'CAMPAIGN' | 'DAILY' | 'RANDOM' | 'NERVES' | 'SAMPLER_CLASH';
