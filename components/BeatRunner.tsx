
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Track, BeatMap, BeatNote } from '../types';
import { AudioEngine } from '../services/audioEngine';
import { Trophy, Flame, Play, Info, Gamepad2, Activity, Save, Edit3, Trash2, Zap, Clock, Music as MusicIcon, RotateCcw, FastForward, LogOut } from 'lucide-react';

// Helper to calculate the total duration of a beatmap
const getMapDuration = (notes: BeatNote[]) => {
  if (notes.length === 0) return 0;
  const lastNote = notes[notes.length - 1];
  return lastNote.time + (lastNote.duration || 0);
};

// Helper to format seconds into M:SS
const formatShortTime = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

interface BeatRunnerProps {
  track: Track | null;
  audioEngine: AudioEngine | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onUpdateStats: (updates: any) => void;
  onNextTrack: () => void;
}

interface NoteInstance {
  id: number;
  lane: number;
  startTime: number; // The exact audio time this note's head should be hit
  duration: number; 
  hit: boolean;
  isBeingHeld: boolean;
  holdProgress: number; 
  consumed: boolean;
  missed: boolean;
}

interface HitFeedback {
  id: number;
  lane: number;
  text: string;
  opacity: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

type GameMode = 'procedural' | 'record' | 'play_custom';

const BeatRunner: React.FC<BeatRunnerProps> = ({ track, audioEngine, isPlaying, onTogglePlay, onUpdateStats, onNextTrack }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [perfectsInSession, setPerfectsInSession] = useState(0);
  const [notesInSession, setNotesInSession] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('procedural');
  const [showResults, setShowResults] = useState(false);
  
  const [recordingNotes, setRecordingNotes] = useState<BeatNote[]>([]);
  const [savedMaps, setSavedMaps] = useState<BeatMap[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [latencyOffset, setLatencyOffset] = useState(100); 

  const notesRef = useRef<NoteInstance[]>([]);
  // Persist nextNoteIdx for play_custom mode
  const nextNoteIdxRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const feedbacksRef = useRef<HitFeedback[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const laneFlashesRef = useRef<number[]>([0, 0, 0, 0]);
  const audioCurrentTimeRef = useRef(0);
  
  const activeKeysRef = useRef<Record<number, { startTime: number, noteIdx: number }>>({});
  const laneBusyUntilRef = useRef<number[]>([0, 0, 0, 0]);

  // Game Constants
  const lanes = 4;
  const laneWidth = 80;
  const hitZoneY = 500;
  const pixelsPerSecond = 400; // Fixed speed (pixels per audio second)
  
  // Timing windows (in seconds)
  const hitWindow = 0.15;
  
  // Lead time for spawning notes before they reach the hit zone
  const spawnLeadTime = useMemo(() => (hitZoneY + 100) / pixelsPerSecond, [hitZoneY, pixelsPerSecond]);

  const resetTrackToBeginning = useCallback(() => {
    if (audioEngine) {
      const audioElement = (audioEngine as any).source?.mediaElement as HTMLAudioElement;
      if (audioElement) {
        audioElement.currentTime = 0;
      }
    }
  }, [audioEngine]);

  const startGame = useCallback((mode: GameMode, mapId: string | null = null) => {
    resetTrackToBeginning();
    setGameMode(mode);
    setSelectedMapId(mapId);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setPerfectsInSession(0);
    setNotesInSession(0);
    notesRef.current = [];
    feedbacksRef.current = [];
    activeKeysRef.current = {};
    laneBusyUntilRef.current = [0, 0, 0, 0];
    nextNoteIdxRef.current = 0;
    setShowResults(false);
    setGameStarted(true);
    if (!isPlaying) onTogglePlay();
  }, [resetTrackToBeginning, isPlaying, onTogglePlay]);

  const exitGame = useCallback(() => {
    setGameStarted(false);
    setShowResults(false);
    if (isPlaying) onTogglePlay();
    resetTrackToBeginning();
  }, [isPlaying, onTogglePlay, resetTrackToBeginning]);

  const handleNextInRunner = useCallback(() => {
    onNextTrack();
    setGameStarted(false);
    setShowResults(false);
  }, [onNextTrack]);

  useEffect(() => {
    if (track) {
      const allMaps = JSON.parse(localStorage.getItem('rhythme_beatmaps') || '[]');
      const trackMaps = allMaps.filter((m: BeatMap) => m.trackId === track.id);
      setSavedMaps(trackMaps);
    }
  }, [track]);

  const saveCurrentRecording = () => {
    if (!track || recordingNotes.length === 0) return;
    const newMap: BeatMap = {
      id: Math.random().toString(36).substring(2, 9),
      trackId: track.id,
      name: `Session ${savedMaps.length + 1}`,
      notes: [...recordingNotes].sort((a, b) => a.time - b.time),
      createdAt: Date.now()
    };
    const allMaps = JSON.parse(localStorage.getItem('rhythme_beatmaps') || '[]');
    localStorage.setItem('rhythme_beatmaps', JSON.stringify([...allMaps, newMap]));
    setSavedMaps(prev => [...prev, newMap]);
    setRecordingNotes([]);
    setGameStarted(false);
    if (isPlaying) onTogglePlay();
  };

  const deleteMap = (id: string) => {
    const allMaps = JSON.parse(localStorage.getItem('rhythme_beatmaps') || '[]');
    localStorage.setItem('rhythme_beatmaps', JSON.stringify(allMaps.filter((m: BeatMap) => m.id !== id)));
    setSavedMaps(prev => prev.filter(m => m.id !== id));
    if (selectedMapId === id) setSelectedMapId(null);
  };

  const triggerParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 12; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color
      });
    }
  };

  const triggerShake = () => {
    if (!containerRef.current) return;
    containerRef.current.classList.add('animate-shake');
    setTimeout(() => containerRef.current?.classList.remove('animate-shake'), 200);
  };

  const getLaneFromKey = (key: string) => {
    const k = key.toLowerCase();
    // Prioritize A, S, K, L as requested
    if (k === 'a' || k === 'arrowleft') return 0;
    if (k === 's' || k === 'arrowdown') return 1;
    if (k === 'k' || k === 'd' || k === 'arrowup') return 2;
    if (k === 'l' || k === 'f' || k === 'arrowright') return 3;
    return -1;
  };

  useEffect(() => {
    if (score > 0) onUpdateStats({ highScore: score });
  }, [score, onUpdateStats]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!gameStarted || showResults || e.repeat) return;
    const lane = getLaneFromKey(e.key);
    if (lane === -1) return;

    e.preventDefault();

    laneFlashesRef.current[lane] = 1.0;
    const nowTime = audioCurrentTimeRef.current;

    if (gameMode === 'record') {
      // Only record the start time and lane, don't add a note yet
      activeKeysRef.current[lane] = { startTime: nowTime, noteIdx: -1 };
      triggerParticles(lane * laneWidth + laneWidth/2, hitZoneY, '#22d3ee');
    } else {
      // Find valid note
      const hitNoteIndex = notesRef.current.findIndex(n => 
        !n.hit && !n.consumed && !n.missed && n.lane === lane && Math.abs(n.startTime - nowTime) < hitWindow
      );

      if (hitNoteIndex !== -1) {
        const hitNote = notesRef.current[hitNoteIndex];
        const accuracyTime = Math.abs(hitNote.startTime - nowTime);
        const accuracyPixels = accuracyTime * pixelsPerSecond;
        
        if (hitNote.duration > 0.1) {
          hitNote.isBeingHeld = true;
          activeKeysRef.current[lane] = { startTime: nowTime, noteIdx: hitNoteIndex };
          triggerParticles(lane * laneWidth + laneWidth/2, hitZoneY, '#fbbf24');
        } else {
          let rating = "PERFECT";
          let points = 150;
          if (accuracyPixels > 40) { rating = "GOOD"; points = 100; }
          else if (accuracyPixels > 20) { rating = "GREAT"; points = 125; }
          else triggerShake();

          if (rating === "PERFECT") {
            onUpdateStats({ totalPerfect: 1 });
            setPerfectsInSession(p => p + 1);
          }

          setScore(s => s + points + (combo * 15));
          setCombo(c => {
            const next = c + 1;
            setMaxCombo(m => Math.max(m, next));
            return next;
          });
          hitNote.hit = true;
          hitNote.consumed = true;
          feedbacksRef.current.push({ id: Date.now(), lane, text: rating, opacity: 1.0 });
          triggerParticles(lane * laneWidth + laneWidth/2, hitZoneY, rating === 'PERFECT' ? '#fbbf24' : '#a855f7');
        }
      }
    }
  }, [gameStarted, gameMode, recordingNotes, combo, onUpdateStats, showResults, pixelsPerSecond]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!gameStarted || showResults) return;
    const lane = getLaneFromKey(e.key);
    if (lane === -1) return;

    e.preventDefault();

    if (!activeKeysRef.current[lane]) return;

    const activeData = activeKeysRef.current[lane];
    const nowTime = audioCurrentTimeRef.current;

    if (gameMode === 'record') {
      // Always register as a press note (duration 0)
      setRecordingNotes(prev => {
        const epsilon = 0.03;
        let filtered = prev.filter(n => !(n.lane === lane && Math.abs(n.time - activeData.startTime) < epsilon));
        filtered.push({ lane, time: activeData.startTime, duration: 0 });
        return filtered;
      });
    } else {
      const note = notesRef.current[activeData.noteIdx];
      if (note && note.isBeingHeld) {
        note.isBeingHeld = false;
        // Check if held long enough
        if (note.holdProgress < 0.9) {
          setCombo(0);
          feedbacksRef.current.push({ id: Date.now(), lane, text: 'DROPPED', opacity: 1.0 });
          note.missed = true;
        } else {
          setScore(s => s + 400);
          onUpdateStats({ totalPerfect: 1 });
          setPerfectsInSession(p => p + 1);
          feedbacksRef.current.push({ id: Date.now(), lane, text: 'PERFECT', opacity: 1.0 });
          note.consumed = true;
          note.hit = true;
        }
      }
    }
    delete activeKeysRef.current[lane];
  }, [gameStarted, gameMode, onUpdateStats, showResults]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  useEffect(() => {
    if (!canvasRef.current || !audioEngine || !isPlaying || !gameStarted || showResults) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    const activeMap = gameMode === 'play_custom' ? savedMaps.find(m => m.id === selectedMapId) : null;

    const gameLoop = () => {
      const now = performance.now();
      const audioElement = (audioEngine as any).source?.mediaElement as HTMLAudioElement;
      if (!audioElement) return;

      if (audioElement.ended) {
        setShowResults(true);
        if (isPlaying) onTogglePlay();
        return;
      }

      audioCurrentTimeRef.current = audioElement.currentTime;
      const currentTime = audioCurrentTimeRef.current;

      // --- Spawn ---
      if (gameMode === 'procedural') {
        const energy = audioEngine.getEnergy(40, 160); 
        const spawnThreshold = 185;
        if (energy > spawnThreshold && now - lastSpawnTimeRef.current > (350 - (energy / 5) - (latencyOffset / 2))) {
          const availableLanes = [];
          for (let i = 0; i < lanes; i++) {
             if (currentTime + spawnLeadTime > laneBusyUntilRef.current[i]) availableLanes.push(i);
          }
          if (availableLanes.length > 0) {
            const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
            const duration = Math.random() > 0.82 ? 0.7 + Math.random() * 1.5 : 0;
            notesRef.current.push({ 
              id: now, lane, startTime: currentTime + spawnLeadTime, duration, 
              hit: false, isBeingHeld: false, holdProgress: 0, consumed: false, missed: false 
            });
            onUpdateStats({ totalNotes: 1 });
            setNotesInSession(n => n + 1);
            laneBusyUntilRef.current[lane] = currentTime + spawnLeadTime + duration + 0.15;
            lastSpawnTimeRef.current = now;
          }
        }
      } else if (gameMode === 'play_custom' && activeMap) {
        while (nextNoteIdxRef.current < activeMap.notes.length) {
          const note = activeMap.notes[nextNoteIdxRef.current];
          if (note.time <= currentTime + spawnLeadTime) {
            notesRef.current.push({ 
              id: Math.random(), lane: note.lane, startTime: note.time, duration: note.duration || 0, 
              hit: false, isBeingHeld: false, holdProgress: 0, consumed: false, missed: false 
            });
            onUpdateStats({ totalNotes: 1 });
            setNotesInSession(n => n + 1);
            nextNoteIdxRef.current++;
          } else break;
        }
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Visual BG ---
      const freqData = audioEngine.getFrequencyData();
      ctx.globalAlpha = 0.08;
      const barCount = 32;
      const bW = canvas.width / barCount;
      for (let i = 0; i < barCount; i++) {
        const val = freqData[Math.floor(i * 5)] / 255;
        const bH = val * canvas.height * 0.4;
        ctx.fillStyle = i % 2 === 0 ? '#3b82f6' : '#a855f7';
        ctx.fillRect(i * bW, canvas.height - bH, bW - 2, bH);
        ctx.fillRect(i * bW, 0, bW - 2, bH);
      }
      ctx.globalAlpha = 1.0;

      for (let i = 0; i < lanes; i++) {
        const flash = laneFlashesRef.current[i];
        if (flash > 0) {
          const g = ctx.createLinearGradient(0, hitZoneY, 0, 0);
          g.addColorStop(0, `rgba(168, 85, 247, ${flash * 0.3})`);
          g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.fillRect(i * laneWidth, 0, laneWidth, canvas.height);
          laneFlashesRef.current[i] -= 0.07;
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.strokeRect(i * laneWidth, 0, laneWidth, canvas.height);
      }

      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.fillRect(0, hitZoneY - 35, canvas.width, 70);
      ctx.strokeStyle = isPlaying ? 'rgba(96, 165, 250, 0.3)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, hitZoneY - 35, canvas.width, 70);

      // --- Particles ---
      particlesRef.current.forEach((p, idx) => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI*2); ctx.fill();
        p.x += p.vx; p.y += p.vy; p.life -= 0.03;
        if (p.life <= 0) particlesRef.current.splice(idx, 1);
      });
      ctx.globalAlpha = 1.0;

      // --- Notes ---
      const notes = notesRef.current;
      for (let i = notes.length - 1; i >= 0; i--) {
        const note = notes[i];
        
        // Rhythmic coordinates
        const audioHeadY = hitZoneY - (note.startTime - currentTime) * pixelsPerSecond;
        const audioTailY = hitZoneY - (note.startTime + note.duration - currentTime) * pixelsPerSecond;

        // Miss check
        if (!note.hit && !note.missed && !note.consumed) {
          if (currentTime > note.startTime + hitWindow) {
            note.missed = true;
            setCombo(0);
            feedbacksRef.current.push({ id: Date.now(), lane: note.lane, text: 'MISS', opacity: 1.0 });
          }
        }

        // Hold process
        if (note.isBeingHeld) {
          const totalDur = note.duration || 1;
          const progress = (currentTime - note.startTime) / totalDur;
          note.holdProgress = Math.max(0, Math.min(1.0, progress));
          
          setScore(s => s + Math.floor(8 * (1 + combo * 0.1)));
          if (now % 4 < 1) triggerParticles(note.lane * laneWidth + laneWidth/2, hitZoneY, '#fbbf24');
          
          if (note.holdProgress >= 1.0) {
            note.consumed = true;
            note.hit = true;
            note.isBeingHeld = false;
            delete activeKeysRef.current[note.lane];
            setScore(s => s + 500);
            setCombo(c => {
              const next = c + 1;
              setMaxCombo(m => Math.max(m, next));
              return next;
            });
            onUpdateStats({ totalPerfect: 1 });
            setPerfectsInSession(p => p + 1);
            feedbacksRef.current.push({ id: Date.now(), lane: note.lane, text: 'PERFECT', opacity: 1.0 });
            triggerParticles(note.lane * laneWidth + laneWidth/2, hitZoneY, '#fbbf24');
          }
        }

        // Cleanup
        if (audioTailY > canvas.height + 150) {
          notes.splice(i, 1);
          continue;
        }

        const x = note.lane * laneWidth + 12;
        const w = laneWidth - 24;
        
        // Visual Depletion Logic:
        // While holding, head is fixed at hitZoneY.
        // If not holding, head falls at audioHeadY.
        const visualHeadY = note.isBeingHeld ? hitZoneY : audioHeadY;
        
        // Trail renders from visualTailY down to visualHeadY.
        // visualTailY is always its rhythmic position audioTailY.
        // If audioTailY has passed the visualHeadY, trail is gone.
        const visualTailY = audioTailY;

        // Render Trail (behind the head)
        if (note.duration > 0.05 && (visualHeadY - visualTailY) > 0) {
          const height = visualHeadY - visualTailY;
          // Trail only renders if not fully consumed or if it hasn't completely passed yet
          if (!note.consumed || note.isBeingHeld) {
            const g = ctx.createLinearGradient(0, visualHeadY, 0, visualTailY);
            if (note.isBeingHeld) {
              // Glowing held style
              g.addColorStop(0, '#fbbf24');
              g.addColorStop(1, 'rgba(251, 191, 36, 0.1)');
              ctx.shadowBlur = 15;
              ctx.shadowColor = '#fbbf24';
            } else {
              // Standard falling style
              g.addColorStop(0, note.missed ? 'rgba(239, 68, 68, 0.4)' : 'rgba(168, 85, 247, 0.8)');
              g.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
              ctx.shadowBlur = 0;
            }
            ctx.fillStyle = g;
            ctx.fillRect(x + w/4, visualTailY, w/2, height);
            ctx.shadowBlur = 0;
          }
        }

        // Render Head
        if (!note.consumed && !note.missed) {
          ctx.shadowBlur = note.isBeingHeld ? 25 : 10;
          ctx.shadowColor = note.isBeingHeld ? '#fbbf24' : '#a855f7';
          ctx.fillStyle = note.isBeingHeld ? '#fbbf24' : '#a855f7';
          ctx.beginPath(); ctx.roundRect(x, visualHeadY - 12, w, 24, 6); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect(x + 5, visualHeadY - 4, w - 10, 8, 4); ctx.fill();
        }
      }

      // Feedback Text
      feedbacksRef.current.forEach((f, idx) => {
        ctx.fillStyle = f.text === 'MISS' || f.text === 'DROPPED' ? '#ef4444' : f.text === 'OK' ? '#3b82f6' : '#fbbf24';
        ctx.globalAlpha = f.opacity; ctx.font = 'bold 20px Inter'; ctx.textAlign = 'center';
        ctx.fillText(f.text, f.lane * laneWidth + laneWidth/2, hitZoneY - 60);
        f.opacity -= 0.03;
        if (f.opacity <= 0) feedbacksRef.current.splice(idx, 1);
      });
      ctx.globalAlpha = 1.0;

      animationFrame = requestAnimationFrame(gameLoop);
    };

    gameLoop();
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, gameStarted, audioEngine, latencyOffset, gameMode, savedMaps, selectedMapId, spawnLeadTime, pixelsPerSecond, onUpdateStats, onTogglePlay, showResults, combo]);

  if (!track) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
        <Gamepad2 size={64} className="opacity-20 animate-pulse" />
        <p className="text-xl font-black tracking-widest uppercase">Load a track to enter runner</p>
      </div>
    );
  }

  const sessionAccuracy = notesInSession > 0 ? Math.round((perfectsInSession / notesInSession) * 100) : 0;
  const rank = sessionAccuracy >= 95 ? 'S' : sessionAccuracy >= 85 ? 'A' : sessionAccuracy >= 70 ? 'B' : 'C';

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="glass px-6 py-4 rounded-3xl flex items-center gap-4 border border-white/5 shadow-xl">
            <Trophy className="text-yellow-400" size={20} />
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Score</div>
              <div className="text-2xl font-mono text-white font-black tracking-tighter tabular-nums">{score.toLocaleString()}</div>
            </div>
          </div>
          <div className="glass px-6 py-4 rounded-3xl flex items-center gap-4 border border-white/5 shadow-xl">
            <Flame className="text-orange-500" size={20} />
            <div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Combo</div>
              <div className="text-2xl font-mono text-white font-black tracking-tighter tabular-nums">x{combo}</div>
            </div>
          </div>
        </div>
        
        <div className="text-right flex flex-col items-end">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter truncate max-w-xs">{track.name}</h2>
          <div className="flex items-center gap-2 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
             <Zap size={14} className={gameMode === 'record' ? 'text-red-500 animate-pulse' : 'text-purple-500'} /> 
             {gameMode === 'record' ? 'RECORD MODE: HOLD TO CREATE LENGTH' : '4-LANE RHYTHM SYSTEM'}
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-8 min-h-0">
        <div ref={containerRef} className="flex-1 relative glass rounded-[3rem] overflow-hidden border border-white/10 flex items-center justify-center shadow-2xl">
          {!gameStarted ? (
            <div className="text-center z-10 space-y-8 p-12 max-w-lg w-full">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-purple-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl">
                <Gamepad2 className="text-white" size={48} />
              </div>
              <h3 className="text-5xl font-black italic text-white tracking-tighter uppercase leading-none">BeatRunner</h3>
              <div className="flex flex-col gap-3">
                <button onClick={() => startGame('procedural')} className="w-full py-5 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-4 shadow-xl">
                  <Play size={24} fill="black" /> Auto Procedural
                </button>
                <button onClick={() => startGame('record')} className="w-full py-5 bg-[#1a1a1e] text-red-400 border border-red-500/20 rounded-2xl font-black uppercase tracking-widest hover:bg-red-500/10 transition-all flex items-center justify-center gap-4">
                  <Edit3 size={24} /> Record Map
                </button>
              </div>
            </div>
          ) : (
            <>
              <canvas ref={canvasRef} width={320} height={600} className="bg-black/40" />
              
              {showResults && (
                <div className="absolute inset-0 z-50 bg-[#050507]/90 backdrop-blur-2xl flex items-center justify-center p-8 animate-in zoom-in-95 fade-in duration-300">
                  <div className="max-w-md w-full glass p-10 rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] text-center space-y-8">
                    <div className="relative">
                      <div className="text-7xl font-black italic text-purple-500 mb-2 leading-none">{rank}</div>
                      <div className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500">Session Rank</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Final Score</div>
                        <div className="text-2xl font-mono text-white font-black tabular-nums">{score.toLocaleString()}</div>
                      </div>
                      <div className="bg-white/5 p-6 rounded-3xl border border-white/5">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Accuracy</div>
                        <div className="text-2xl font-mono text-cyan-400 font-black tabular-nums">{sessionAccuracy}%</div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <button onClick={() => startGame(gameMode, selectedMapId)} className="w-full py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-3"><RotateCcw size={20} /> Try Again</button>
                      <button onClick={handleNextInRunner} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center justify-center gap-3"><FastForward size={20} /> Next Song</button>
                      <button onClick={exitGame} className="w-full py-4 bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-white/20 transition-all flex items-center justify-center gap-3"><LogOut size={20} /> Back to Menu</button>
                    </div>
                  </div>
                </div>
              )}

              {gameMode === 'record' && (
                <div className="absolute top-6 right-6 flex gap-2">
                   <button onClick={saveCurrentRecording} className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg"><Save size={16} /> Save ({recordingNotes.length})</button>
                   <button onClick={() => { setGameStarted(false); setRecordingNotes([]); if(isPlaying) onTogglePlay(); }} className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest">Cancel</button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="w-80 space-y-6 hidden lg:flex flex-col h-full overflow-hidden">
          <div className="glass p-6 rounded-[2.5rem] space-y-4 border border-white/5 shadow-2xl flex-shrink-0">
            <h4 className="flex items-center gap-3 font-black text-white uppercase tracking-tighter text-xl italic"><Info size={20} className="text-blue-400" /> Controls</h4>
            <div className="grid grid-cols-1 gap-2">
              {[ {l: 'L', k: 'A'}, {l: 'ML', k: 'S'}, {l: 'MR', k: 'K'}, {l: 'R', k: 'L'} ].map(c => (
                <div key={c.l} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{c.l}</span>
                  <kbd className="px-3 py-1 bg-slate-900 rounded-lg border border-white/10 text-[10px] font-mono text-white">{c.k}</kbd>
                </div>
              ))}
            </div>
            <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-[10px] text-slate-400 leading-relaxed">
              Play with <span className="text-white font-bold">A S K L</span>. Arrow keys also supported.
            </div>
          </div>
          
          <div className="glass p-6 rounded-[2.5rem] border border-white/5 shadow-2xl flex-1 flex flex-col min-h-0 overflow-hidden">
             <h4 className="flex items-center gap-3 font-black text-white uppercase tracking-tighter text-xl italic mb-6"><Activity size={20} className="text-purple-400" /> Custom Maps</h4>
             <div className="flex-1 overflow-y-auto pr-2 space-y-4 no-scrollbar">
                {savedMaps.length === 0 ? (
                  <div className="text-center py-10">
                    <MusicIcon size={32} className="text-slate-800 mx-auto mb-2 opacity-20" />
                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest">No custom maps yet</p>
                  </div>
                ) : (
                  savedMaps.map(m => {
                    const duration = getMapDuration(m.notes);
                    return (
                      <div key={m.id} className="group glass p-4 rounded-3xl border border-white/5 flex flex-col gap-4 hover:border-blue-500/30 transition-all bg-white/[0.02]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-white font-bold truncate leading-none mb-2">{m.name}</div>
                            <div className="flex items-center gap-3">
                              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1"><Activity size={10} className="text-purple-500" /> {m.notes.length} beats</div>
                              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1"><Clock size={10} className="text-blue-500" /> {formatShortTime(duration)}</div>
                            </div>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); deleteMap(m.id); }} className="p-2 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={14} /></button>
                        </div>
                        <button onClick={() => startGame('play_custom', m.id)} className="w-full py-2.5 bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600 hover:text-white text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg">Launch Track</button>
                      </div>
                    );
                  })
                )}
             </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
        .animate-shake { animation: shake 0.2s; animation-iteration-count: 1; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .tabular-nums { font-variant-numeric: tabular-nums; }
      `}</style>
    </div>
  );
};

export default BeatRunner;
