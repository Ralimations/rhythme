import React, { useState } from 'react';
import { AudioEngine } from '../services/audioEngine';
import { RefreshCw, Save, Layers } from 'lucide-react';

interface EqualizerProps {
  audioEngine: AudioEngine | null;
}

const FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const PRESETS: Record<string, number[]> = {
  FLAT: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ROCK: [4, 3, 2, 0, -1, -1, 0, 2, 3, 4],
  POP: [-1, 0, 1, 2, 1, 0, -1, -1, -2, -2],
  JAZZ: [3, 2, 1, 2, -1, -1, 0, 1, 2, 3],
  'BASS BOOST': [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
};

const DB_MARKERS = [12, 9, 6, 3, 0, -3, -6];

const Equalizer: React.FC<EqualizerProps> = ({ audioEngine }) => {
  const [gains, setGains] = useState<number[]>(new Array(10).fill(0));
  const [activePreset, setActivePreset] = useState('FLAT');

  const handleGainChange = (index: number, val: number) => {
    const newGains = [...gains];
    newGains[index] = val;
    setGains(newGains);
    if (audioEngine) {
      audioEngine.setEQ(index, val);
    }
    setActivePreset('CUSTOM');
  };

  const applyPreset = (name: string) => {
    const presetGains = PRESETS[name];
    setGains(presetGains);
    setActivePreset(name);
    presetGains.forEach((gain, i) => {
      if (audioEngine) audioEngine.setEQ(i, gain);
    });
  };

  return (
    <div className="h-full flex flex-col gap-6 md:gap-8 animate-in fade-in duration-500 max-w-full">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-1 flex items-center gap-3 tracking-tighter italic">
            <Layers className="text-blue-400" size={28} /> SONIC SCULPTOR
          </h2>
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.2em] ml-1">10-BAND PRECISION FREQUENCY CONTROL</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 md:px-6 py-2 bg-[#1a1a1e] border border-white/10 rounded-xl hover:bg-white/5 transition-all text-white text-[10px] md:text-[11px] font-bold uppercase tracking-wider">
            <Save size={16} /> SAVE PROFILE
          </button>
          <button 
            onClick={() => applyPreset('FLAT')}
            className="flex items-center gap-2 px-4 md:px-6 py-2 bg-[#1a1a1e] border border-white/10 rounded-xl hover:bg-white/5 transition-all text-white text-[10px] md:text-[11px] font-bold uppercase tracking-wider"
          >
            <RefreshCw size={16} /> RESET
          </button>
        </div>
      </div>

      {/* Main Equalizer Rack - Horizontally Scrollable on small screens */}
      <div className="bg-[#050507] p-6 md:p-12 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden">
        <div className="flex items-stretch gap-2 md:gap-4 overflow-x-auto pb-4 no-scrollbar">
          
          {/* Vertical dB Scale - Sticky Left */}
          <div className="sticky left-0 bg-[#050507]/80 backdrop-blur-sm z-20 flex flex-col justify-between py-2 text-[10px] font-mono text-slate-600 font-bold select-none h-64 md:h-72 pr-4 border-r border-white/5">
            {DB_MARKERS.map(m => (
              <span key={m} className="flex items-center h-4">{m > 0 ? `+${m}` : m}</span>
            ))}
          </div>

          {/* Faders Rack Area */}
          <div className="flex-1 relative min-w-[600px] md:min-w-fit">
            {/* Grid Background */}
            <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none opacity-10">
              {DB_MARKERS.map(m => (
                <div key={m} className={`w-full border-t border-dashed ${m === 0 ? 'border-blue-400/50 border-solid opacity-60' : 'border-slate-500'}`} />
              ))}
            </div>

            {/* Faders Container */}
            <div className="relative z-10 flex items-start justify-between gap-1 md:gap-4 h-64 md:h-72">
              {FREQUENCIES.map((freq, i) => {
                const percentage = ((gains[i] + 12) / 24) * 100;
                const isPositive = gains[i] > 0;
                const fillHeight = (Math.abs(gains[i]) / 24) * 100;
                const fillBottom = isPositive ? 50 : 50 - fillHeight;

                return (
                  <div key={freq} className="flex flex-col items-center h-full flex-1 min-w-[48px] group">
                    <div className="relative flex-1 w-[1px] md:w-[2px] bg-white/5 rounded-full flex items-center justify-center overflow-visible">
                      
                      {/* Zero point marker line */}
                      <div className="absolute w-4 h-[1px] bg-blue-400/20 top-1/2 -translate-y-1/2 z-0" />

                      {/* Dynamic Fill Path (Purple/Blue Glow) */}
                      <div 
                        className={`absolute left-[-1.5px] w-[4px] md:w-[6px] rounded-full transition-all duration-300 ${isPositive ? 'bg-gradient-to-t from-blue-500/20 to-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-gradient-to-b from-blue-500/20 to-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.4)]'}`} 
                        style={{ 
                          height: `${fillHeight}%`, 
                          bottom: `${fillBottom}%`,
                        }}
                      />

                      {/* INVISIBLE RANGE INPUT - Perfectly matching track height */}
                      <input 
                        type="range"
                        min="-12"
                        max="12"
                        step="0.1"
                        value={gains[i]}
                        onChange={(e) => handleGainChange(i, parseFloat(e.target.value))}
                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 opacity-0 cursor-pointer z-30 appearance-none"
                        style={{ width: '100%', height: '48px', minWidth: '256px' }}
                      />

                      {/* CRISP WHITE RECTANGULAR THUMB (From User Image) */}
                      <div 
                        className="absolute left-1/2 -translate-x-1/2 w-10 md:w-12 h-6 md:h-7 bg-white rounded-sm shadow-[0_0_20px_rgba(255,255,255,0.25)] pointer-events-none z-20 flex items-center justify-center gap-[2px] border border-slate-900/10 active:scale-95 transition-transform"
                        style={{ bottom: `calc(${percentage}% - 12px)` }}
                      >
                        <div className="w-[1px] md:w-[1.5px] h-4 bg-blue-400/20" />
                        <div className="w-[1px] md:w-[1.5px] h-4 bg-blue-400/40" />
                        <div className="w-[1px] md:w-[1.5px] h-4 bg-blue-400/20" />
                      </div>
                    </div>

                    {/* Freq Label */}
                    <div className="mt-4 text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-tighter opacity-60 group-hover:opacity-100 transition-opacity">
                      {freq >= 1000 ? `${freq/1000}k` : freq}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Preset Buttons - Pill Style as per image */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        {Object.keys(PRESETS).map((name) => (
          <button 
            key={name}
            onClick={() => applyPreset(name)}
            className={`px-6 md:px-8 py-2 md:py-3 rounded-full transition-all text-[10px] md:text-[11px] font-black tracking-widest border ${activePreset === name ? 'bg-[#1a1a1e] text-white border-white/20' : 'bg-transparent text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            {name}
          </button>
        ))}
        {activePreset === 'CUSTOM' && (
          <span className="px-6 md:px-8 py-2 md:py-3 rounded-full bg-[#1a1a1e] text-purple-400 border border-purple-500/20 text-[10px] md:text-[11px] font-black tracking-widest uppercase">
            CUSTOM
          </span>
        )}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        input[type=range]::-webkit-slider-thumb { 
          appearance: none; 
          border: none; 
          width: 48px; 
          height: 48px; 
          background: transparent; 
        }
      `}</style>
    </div>
  );
};

export default Equalizer;