
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Music, Activity, Sliders, Gamepad2, Play, Pause, SkipBack, SkipForward, Volume2, Disc } from 'lucide-react';
import { Track, AppView, VisualizerMode } from './types';
import Library from './components/Library';
import Player from './components/Player';
import Equalizer from './components/Equalizer';
import BeatRunner from './components/BeatRunner';
import { AudioEngine } from './services/audioEngine';

interface GlobalStats {
  totalPulseTime: number;
  highScore: number;
  totalPerfect: number;
  totalNotes: number;
}

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.Library);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [visualizerMode, setVisualizerMode] = useState<VisualizerMode>('spectrogram');
  
  const [stats, setStats] = useState<GlobalStats>(() => {
    const saved = localStorage.getItem('rhythme_stats');
    return saved ? JSON.parse(saved) : {
      totalPulseTime: 0,
      highScore: 0,
      totalPerfect: 0,
      totalNotes: 0
    };
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    localStorage.setItem('rhythme_stats', JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    const timer = setInterval(() => {
      setStats(prev => ({
        ...prev,
        totalPulseTime: prev.totalPulseTime + 1
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const updateStats = useCallback((updates: Partial<GlobalStats>) => {
    setStats(prev => {
      const next = { ...prev, ...updates };
      if (updates.highScore !== undefined) {
        next.highScore = Math.max(prev.highScore, updates.highScore);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (audioRef.current && !audioEngineRef.current) {
      audioEngineRef.current = new AudioEngine(audioRef.current);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlayback = async () => {
      try {
        if (isPlaying) {
          if (audioEngineRef.current) {
            await audioEngineRef.current.resume();
          }
          await audio.play();
        } else {
          audio.pause();
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Playback failed:', error);
          setIsPlaying(false);
        }
      }
    };

    handlePlayback();
  }, [isPlaying, currentTrackIndex]);

  const handleTrackSelect = (index: number) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    setView(AppView.Player);
  };

  const handleTogglePlay = () => setIsPlaying(prev => !prev);

  const handleNext = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    setIsPlaying(true);
  }, [tracks.length]);

  const handlePrev = useCallback(() => {
    if (tracks.length === 0) return;
    setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
    setIsPlaying(true);
  }, [tracks.length]);

  const handleTimeUpdate = () => {
    if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    audioRef.current.currentTime = percentage * duration;
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTrack = currentTrackIndex >= 0 ? tracks[currentTrackIndex] : null;

  return (
    <div className="flex flex-col h-screen bg-[#050507] text-slate-200">
      {/* Refined Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className={`absolute -top-[10%] -left-[10%] w-[60%] h-[60%] bg-purple-600/5 blur-[120px] rounded-full transition-all duration-1000 ${isPlaying ? 'opacity-40' : 'opacity-20'}`} />
        <div className={`absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full transition-all duration-1000 ${isPlaying ? 'opacity-40' : 'opacity-20'}`} />
      </div>

      <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 glass sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.3)]">
            <Activity className="text-white" size={20} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black italic tracking-tighter text-white leading-none">RhythMe</h1>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mt-0.5">by ralthology</span>
          </div>
        </div>
        
        <nav className="flex items-center gap-2">
          {[
            { id: AppView.Library, icon: Music, label: 'Library' },
            { id: AppView.Player, icon: Disc, label: 'Player' },
            { id: AppView.Equalizer, icon: Sliders, label: 'EQ' },
            { id: AppView.BeatRunner, icon: Gamepad2, label: 'BeatRunner' }
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setView(item.id as AppView)} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-bold text-xs uppercase tracking-widest ${view === item.id ? 'bg-white/10 text-white shadow-xl border border-white/10' : 'text-slate-500 hover:text-white'}`}
            >
              <item.icon size={16} /> <span className="hidden lg:inline">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-6xl mx-auto h-full">
          {view === AppView.Library && (
            <Library 
              tracks={tracks} 
              setTracks={setTracks} 
              onSelectTrack={handleTrackSelect} 
              currentTrackId={currentTrack?.id} 
              stats={stats}
            />
          )}
          {view === AppView.Player && (
            <Player 
              track={currentTrack} 
              audioEngine={audioEngineRef.current} 
              mode={visualizerMode} 
              setMode={setVisualizerMode} 
              isPlaying={isPlaying}
            />
          )}
          {view === AppView.Equalizer && (
            <Equalizer audioEngine={audioEngineRef.current} />
          )}
          {view === AppView.BeatRunner && (
            <BeatRunner 
              track={currentTrack} 
              audioEngine={audioEngineRef.current} 
              isPlaying={isPlaying} 
              onTogglePlay={handleTogglePlay} 
              onUpdateStats={updateStats}
              onNextTrack={handleNext}
            />
          )}
        </div>
      </main>

      <audio 
        ref={audioRef} 
        src={currentTrack?.url} 
        onEnded={() => {
          if (view !== AppView.BeatRunner) {
            handleNext();
          }
        }} 
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />

      <footer className="h-28 bg-[#050507]/80 backdrop-blur-2xl border-t border-white/5 px-8 flex items-center justify-between sticky bottom-0 z-50">
        <div className="w-1/4 flex items-center gap-4">
          {currentTrack && (
            <>
              <div className="w-14 h-14 bg-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden group shadow-2xl border border-white/5">
                <Music size={24} className="text-slate-700" />
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10" />
              </div>
              <div className="truncate">
                <div className="font-bold text-white text-sm truncate leading-tight tracking-tight">{currentTrack.name}</div>
                <div className="text-[10px] text-slate-500 font-black truncate uppercase tracking-[0.2em] mt-1">Unknown Artist</div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-4 w-1/2 max-w-2xl relative">
          <div className="flex items-center gap-8">
            <button onClick={handlePrev} className="text-slate-600 hover:text-white transition-colors"><SkipBack size={24} /></button>
            <button 
              onClick={handleTogglePlay} 
              className="w-14 h-14 bg-white text-black rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)]"
            >
              {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
            </button>
            <button onClick={handleNext} className="text-slate-600 hover:text-white transition-colors"><SkipForward size={24} /></button>
          </div>
          <div className="w-full flex items-center gap-4 px-4">
            <div className="text-[10px] text-slate-600 font-mono font-bold w-10 text-right">{formatTime(currentTime)}</div>
            <div 
              className="flex-1 h-1.5 bg-white/5 rounded-full relative cursor-pointer group overflow-hidden"
              onClick={handleSeek}
            >
              <div 
                className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all duration-100" 
                style={{ width: `${(currentTime / duration) * 100}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-600 font-mono font-bold w-10">{formatTime(duration)}</div>
          </div>
          
          <div className="absolute right-[-140%] bottom-0 opacity-20 hover:opacity-60 transition-opacity text-[9px] font-black uppercase tracking-[0.4em] pointer-events-none select-none">
            developed by ralthology
          </div>
        </div>

        <div className="w-1/4 flex items-center justify-end gap-3">
          <Volume2 size={18} className="text-slate-600" />
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              if (audioRef.current) audioRef.current.volume = val;
            }}
            className="w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-white" 
          />
        </div>
      </footer>
    </div>
  );
};

export default App;
