import { WaveType, AudioState, LevelTolerance, MatchResult, SampleSlotId } from '../types';

type BufferUpdateListener = (id: SampleSlotId) => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  
  // User Nodes
  private userOsc: OscillatorNode | null = null;
  private userBufferSource: AudioBufferSourceNode | null = null; // For custom samples
  private userGain: GainNode | null = null;
  private userFilter: BiquadFilterNode | null = null; // New Filter Node
  public userAnalyser: AnalyserNode | null = null;

  // Target Nodes
  private targetOsc: OscillatorNode | null = null;
  private targetGain: GainNode | null = null;
  private targetFilter: BiquadFilterNode | null = null; // New Filter Node
  public targetAnalyser: AnalyserNode | null = null;

  private isPlaying: boolean = false;
  private isTargetAudible: boolean = false;

  // Sampler State
  private buffers: Map<SampleSlotId, AudioBuffer> = new Map();
  public activeCustomSourceId: SampleSlotId | null = null; // Track which slot is equipped
  private mediaStream: MediaStream | null = null;
  private listeners: BufferUpdateListener[] = [];

  constructor() {
    // Lazy init
  }

  init() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass({ latencyHint: 'interactive' });
      
      this.userAnalyser = this.ctx.createAnalyser();
      this.userAnalyser.fftSize = 2048;
      this.userAnalyser.smoothingTimeConstant = 0.5; 
      
      this.targetAnalyser = this.ctx.createAnalyser();
      this.targetAnalyser.fftSize = 2048;
      this.targetAnalyser.smoothingTimeConstant = 0.5;

      // Load default sounds
      this.generateDefaultSamples();
    }
  }

  async resume() {
    if (!this.ctx) {
        this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // --- SAMPLER FUNCTIONS ---

  subscribe(listener: BufferUpdateListener) {
      this.listeners.push(listener);
      return () => {
          this.listeners = this.listeners.filter(l => l !== listener);
      };
  }

  private notifyListeners(id: SampleSlotId) {
      this.listeners.forEach(l => l(id));
  }

  private generateDefaultSamples() {
      if (!this.ctx) return;
      
      // Click
      const sr = this.ctx.sampleRate;
      const clickBuf = this.ctx.createBuffer(1, sr * 0.1, sr);
      const d1 = clickBuf.getChannelData(0);
      for(let i=0; i<d1.length; i++) d1[i] = Math.sin(i * 0.1) * Math.exp(-i * 0.05);
      this.buffers.set('ui_click', clickBuf);

      // Win
      const winBuf = this.ctx.createBuffer(1, sr * 0.5, sr);
      const d2 = winBuf.getChannelData(0);
      for(let i=0; i<d2.length; i++) {
          const t = i / sr;
          d2[i] = (Math.sin(t * 440 * Math.PI * 2) + Math.sin(t * 554 * Math.PI * 2) + Math.sin(t * 659 * Math.PI * 2)) * 0.3 * (1-t/0.5);
      }
      this.buffers.set('ui_win', winBuf);

      // Lose
      const loseBuf = this.ctx.createBuffer(1, sr * 0.5, sr);
      const d3 = loseBuf.getChannelData(0);
      for(let i=0; i<d3.length; i++) {
           const t = i / sr;
           d3[i] = (Math.random() * 2 - 1) * Math.exp(-t * 2);
      }
      this.buffers.set('ui_lose', loseBuf);
  }

  playSample(id: SampleSlotId) {
      if (!this.ctx) this.init();
      if (!this.ctx || !this.buffers.has(id)) return;

      try {
          const source = this.ctx.createBufferSource();
          source.buffer = this.buffers.get(id)!;
          const gain = this.ctx.createGain();
          gain.gain.value = 0.5;
          source.connect(gain);
          gain.connect(this.ctx.destination);
          source.start();
      } catch(e) {
          console.error("Failed to play sample", e);
      }
  }

  async recordAudio(duration: number): Promise<AudioBuffer | null> {
      if (!this.ctx) this.init();
      if (!this.ctx) return null;

      if (this.ctx.state === 'suspended') {
          await this.ctx.resume();
      }

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
              audio: { 
                  echoCancellation: false, 
                  autoGainControl: false,
                  noiseSuppression: false 
              } 
          });
          
          this.mediaStream = stream;
          
          // iOS Safari Fix: Prefer mp4, fallback to webm, fallback to default
          const types = [
              'audio/mp4',
              'audio/webm;codecs=opus',
              'audio/webm',
              ''
          ];
          const mimeType = types.find(t => t === '' || MediaRecorder.isTypeSupported(t)) || '';
          
          const options = mimeType ? { mimeType } : undefined;
          const recorder = new MediaRecorder(stream, options);
          
          return new Promise((resolve, reject) => {
              const chunks: Blob[] = [];
              
              recorder.ondataavailable = (e) => {
                  if (e.data.size > 0) chunks.push(e.data);
              };
              
              recorder.onstop = async () => {
                  try {
                      const blob = new Blob(chunks, { type: recorder.mimeType });
                      const arrayBuffer = await blob.arrayBuffer();
                      const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
                      stream.getTracks().forEach(t => t.stop());
                      resolve(audioBuffer);
                  } catch (decodeErr) {
                      console.error("Decode error", decodeErr);
                      reject(new Error("Audio decode failed. Format not supported?"));
                  }
              };
              
              recorder.onerror = (e) => {
                  reject(e);
              };
              
              recorder.start();
              setTimeout(() => {
                  if (recorder.state === 'recording') recorder.stop();
              }, duration);
          });
      } catch (e) {
          console.error("Mic access denied or failed", e);
          throw e;
      }
  }

  async uploadAudio(file: File): Promise<AudioBuffer | null> {
      if (!this.ctx) this.init();
      if (!this.ctx) return null;
      
      try {
          const arrayBuffer = await file.arrayBuffer();
          return await this.ctx.decodeAudioData(arrayBuffer);
      } catch (e) {
          console.error("File decode failed", e);
          return null;
      }
  }

  assignBuffer(id: SampleSlotId, buffer: AudioBuffer) {
      this.buffers.set(id, buffer);
      // If we are overwriting the currently active source, update the custom wave immediately
      if (this.activeCustomSourceId === id) {
          this.buffers.set('wave_custom', buffer);
          this.notifyListeners('wave_custom');
      }
      this.notifyListeners(id);
  }
  
  copyBuffer(sourceId: SampleSlotId, destId: SampleSlotId) {
      if (this.buffers.has(sourceId)) {
          this.buffers.set(destId, this.buffers.get(sourceId)!);
          
          if (destId === 'wave_custom') {
              this.activeCustomSourceId = sourceId;
          }
          
          this.notifyListeners(destId);
      }
  }

  hasBuffer(id: SampleSlotId): boolean {
      return this.buffers.has(id);
  }

  // --- GAME ENGINE FUNCTIONS ---

  restartUserChain(userParams: AudioState) {
      if (!this.ctx || !this.userGain || !this.userFilter) return;

      const now = this.ctx.currentTime;

      // 1. Teardown existing source
      if (this.userOsc) {
        try { this.userOsc.stop(); this.userOsc.disconnect(); } catch(e) {}
        this.userOsc = null;
      }
      if (this.userBufferSource) {
        try { this.userBufferSource.stop(); this.userBufferSource.disconnect(); } catch(e) {}
        this.userBufferSource = null;
      }

      // 2. Rebuild based on type
      if (userParams.waveType === 'custom' && this.buffers.has('wave_custom')) {
        this.userBufferSource = this.ctx.createBufferSource();
        this.userBufferSource.buffer = this.buffers.get('wave_custom')!;
        this.userBufferSource.loop = true;
        
        const rate = Math.max(0.1, userParams.frequency / 440);
        this.userBufferSource.playbackRate.setValueAtTime(rate, now);
        this.userBufferSource.detune.setValueAtTime(userParams.detune, now);
        
        // Connect to Filter -> Gain
        this.userBufferSource.connect(this.userFilter);
        this.userBufferSource.start(now);

      } else {
        this.userOsc = this.ctx.createOscillator();
        this.userOsc.type = userParams.waveType === 'custom' ? 'sine' : userParams.waveType;
        this.userOsc.frequency.setValueAtTime(userParams.frequency, now);
        this.userOsc.detune.setValueAtTime(userParams.detune, now);
        
        // Connect to Filter -> Gain
        this.userOsc.connect(this.userFilter);
        this.userOsc.start(now);
      }

      // Update filter frequency immediately (Safety: Default to 20000 if invalid)
      const safeFilterFreq = (userParams.filterFreq && !isNaN(userParams.filterFreq)) ? userParams.filterFreq : 20000;
      this.userFilter.frequency.setValueAtTime(safeFilterFreq, now);
  }

  start(userParams: AudioState, targetParams: AudioState) {
    this.init();
    if (!this.ctx) return;
    
    this.stop();

    // --- USER CHAIN ---
    // Chain: Source -> Filter -> Gain -> Analyser -> Dest
    this.userGain = this.ctx.createGain();
    this.userGain.gain.value = userParams.gain;
    
    this.userFilter = this.ctx.createBiquadFilter();
    this.userFilter.type = 'lowpass';
    this.userFilter.Q.value = 1;
    // Safety check for user filter
    const safeUserFilter = (userParams.filterFreq && !isNaN(userParams.filterFreq)) ? userParams.filterFreq : 20000;
    this.userFilter.frequency.value = safeUserFilter;

    this.userFilter.connect(this.userGain);
    this.userGain.connect(this.userAnalyser!);
    this.userAnalyser!.connect(this.ctx.destination);

    this.restartUserChain(userParams);

    // --- TARGET CHAIN ---
    this.targetGain = this.ctx.createGain();
    this.targetFilter = this.ctx.createBiquadFilter();
    this.targetFilter.type = 'lowpass';
    this.targetFilter.Q.value = 1;
    
    // Safety check for target filter
    const safeTargetFilter = (targetParams.filterFreq && !isNaN(targetParams.filterFreq)) ? targetParams.filterFreq : 20000;
    this.targetFilter.frequency.value = safeTargetFilter;

    // Setup Target Source
    const now = this.ctx.currentTime;
    
    if (targetParams.waveType === 'custom' && this.buffers.has('wave_custom')) {
         const targetBufSrc = this.ctx.createBufferSource();
         targetBufSrc.buffer = this.buffers.get('wave_custom')!;
         targetBufSrc.loop = true;
         const rate = Math.max(0.1, targetParams.frequency / 440);
         targetBufSrc.playbackRate.value = rate;
         targetBufSrc.detune.value = targetParams.detune;
         targetBufSrc.connect(this.targetFilter);
         targetBufSrc.start(now);
         (this.targetOsc as any) = targetBufSrc;
    } else {
         this.targetOsc = this.ctx.createOscillator();
         this.targetOsc.type = targetParams.waveType === 'custom' ? 'sine' : targetParams.waveType;
         this.targetOsc.frequency.value = targetParams.frequency;
         this.targetOsc.detune.value = targetParams.detune;
         this.targetOsc.connect(this.targetFilter);
         this.targetOsc.start(now);
    }

    this.targetFilter.connect(this.targetGain);
    this.targetGain.gain.value = targetParams.gain;
    this.targetGain.connect(this.targetAnalyser!);
    
    this.isPlaying = true;
    this.isTargetAudible = false;
  }

  stop() {
    const stopNode = (node: any) => {
        if (node) {
            try { node.stop(); node.disconnect(); } catch(e) {}
        }
    };
    
    stopNode(this.userOsc);
    stopNode(this.userBufferSource);
    stopNode(this.targetOsc); // This handles both Osc and BufferSource due to 'any' cast above

    this.userOsc = null;
    this.userBufferSource = null;
    this.targetOsc = null;

    if (this.targetAnalyser && this.ctx) {
        try { this.targetAnalyser.disconnect(this.ctx.destination); } catch(e) {}
    }

    this.isPlaying = false;
    this.isTargetAudible = false;
  }

  updateUser(params: AudioState) {
    if (!this.userGain || !this.ctx || !this.userFilter) return;
    
    const now = this.ctx.currentTime;
    
    // Update Gain
    if (!this.isTargetAudible) {
        this.userGain.gain.setTargetAtTime(params.gain, now, 0.02);
    }

    // Update Filter
    const safeFilter = (params.filterFreq && !isNaN(params.filterFreq)) ? params.filterFreq : 20000;
    this.userFilter.frequency.setTargetAtTime(safeFilter, now, 0.05);

    // Update Pitch/Wave
    if (this.userOsc) {
         this.userOsc.frequency.setTargetAtTime(Math.max(1, params.frequency), now, 0.02);
         this.userOsc.detune.setTargetAtTime(params.detune, now, 0.02);
         
         if (params.waveType !== 'custom' && this.userOsc.type !== params.waveType) {
             this.userOsc.type = params.waveType;
         }
    } 
    else if (this.userBufferSource) {
         const rate = Math.max(0.1, params.frequency / 440);
         this.userBufferSource.playbackRate.setTargetAtTime(rate, now, 0.02);
         this.userBufferSource.detune.setTargetAtTime(params.detune, now, 0.02);
    }
  }

  toggleTargetAudio(enable: boolean, restoreGain: number) {
    if (!this.targetAnalyser || !this.ctx || !this.isPlaying || !this.userGain) return;
    
    const now = this.ctx.currentTime;

    if (enable) {
      if (this.isTargetAudible) return; 
      try {
        this.targetAnalyser.connect(this.ctx.destination);
        this.isTargetAudible = true;
        this.userGain.gain.cancelScheduledValues(now);
        this.userGain.gain.setTargetAtTime(0, now, 0.05);
      } catch (e) { console.error(e); }
      
    } else {
      if (!this.isTargetAudible) return;
      try {
        this.targetAnalyser.disconnect(this.ctx.destination);
        this.isTargetAudible = false;
        this.userGain.gain.cancelScheduledValues(now);
        this.userGain.gain.setTargetAtTime(restoreGain, now, 0.05);
      } catch (e) { console.warn(e); }
    }
  }

  getAnalysisData() {
    if (!this.userAnalyser || !this.targetAnalyser) return null;

    const bufferLength = this.userAnalyser.frequencyBinCount;
    const userTime = new Uint8Array(bufferLength);
    const targetTime = new Uint8Array(bufferLength);

    this.userAnalyser.getByteTimeDomainData(userTime);
    this.targetAnalyser.getByteTimeDomainData(targetTime);

    return { userTime, targetTime };
  }

  evaluateMatch(user: AudioState, target: AudioState, tolerance: LevelTolerance): MatchResult {
    // If modes mismatch (e.g. playing normal mode with custom wave somehow)
    if (user.waveType !== target.waveType) {
         return { 
            isMatch: false, 
            scorePercent: 0, 
            details: { freqMatch: 0, gainMatch: 0, typeMatch: false, filterMatch: 0 } 
         };
    }

    // --- FREQUENCY / PLAYBACK RATE MATCH ---
    let freqScore = 0;
    let isFreqPass = false;

    if (user.waveType === 'custom') {
        // For custom waves, 'frequency' is used to drive playback rate
        // We compare the ratio. 
        const userRate = user.frequency / 440; // Normalized
        const targetRate = target.frequency / 440;
        const diff = Math.abs(userRate - targetRate);
        const rateTol = (tolerance.frequency / 440) * 5.0; // Scale tolerance
        
        freqScore = Math.max(0, 1 - (diff / rateTol));
        isFreqPass = diff <= (rateTol * 0.5); // Stricter pass condition
    } else {
        const freqDiff = Math.abs(user.frequency - target.frequency);
        freqScore = Math.max(0, 1 - (freqDiff / (tolerance.frequency * 5.0))); 
        isFreqPass = freqDiff <= tolerance.frequency;
    }

    // --- GAIN MATCH ---
    const gainDiff = Math.abs(user.gain - target.gain);
    const gainScore = Math.max(0, 1 - (gainDiff / (tolerance.gain * 3)));
    const isGainPass = gainDiff <= tolerance.gain;

    // --- DETUNE MATCH ---
    const detuneDiff = Math.abs(user.detune - target.detune);
    const isDetunePass = detuneDiff <= (tolerance.detune || 50);

    // --- FILTER MATCH ---
    let filterScore = 1;
    let isFilterPass = true;

    // If filter is active (not open)
    if (target.filterFreq < 19000) {
        const f1 = Math.log10(Math.max(1, user.filterFreq));
        const f2 = Math.log10(Math.max(1, target.filterFreq));
        const diff = Math.abs(f1 - f2);
        // Tolerance roughly 10% in log scale
        const tol = 0.15; 
        filterScore = Math.max(0, 1 - (diff / (tol * 3)));
        isFilterPass = diff <= tol;
    }

    // Total Score
    // If Custom, filter is very important. If Standard, it's irrelevant (score 1)
    const totalScore = (freqScore * 0.4) + (gainScore * 0.2) + (filterScore * 0.4);

    return {
      isMatch: isFreqPass && isGainPass && isDetunePass && isFilterPass,
      scorePercent: Math.round(totalScore * 100),
      details: {
        freqMatch: freqScore,
        gainMatch: gainScore,
        typeMatch: true,
        filterMatch: filterScore,
        playbackRate: user.waveType === 'custom' ? (user.frequency/440) : undefined
      }
    };
  }
}

export const audioEngine = new AudioEngine();