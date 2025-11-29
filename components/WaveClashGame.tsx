import React, { useEffect, useRef, useState, useCallback } from 'react';
import { audioEngine } from '../services/audioEngine';
import { BButton, BCard, BSlider, BToggleGroup } from './BrutalistUI';
import { AudioState, WaveType, LevelConfig, MatchResult, GameState, GameMode } from '../types';
import { Trophy, RefreshCw, ArrowLeft, Ear, Zap, Play, Calendar, Infinity as InfinityIcon, Skull, Timer, BarChart3, Info, Activity, Mic2, Lock, ChevronDown, Check } from 'lucide-react';
import { LeaderboardOverlay, ScoreEntry } from './LeaderboardOverlay';
import { SamplerMenu } from './SamplerMenu';
import { InfoModal } from './InfoModal';

// --- Configs ---

const LEVELS: LevelConfig[] = [
  {
    id: 1,
    difficultyTier: 0,
    name: "TONE DEAF",
    description: "Super Easy. Match the simple sine wave.",
    target: { frequency: 220, detune: 0, waveType: 'sine', gain: 0.8, filterFreq: 20000 },
    tolerance: { frequency: 30, gain: 0.25, detune: 100 },
    locked: false
  },
  {
    id: 2,
    difficultyTier: 1,
    name: "WANNA BE",
    description: "Medium. Introduction to square waves.",
    target: { frequency: 330, detune: 0, waveType: 'square', gain: 0.5, filterFreq: 20000 },
    tolerance: { frequency: 15, gain: 0.15, detune: 50 },
    locked: false
  },
  {
    id: 3,
    difficultyTier: 2,
    name: "PRO DJ",
    description: "Hard. Precision required. Watch the detune.",
    target: { frequency: 110, detune: 25, waveType: 'sawtooth', gain: 0.6, filterFreq: 20000 },
    tolerance: { frequency: 8, gain: 0.1, detune: 15 },
    locked: false
  },
   {
    id: 4,
    difficultyTier: 3,
    name: "GURU",
    description: "Super Hard. Perfect pitch or bust.",
    target: { frequency: 440, detune: -15, waveType: 'triangle', gain: 0.4, filterFreq: 20000 },
    tolerance: { frequency: 3, gain: 0.05, detune: 5 },
    locked: false
  },
];

const WaveClashGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const controlsRef = useRef<HTMLDivElement>(null);
  
  // Game State
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [gameMode, setGameMode] = useState<GameMode>('CAMPAIGN');
  const [currentLevelId, setCurrentLevelId] = useState(1);
  
  // Dynamic Level State (for Daily/Random)
  const [activeLevelConfig, setActiveLevelConfig] = useState<LevelConfig>(LEVELS[0]);
  const [originalTargetType, setOriginalTargetType] = useState<WaveType>('sine');

  // Score & Progression
  const [totalScore, setTotalScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [lastPointsEarned, setLastPointsEarned] = useState(0);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  
  const [isListeningTarget, setIsListeningTarget] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showFlash, setShowFlash] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);

  const [userAudio, setUserAudio] = useState<AudioState>({
    frequency: 440, detune: 0, waveType: 'sine', gain: 0.5, filterFreq: 20000
  });
  
  const prevWaveType = useRef<WaveType>('sine');
  
  const [hasCustomWave, setHasCustomWave] = useState(false);

  // Initialize & Subscribe
  useEffect(() => {
     const updateCustomStatus = () => setHasCustomWave(audioEngine.hasBuffer('wave_custom'));
     
     updateCustomStatus();
     const unsubscribe = audioEngine.subscribe((id) => {
         if (id === 'wave_custom') {
             updateCustomStatus();
             // If playing and using custom, refresh
             if (userAudio.waveType === 'custom' && gameState === 'PLAYING') {
                 audioEngine.restartUserChain(userAudio);
             }
         }
     });
     
     return () => unsubscribe();
  }, [userAudio.waveType, gameState]);

  // --- Audio Sync ---
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    // Special handling for SAMPLER CLASH mode
    // We strictly enforce CUSTOM type for both user and target
    if (gameMode === 'SAMPLER_CLASH') {
        if (userAudio.waveType !== 'custom') {
             // Correction if somehow state drifts
             const fixedUser = {...userAudio, waveType: 'custom' as WaveType};
             setUserAudio(fixedUser);
             audioEngine.restartUserChain(fixedUser);
             prevWaveType.current = 'custom';
        }
    }

    if (!isListeningTarget) {
         const wasCustom = prevWaveType.current === 'custom';
         const isCustom = userAudio.waveType === 'custom';
         
         if (wasCustom !== isCustom) {
             audioEngine.restartUserChain(userAudio);
         } else {
             audioEngine.updateUser(userAudio);
         }
         prevWaveType.current = userAudio.waveType;
    }
  }, [userAudio, gameState, isListeningTarget, gameMode]);

  // --- Timer Logic ---
  useEffect(() => {
    if (gameState !== 'PLAYING') return;
    
    const timer = setInterval(() => {
        setTimeLeft((prev) => {
            if (prev <= 1) {
                clearInterval(timer);
                handleTimeOut();
                return 0;
            }
            return prev - 1;
        });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  const handleTimeOut = () => {
      audioEngine.stop();
      audioEngine.playSample('ui_lose');
      setMatchResult(null);
      setGameState('LOST');
      saveHighScore();
  };

  // --- Tutorial ---
  useEffect(() => {
    if (gameState === 'PLAYING' && gameMode === 'CAMPAIGN' && currentLevelId === 1) {
      const hasSeenTutorial = localStorage.getItem('waveclash_tutorial_done_v4');
      if (!hasSeenTutorial) {
        setShowInfo(true);
        localStorage.setItem('waveclash_tutorial_done_v4', 'true');
      }
    }
  }, [gameState, gameMode, currentLevelId]);

  // --- Scroll Hint Logic ---
  useEffect(() => {
    const checkScroll = () => {
        if (controlsRef.current) {
            const { scrollHeight, clientHeight, scrollTop } = controlsRef.current;
            // Show hint if content is scrollable and we are near the top
            setShowScrollHint(scrollHeight > clientHeight && scrollTop < 20);
        }
    };
    
    // Check initially and on resize
    checkScroll();
    window.addEventListener('resize', checkScroll);
    
    const el = controlsRef.current;
    if (el) el.addEventListener('scroll', checkScroll);
    
    return () => {
        window.removeEventListener('resize', checkScroll);
        if (el) el.removeEventListener('scroll', checkScroll);
    };
  }, [gameState]);

  // --- Generators ---
  const generateDailyLevel = (): LevelConfig => {
    const today = new Date();
    const seedStr = `${today.getFullYear()}${today.getMonth()}${today.getDate()}`;
    let seed = parseInt(seedStr);
    
    const seededRandom = (s: number) => {
        const x = Math.sin(s++) * 10000;
        return x - Math.floor(x);
    };
    const rand = () => { seed++; return seededRandom(seed); };
    
    const types: WaveType[] = ['sine', 'square', 'sawtooth', 'triangle'];
    const type = types[Math.floor(rand() * types.length)];
    const freq = 100 + Math.floor(rand() * 600);
    const gain = 0.3 + (rand() * 0.6);
    
    return {
        id: 999,
        difficultyTier: 3,
        name: "DAILY GLITCH",
        description: "One day. One chance. Maximum points.",
        target: { frequency: freq, detune: 0, waveType: type, gain: gain, filterFreq: 20000 },
        tolerance: { frequency: 10, gain: 0.1, detune: 20 },
        locked: false
    };
  };

  const generateRandomLevel = (currentTier: number = 0): LevelConfig => {
    const types: WaveType[] = ['sine', 'square', 'sawtooth', 'triangle'];
    // Removed 'custom' from random/infinite mode to separate it
    
    const type = types[Math.floor(Math.random() * types.length)];
    const freq = 80 + Math.floor(Math.random() * 800);
    const gain = 0.2 + (Math.random() * 0.7);
    const tier = Math.min(3, Math.floor(currentTier / 3)) as 0|1|2|3; 
    
    return {
        id: 888,
        difficultyTier: tier,
        name: "INFINITE SURF",
        description: "Randomized signal. Speed is key.",
        target: { frequency: freq, detune: 0, waveType: type, gain: gain, filterFreq: 20000 },
        tolerance: { frequency: 20 - (tier*4), gain: 0.2 - (tier*0.03), detune: 40, filterFreq: 1000 },
        locked: false
    };
  };

  const generateNervesLevel = (): LevelConfig => {
    const types: WaveType[] = ['square', 'sawtooth', 'triangle'];
    const type = types[Math.floor(Math.random() * types.length)];
    const freq = 150 + Math.floor(Math.random() * 600);
    
    return {
        id: 777,
        difficultyTier: 2,
        name: "WAVES OF NERVES",
        description: "Speed vs Precision. Time decays fast.",
        target: { 
            frequency: freq, 
            detune: (Math.random()*40)-20, 
            waveType: type, 
            gain: 0.3 + Math.random()*0.6,
            filterFreq: 20000
        },
        tolerance: { frequency: 15, gain: 0.15, detune: 25 },
        locked: false
    };
  };

  const generateSamplerLevel = (): LevelConfig => {
    // For sampler mode, we warp the user's custom sample
    // Base 440Hz = 1.0 rate
    const randomRate = 0.5 + Math.random() * 1.0; // 0.5x to 1.5x speed
    const targetFreq = 440 * randomRate; 
    
    const randomFilter = 400 + Math.random() * 10000; // Random lowpass

    return {
        id: 666,
        difficultyTier: 2,
        name: "SAMPLER CLASH",
        description: "Match the warped playback of your recording.",
        target: { 
            frequency: targetFreq, 
            detune: 0, 
            waveType: 'custom', 
            gain: 0.3 + Math.random() * 0.5,
            filterFreq: randomFilter
        },
        tolerance: { 
            frequency: 440 * 0.1, // ~10% speed tolerance
            gain: 0.15, 
            detune: 50,
            filterFreq: 100 
        },
        locked: false
    }
  }

  // --- Visualizer ---
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = audioEngine.getAnalysisData();
    if (!data) return;

    const w = canvas.width;
    const h = canvas.height;
    
    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);
    
    // Grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let i=0; i<w; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,h); }
    for(let i=0; i<h; i+=40) { ctx.moveTo(0,i); ctx.lineTo(w,i); }
    ctx.stroke();

    // Center Line
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(0, h/2);
    ctx.lineTo(w, h/2);
    ctx.stroke();

    const findTrigger = (arr: Uint8Array) => {
        const thresh = 128;
        // Simple rising edge trigger
        for(let i=0; i<arr.length/2; i++) {
            if(arr[i] <= thresh && arr[i+1] > thresh) return i;
        }
        return 0;
    };

    const calculateAmplitude = (arr: Uint8Array) => {
        let sum = 0;
        for(let i=0; i<arr.length; i++) {
            sum += Math.abs(arr[i] - 128);
        }
        return sum / arr.length;
    };

    // Calculate scaling factor for Custom Waves
    const userAmp = calculateAmplitude(data.userTime);
    const autoGain = userAmp < 20 && userAmp > 1 ? Math.min(5, 20 / userAmp) : 1;

    const drawWave = (arr: Uint8Array, color: string, thick: number, dashed: boolean, useAutoGain: boolean = false) => {
      const trigger = findTrigger(arr);
      ctx.beginPath();
      ctx.lineWidth = thick;
      ctx.strokeStyle = color;
      if (dashed) ctx.setLineDash([8, 8]);
      else ctx.setLineDash([]);

      const drawWindow = 600; 
      const sliceWidth = w / drawWindow;
      let x = 0;
      
      const scale = useAutoGain ? autoGain : 1;

      for (let i = 0; i < drawWindow; i++) {
        const idx = trigger + i;
        if (idx >= arr.length) break;
        
        // Normalize 0-255 to -1.0 to 1.0, then scale
        const sample = (arr[idx] - 128) / 128.0; 
        const v = sample * scale;
        
        // Map back to screen coords. Center is h/2
        const y = (h / 2) - (v * (h / 2)); 
        
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const isCustomMode = gameMode === 'SAMPLER_CLASH';
    
    drawWave(data.targetTime, '#ef4444', 4, true, isCustomMode);
    ctx.globalCompositeOperation = 'screen';
    drawWave(data.userTime, '#3b82f6', 4, false, isCustomMode);
    ctx.globalCompositeOperation = 'source-over';

    if (autoGain > 1.2 && isCustomMode) {
        ctx.fillStyle = '#3b82f6';
        ctx.font = 'bold 10px monospace';
        ctx.fillText(`AUTO-GAIN: ${autoGain.toFixed(1)}x`, 10, h - 10);
    }

    // Scanline overlay
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    for(let i=0; i<h; i+=4) ctx.fillRect(0, i, w, 1);

    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(draw);
    }
  }, [gameState, gameMode]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(draw);
    }
    return () => {
       if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, draw]);

  // --- Game Logic ---

  const resetGameStats = () => {
      setStreak(0);
      setTotalScore(0);
      setTimeLeft(60);
  };

  const launchLevel = async (level: LevelConfig, mode: GameMode, keepStats: boolean = false) => {
    try {
        if (mode === 'SAMPLER_CLASH' && !hasCustomWave) {
             alert("Record a sample in the Sampler Menu first!");
             setGameState('SAMPLER');
             return;
        }

        audioEngine.playSample('ui_click');
        await audioEngine.resume();
        
        if (!keepStats) resetGameStats();
        
        if (mode === 'NERVES' && !keepStats) {
            setTimeLeft(30); 
        }
        
        setActiveLevelConfig(level);
        setOriginalTargetType(level.target.waveType); 
        setGameMode(mode);
        
        const startType = level.target.waveType; // Force start type to match level for Sampler Clash

        // In Sampler Clash, start randomized but not too far
        const startFreq = mode === 'SAMPLER_CLASH' ? 440 : Math.max(50, level.target.frequency + (Math.random() * 300 - 150));
        const startFilter = mode === 'SAMPLER_CLASH' ? 20000 : 20000;

        const startUser: AudioState = {
            frequency: startFreq,
            detune: 0,
            waveType: startType, 
            gain: 0.5,
            filterFreq: startFilter
        };

        setUserAudio(startUser);
        prevWaveType.current = startType;
        
        audioEngine.start(startUser, level.target);
        setGameState('PLAYING');
        setMatchResult(null);
    } catch (e) {
        console.error("Failed to start audio:", e);
    }
  };

  const stopGame = () => {
    audioEngine.stop();
    saveHighScore();
    setGameState('MENU');
    setMatchResult(null);
    setShowInfo(false);
  };

  const saveHighScore = () => {
      const key = `waveclash_high_${gameMode.toLowerCase()}`;
      const currentHigh = parseInt(localStorage.getItem(key) || '0');
      if (totalScore > currentHigh) {
          localStorage.setItem(key, totalScore.toString());
      }
  };

  const handleSubmit = () => {
    const result = audioEngine.evaluateMatch(userAudio, activeLevelConfig.target, activeLevelConfig.tolerance);
    
    if (result.isMatch) {
        let points = 0;
        
        if (gameMode === 'NERVES') {
            const timeBonus = timeLeft * 100;
            const accuracyMult = result.scorePercent / 100;
            points = Math.floor(timeBonus * accuracyMult);
        } else {
            const base = Math.pow(2, activeLevelConfig.difficultyTier) * 500; 
            const bonus = Math.pow(1.5, Math.min(10, streak)); 
            const timeBonus = timeLeft * 10;
            points = Math.floor((base * bonus) + timeBonus);
        }

        const newStreak = streak + 1;
        setStreak(newStreak);
        setLastPointsEarned(points);
        setTotalScore(prev => prev + points);

        if (gameMode === 'RANDOM' || gameMode === 'SAMPLER_CLASH') {
            handleInfiniteSuccess(newStreak, 10); 
        } else if (gameMode === 'NERVES') {
            handleInfiniteSuccess(newStreak, 15); 
        } else {
            setMatchResult(result);
            audioEngine.stop();
            audioEngine.playSample('ui_win');
            saveHighScore();
            setGameState('WON');
            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
        }

    } else {
      audioEngine.stop();
      audioEngine.playSample('ui_lose');
      setMatchResult(result);
      setGameState('LOST');
      saveHighScore();
      if (navigator.vibrate) navigator.vibrate([300]);
    }
  };

  const handleInfiniteSuccess = async (newStreak: number, timeAdd: number) => {
       setShowFlash(true);
       setTimeout(() => setShowFlash(false), 500);
       
       audioEngine.playSample('ui_win');
       setTimeLeft(prev => Math.min(99, prev + timeAdd));

       if (navigator.vibrate) navigator.vibrate(50);
       
       let nextLevel: LevelConfig;
       if (gameMode === 'NERVES') nextLevel = generateNervesLevel();
       else if (gameMode === 'SAMPLER_CLASH') nextLevel = generateSamplerLevel();
       else nextLevel = generateRandomLevel(newStreak);
            
       setActiveLevelConfig(nextLevel);
       setOriginalTargetType(nextLevel.target.waveType);
       
       const newUserAudio = { ...userAudio, filterFreq: 20000 };
       
       // Force type match
       newUserAudio.waveType = nextLevel.target.waveType as WaveType;

       setUserAudio(newUserAudio);
       audioEngine.start(newUserAudio, nextLevel.target);
  };

  const handleNext = () => {
      if (gameMode === 'CAMPAIGN') {
          const nextId = currentLevelId < LEVELS.length ? currentLevelId + 1 : currentLevelId;
          setCurrentLevelId(nextId);
          launchLevel(LEVELS.find(l => l.id === nextId) || LEVELS[0], 'CAMPAIGN', true);
      } else {
          launchLevel(generateDailyLevel(), 'DAILY', false);
      }
  };

  const handleToggleListen = (enable: boolean) => {
      setIsListeningTarget(enable);
      audioEngine.toggleTargetAudio(enable, userAudio.gain);
  };

  const getFilterSliderValue = () => {
      // Convert Logarithmic Frequency (100-20000) to Linear (0-100)
      const min = 100;
      const max = 20000;
      const val = Math.log(userAudio.filterFreq / min) / Math.log(max / min);
      return Math.min(100, Math.max(0, val * 100));
  };

  const setFilterFromSlider = (val: number) => {
      const min = 100;
      const max = 20000;
      const freq = min * Math.pow(max / min, val / 100);
      setUserAudio({...userAudio, filterFreq: freq});
  };

  // --- Renderers ---

  const renderMenu = () => {
    return (
    <div className="max-w-md mx-auto pb-8 animate-in fade-in duration-500 relative">
      <LeaderboardOverlay isOpen={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
      
      <header className="text-center mb-6 p-6 bg-black text-white border-b-8 border-blue-600 shadow-lg relative">
        <h1 className="text-6xl font-black tracking-tighter italic">WAVE<br/>MATCH</h1>
        <p className="text-xl mt-2 font-mono tracking-widest text-blue-400">SYNTHESIS PROTOCOL</p>
        <button onClick={() => setShowInfo(true)} className="absolute top-4 right-4 p-2 bg-white text-black rounded-full hover:bg-yellow-400 transition-colors">
            <Info size={20} />
        </button>
      </header>
      
      <div className="space-y-4 px-4">
        {/* Special Modes */}
        <div className="grid grid-cols-2 gap-4">
            <button 
                onClick={() => launchLevel(generateDailyLevel(), 'DAILY')}
                className="bg-yellow-400 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            >
                <div className="flex justify-between items-start mb-2">
                    <Calendar size={24} />
                    <span className="bg-black text-yellow-400 text-xs font-bold px-1">NEW</span>
                </div>
                <div className="font-black text-xl leading-none mb-1">DAILY<br/>GLITCH</div>
            </button>

            <button 
                onClick={() => launchLevel(generateRandomLevel(0), 'RANDOM')}
                className="bg-purple-400 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            >
                 <div className="flex justify-between items-start mb-2">
                    <InfinityIcon size={24} />
                </div>
                <div className="font-black text-xl leading-none mb-1">INFINITE<br/>SURF</div>
            </button>

            <button 
                onClick={() => launchLevel(generateNervesLevel(), 'NERVES')}
                className="bg-red-500 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-white"
            >
                 <div className="flex justify-between items-start mb-2">
                    <Activity size={24} />
                </div>
                <div className="font-black text-xl leading-none mb-1">WAVES OF NERVES</div>
                <div className="text-xs font-mono font-bold text-white/80">SPEED VS PRECISION</div>
            </button>

             <button 
                onClick={() => launchLevel(generateSamplerLevel(), 'SAMPLER_CLASH')}
                className="bg-green-500 border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            >
                 <div className="flex justify-between items-start mb-2">
                    <Mic2 size={24} />
                    {!hasCustomWave && <span className="bg-red-600 text-white text-[10px] font-bold px-1 animate-pulse">REC REQ</span>}
                </div>
                <div className="font-black text-xl leading-none mb-1">SAMPLER<br/>CLASH</div>
                <div className="text-xs font-mono font-bold">MATCH YOUR RECORDING</div>
            </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <button 
                onClick={() => setShowLeaderboard(true)}
                className="p-3 border-4 border-black bg-gray-100 flex items-center justify-center gap-2 font-bold hover:bg-gray-200 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
                <BarChart3 size={20} /> RANKING
            </button>

            <button 
                onClick={() => setGameState('SAMPLER')}
                className="p-3 border-4 border-black bg-white flex items-center justify-center gap-2 font-bold hover:bg-gray-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
            >
                <Mic2 size={20} /> RECORDER
            </button>
        </div>

        <div className="border-b-4 border-black my-4"></div>
        <h3 className="font-black text-lg px-2">CAMPAIGN</h3>

        {LEVELS.map((level) => (
          <button
            key={level.id}
            onClick={() => { setCurrentLevelId(level.id); launchLevel(level, 'CAMPAIGN'); }}
            className="w-full text-left p-5 border-4 border-black bg-white hover:bg-blue-50 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none relative overflow-hidden group"
          >
            <div className="relative z-10">
                <div className="flex justify-between items-center mb-1">
                    <span className="font-black text-xl uppercase tracking-tight">{level.name}</span>
                    <span className={`text-xs font-bold px-2 py-1 border-2 border-black ${['bg-green-300','bg-yellow-300','bg-orange-300','bg-red-300'][level.difficultyTier]}`}>
                        LVL {level.difficultyTier + 1}
                    </span>
                </div>
                <p className="font-mono text-xs text-gray-600 font-bold">{level.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )};

  const renderPlaying = () => (
    // Fixed height container to prevent body scroll, use 100dvh for mobile browsers
    <div className="h-[100dvh] flex flex-col max-w-2xl mx-auto relative bg-gray-100 overflow-hidden">
      <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />

      <div className={`absolute inset-0 bg-green-500 z-50 pointer-events-none mix-blend-multiply transition-opacity duration-300 ${showFlash ? 'opacity-40' : 'opacity-0'}`} />
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 z-50 text-6xl font-black text-green-500 pointer-events-none transition-all duration-300 ${showFlash ? 'opacity-100 scale-110' : 'opacity-0 scale-50'}`}>
         MATCH!
      </div>

      {/* Navbar (Fixed Top) */}
      <div className="flex justify-between items-center p-3 bg-white border-b-4 border-black shadow-sm shrink-0 z-20">
        <div className="flex items-center gap-2">
            <button onClick={stopGame} className="p-2 hover:bg-gray-200 transition-colors rounded border-2 border-transparent hover:border-black">
                <ArrowLeft size={24} />
            </button>
        </div>
        
        <div className="flex flex-col items-center text-center absolute left-1/2 -translate-x-1/2">
             <div className="font-black text-lg uppercase tracking-tighter leading-none">
                 {gameMode === 'SAMPLER_CLASH' ? 'SAMPLER CLASH' : gameMode === 'RANDOM' ? 'INFINITE' : gameMode === 'NERVES' ? 'WAVES OF NERVES' : activeLevelConfig.name}
             </div>
             <div className="text-[10px] font-mono font-bold flex items-center gap-2 bg-black text-white px-2 py-0.5 mt-1 rounded-full">
                <Zap size={10} className="fill-yellow-400 text-yellow-400"/> {streak}x STREAK
             </div>
        </div>
        
        <div className="flex items-center gap-2">
             <button 
                onClick={() => setShowInfo(true)}
                className="p-2 hover:bg-gray-200 transition-colors rounded border-2 border-transparent hover:border-black"
                title="Show Info"
            >
                <Info size={24} />
            </button>
            <div className={`flex items-center gap-2 font-bold font-mono border-2 border-black px-2 py-1 rounded ${timeLeft < 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-white'}`}>
                 <Timer size={16} /> {timeLeft}s
            </div>
        </div>
      </div>

      {/* Visualizer (Fixed) */}
      <div id="canvas-area" className="relative w-full aspect-[2/1] bg-black border-b-4 border-black shrink-0 group z-10">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={400}
          className="w-full h-full object-cover"
        />
        
        <div className="absolute top-4 right-4 z-10" id="btn-listen">
            <button 
                onMouseDown={() => handleToggleListen(true)}
                onMouseUp={() => handleToggleListen(false)}
                onMouseLeave={() => handleToggleListen(false)}
                onTouchStart={() => handleToggleListen(true)}
                onTouchEnd={() => handleToggleListen(false)}
                className={`
                    flex items-center gap-2 px-4 py-3 border-4 font-bold transition-all select-none shadow-lg
                    ${isListeningTarget 
                        ? 'bg-red-500 border-white text-white scale-95 ring-4 ring-red-300' 
                        : 'bg-white border-black text-black hover:bg-gray-100'}
                `}
            >
                <Ear size={20} /> 
                <span className="text-sm">{isListeningTarget ? 'LISTENING...' : 'HOLD TO COMPARE'}</span>
            </button>
        </div>
        
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
             <div className="text-white font-black text-2xl drop-shadow-md">{totalScore} PTS</div>
        </div>
      </div>

      {/* Controls (Scrollable) */}
      <div 
        className="flex-grow overflow-y-auto p-4 bg-gray-50 relative pb-32" 
        id="controls-panel" 
        ref={controlsRef}
      >
        <BCard className="shadow-sm">
           {/* Wave Shape Selector - HIDDEN IN SAMPLER CLASH */}
           {gameMode !== 'SAMPLER_CLASH' && (
               <div className="mb-6" id="control-wave">
                   <div className="mb-2 font-bold font-mono text-sm uppercase">Wave Shape</div>
                   <div className="flex flex-wrap gap-2">
                       {['sine','square','sawtooth','triangle'].map((t) => (
                          <button key={t} onClick={() => setUserAudio({...userAudio, waveType: t as WaveType})}
                             className={`flex-1 py-2 border-4 border-black font-bold text-sm uppercase ${userAudio.waveType === t ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}>
                             {t.substring(0,3)}
                          </button>
                       ))}
                   </div>
               </div>
           )}

           {gameMode === 'SAMPLER_CLASH' && (
               <div className="bg-black text-white font-mono p-2 text-center text-sm font-bold mb-4 border-4 border-blue-500">
                   MODE: SAMPLER // MATCH SPEED & FILTER
               </div>
           )}
           
           <BSlider 
              id="control-freq"
              label={gameMode === 'SAMPLER_CLASH' ? "Playback Speed" : "Frequency"}
              min={gameMode === 'SAMPLER_CLASH' ? 220 : 50} 
              max={gameMode === 'SAMPLER_CLASH' ? 880 : 800} 
              step={1}
              value={Math.round(userAudio.frequency)}
              onChange={(v) => setUserAudio({...userAudio, frequency: v})}
              unit={gameMode === 'SAMPLER_CLASH' ? "x" : "Hz"} 
           />
           
           {/* Conditional Effect Slider (Always show in Sampler Clash) */}
           {userAudio.waveType === 'custom' && (
               <div className="animate-in slide-in-from-right duration-300">
                    <BSlider 
                        id="control-filter"
                        label="FILTER CUTOFF"
                        min={0} max={100} step={1}
                        value={getFilterSliderValue()}
                        onChange={setFilterFromSlider}
                        unit="%"
                    />
                    <div className="text-xs font-bold text-blue-600 mb-4 -mt-4 text-right">MATCH THE BRIGHTNESS</div>
               </div>
           )}

           <div className="flex gap-4">
                <BSlider 
                    id="control-detune"
                    label="Fine Tune"
                    min={-100} max={100} step={1}
                    value={Math.round(userAudio.detune)}
                    onChange={(v) => setUserAudio({...userAudio, detune: v})}
                    unit="c"
                />

                <BSlider 
                    id="control-gain"
                    label="Gain"
                    min={0} max={1} step={0.01}
                    value={Number(userAudio.gain.toFixed(2))}
                    onChange={(v) => setUserAudio({...userAudio, gain: v})}
                />
           </div>
        </BCard>
      </div>
      
      {/* Scroll Hint */}
      {showScrollHint && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-black/50 animate-bounce pointer-events-none z-50">
            <ChevronDown size={32} />
        </div>
      )}

      {/* Floating Action Button (Fixed Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-[60]">
        <button 
            onClick={handleSubmit}
            className="w-16 h-16 bg-green-500 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all hover:bg-green-400 group"
            aria-label={gameMode === 'NERVES' ? 'Lock Signal' : 'Commit Signal'}
        >
            <Check size={32} className="stroke-[4] text-black group-hover:scale-110 transition-transform" />
        </button>
      </div>

    </div>
  );

  const renderResult = (won: boolean) => (
     <div className={`flex flex-col items-center justify-center min-h-screen p-4 ${won ? 'bg-blue-600' : 'bg-red-600'} text-white animate-in zoom-in duration-300`}>
        <BCard className="text-center max-w-md w-full !bg-black !text-white !border-white shadow-[16px_16px_0px_0px_rgba(0,0,0,0.5)]">
            {won ? <Trophy size={64} className="mx-auto mb-4 text-yellow-400" /> : <Skull size={64} className="mx-auto mb-4 text-red-500" />}
            
            <h2 className="text-4xl font-black mb-2 tracking-tighter">{won ? 'SYNCHRONIZED' : 'SIGNAL LOST'}</h2>
            
            <div className="py-6 border-y-4 border-white/20 my-6 bg-white/5">
                {won ? (
                    <>
                        <div className="text-6xl font-black mb-2 text-yellow-400 tracking-tighter">+{lastPointsEarned}</div>
                        <div className="flex justify-center items-center gap-8 mt-4 text-sm font-mono">
                             <div>
                                 <div className="text-gray-400">STREAK</div>
                                 <div className="text-xl font-bold">{streak}x</div>
                             </div>
                             <div>
                                 <div className="text-gray-400">MULTIPLIER</div>
                                 <div className="text-xl font-bold">{Math.pow(2, streak-1)}x</div>
                             </div>
                        </div>
                    </>
                ) : (
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-left font-mono text-sm px-4">
                         <div className="col-span-2 text-center mb-4 text-yellow-400 font-bold text-xl">
                            TOTAL SCORE: {totalScore}
                         </div>
                         
                         {gameMode === 'SAMPLER_CLASH' ? (
                             <>
                                <div className="text-gray-400">SPEED MATCH:</div>
                                <div className={matchResult?.details.freqMatch! > 0.9 ? 'text-green-400' : 'text-red-400'}>
                                    {Math.round((matchResult?.details.freqMatch || 0) * 100)}%
                                </div>
                                <div className="text-gray-400">FILTER MATCH:</div>
                                <div className={matchResult?.details.filterMatch! > 0.8 ? 'text-green-400' : 'text-red-400'}>
                                    {Math.round((matchResult?.details.filterMatch || 0) * 100)}%
                                </div>
                             </>
                         ) : (
                             <>
                                <div className="text-gray-400">FREQ MATCH:</div>
                                <div className={matchResult?.details.freqMatch! > 0.9 ? 'text-green-400' : 'text-red-400'}>
                                    {Math.round((matchResult?.details.freqMatch || 0) * 100)}%
                                </div>
                             </>
                         )}
                         
                         {gameMode !== 'SAMPLER_CLASH' && matchResult?.details.filterMatch !== undefined && matchResult.details.filterMatch < 1 && (
                             <>
                                <div className="text-gray-400">FILTER MATCH:</div>
                                <div className={matchResult?.details.filterMatch > 0.8 ? 'text-green-400' : 'text-red-400'}>
                                    {Math.round(matchResult?.details.filterMatch * 100)}%
                                </div>
                             </>
                         )}

                         {gameMode !== 'SAMPLER_CLASH' && (
                             <>
                                <div className="text-gray-400">WAVEFORM:</div>
                                <div className={matchResult?.details.typeMatch ? 'text-green-400' : 'text-red-400'}>
                                    {matchResult?.details.typeMatch ? 'OK' : 'FAIL'}
                                </div>
                             </>
                         )}
                    </div>
                )}
            </div>
            
            <div className="space-y-3">
                 <BButton onClick={won ? handleNext : () => launchLevel(activeLevelConfig, gameMode)} variant={won ? "success" : "primary"} className="w-full flex items-center justify-center gap-2">
                    {won ? <><Play size={20} className="fill-black" /> NEXT SIGNAL</> : <><RefreshCw size={20} /> RETRY</>}
                 </BButton>
                 
                 <BButton onClick={() => setGameState('MENU')} variant="neutral" className="w-full">
                    ABORT TO MENU
                 </BButton>
            </div>
        </BCard>
     </div>
  );

  return (
    <div className="min-h-screen bg-gray-200 text-black font-mono selection:bg-blue-500 selection:text-white">
      {gameState === 'SAMPLER' && <SamplerMenu onClose={() => setGameState('MENU')} />}
      {gameState === 'MENU' && renderMenu()}
      {gameState === 'PLAYING' && renderPlaying()}
      {(gameState === 'WON' || gameState === 'LOST') && renderResult(gameState === 'WON')}
    </div>
  );
};

export default WaveClashGame;