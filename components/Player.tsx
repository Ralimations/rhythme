
import React, { useRef, useEffect } from 'react';
import { Track, VisualizerMode } from '../types';
import { AudioEngine } from '../services/audioEngine';
import { BarChart3, Waves, Zap, Disc } from 'lucide-react';

interface PlayerProps {
  track: Track | null;
  audioEngine: AudioEngine | null;
  mode: VisualizerMode;
  setMode: (mode: VisualizerMode) => void;
  isPlaying: boolean;
}

const Player: React.FC<PlayerProps> = ({ track, audioEngine, mode, setMode, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !audioEngine) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const data = mode === 'waveform' ? audioEngine.getTimeDomainData() : audioEngine.getFrequencyData();
      
      ctx.clearRect(0, 0, width, height);
      
      if (mode === 'waveform') {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#60a5fa';
        ctx.beginPath();
        const sliceWidth = width / data.length;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0;
          const y = v * height / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.stroke();
      } else if (mode === 'spectrogram') {
        const barWidth = (width / data.length) * 4;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const barHeight = (data[i] / 255) * height;
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, '#3b82f6');
          gradient.addColorStop(0.5, '#a855f7');
          gradient.addColorStop(1, '#ec4899');
          ctx.fillStyle = gradient;
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      } else if (mode === 'particles') {
        const energy = audioEngine.getEnergy(20, 250); // Bass detection
        const burstCount = Math.floor(energy / 20);
        ctx.fillStyle = `rgba(168, 85, 247, ${energy / 255})`;
        ctx.beginPath();
        ctx.arc(width/2, height/2, (energy/255) * height/3, 0, Math.PI * 2);
        ctx.fill();
        
        // Dynamic circles around center
        for(let i = 0; i < 5; i++) {
          ctx.strokeStyle = `rgba(96, 165, 250, ${1 - (i/5)})`;
          ctx.beginPath();
          ctx.arc(width/2, height/2, ((energy/255) * (height/3)) + (i * 20), 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      animationFrame = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrame);
  }, [mode, audioEngine]);

  if (!track) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
        <Disc size={64} className="animate-spin-slow opacity-20" />
        <p className="text-xl">Select a track to start visualizing</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-700">
      <div className="flex flex-col items-center gap-2">
        <h2 className="text-4xl font-bold text-white text-center">{track.name}</h2>
        <p className="text-slate-400 text-lg">{track.artist} — {track.album}</p>
      </div>

      <div className="relative flex-1 glass rounded-3xl overflow-hidden border border-white/10 group">
        <canvas 
          ref={canvasRef} 
          width={1200} 
          height={600} 
          className="w-full h-full object-cover"
        />
        
        {/* Mode Selector Overlay */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-2xl flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => setMode('waveform')}
            className={`p-2 rounded-lg transition-all ${mode === 'waveform' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Waves size={20} />
          </button>
          <button 
            onClick={() => setMode('spectrogram')}
            className={`p-2 rounded-lg transition-all ${mode === 'spectrogram' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <BarChart3 size={20} />
          </button>
          <button 
            onClick={() => setMode('particles')}
            className={`p-2 rounded-lg transition-all ${mode === 'particles' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Zap size={20} />
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="glass p-6 rounded-3xl border border-white/5">
          <div className="text-xs text-slate-500 uppercase font-bold mb-2 tracking-widest">Format</div>
          <div className="text-2xl font-mono text-blue-400">{track.file.type.split('/')[1]?.toUpperCase() || 'PCM'}</div>
        </div>
        <div className="glass p-6 rounded-3xl border border-white/5">
          <div className="text-xs text-slate-500 uppercase font-bold mb-2 tracking-widest">Sample Rate</div>
          <div className="text-2xl font-mono text-purple-400">48,000 Hz</div>
        </div>
      </div>
    </div>
  );
};

export default Player;
