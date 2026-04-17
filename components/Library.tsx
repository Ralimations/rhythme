
import React from 'react';
import { Plus, Music, Play } from 'lucide-react';
import { Track } from '../types';

interface LibraryProps {
  tracks: Track[];
  setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
  onSelectTrack: (index: number) => void;
  currentTrackId?: string;
  stats: {
    totalPulseTime: number;
    highScore: number;
    totalPerfect: number;
    totalNotes: number;
  };
}

const Library: React.FC<LibraryProps> = ({ tracks, setTracks, onSelectTrack, currentTrackId, stats }) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newTracks: Track[] = (Array.from(files) as File[]).map((file) => ({
      id: Math.random().toString(36).substring(2, 11),
      name: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Unknown Artist",
      album: "Unknown Album",
      file,
      url: URL.createObjectURL(file),
      duration: 0
    }));

    setTracks((prev) => [...prev, ...newTracks]);
  };

  const formatPulseTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const accuracy = stats.totalNotes > 0 ? Math.round((stats.totalPerfect / stats.totalNotes) * 100) : 0;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">My Library</h2>
          <p className="text-slate-400">Manage your local collection and start the pulse.</p>
        </div>
        
        <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl cursor-pointer transition-all shadow-lg shadow-blue-600/20 active:scale-95">
          <Plus size={20} />
          <span className="font-semibold uppercase text-xs tracking-widest">Add Music Files</span>
          <input type="file" multiple accept="audio/*" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>

      {tracks.length === 0 ? (
        <div className="h-64 glass rounded-[2.5rem] flex flex-col items-center justify-center border-dashed border-2 border-white/5">
          <Music size={48} className="text-slate-800 mb-4" />
          <p className="text-slate-500 text-lg italic">Your library is quiet... Add some tracks!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tracks.map((track, index) => (
            <div 
              key={track.id}
              onClick={() => onSelectTrack(index)}
              className={`group glass p-5 rounded-[2rem] flex items-center gap-5 cursor-pointer transition-all border border-transparent hover:border-purple-500/30 hover:bg-white/10 ${currentTrackId === track.id ? 'border-purple-500/50 bg-white/10 shadow-[0_0_30px_rgba(168,85,247,0.15)]' : ''}`}
            >
              <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center relative overflow-hidden group-hover:scale-105 transition-transform border border-white/5 shadow-inner">
                <Music size={32} className="text-slate-700" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Play size={24} fill="white" className="text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-white truncate group-hover:text-purple-400 transition-colors text-lg tracking-tight">{track.name}</h3>
                <p className="text-[11px] text-slate-500 font-black uppercase tracking-[0.2em] mt-0.5 truncate">{track.artist}</p>
              </div>
              {currentTrackId === track.id && (
                <div className="flex items-end gap-1 h-6">
                  <div className="w-1.5 h-3 bg-blue-500 animate-pulse rounded-full" />
                  <div className="w-1.5 h-6 bg-blue-500 animate-pulse delay-75 rounded-full" />
                  <div className="w-1.5 h-4 bg-blue-500 animate-pulse delay-150 rounded-full" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Recommended/Stats section - Real-time Updated from reference image */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12">
        <div className="bg-[#111114] p-10 rounded-[2rem] border border-white/5 shadow-2xl transition-all">
          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Total Pulse Time</h4>
          <p className="text-5xl font-mono text-blue-500 font-medium tracking-tighter tabular-nums">
            {formatPulseTime(stats.totalPulseTime)}
          </p>
        </div>
        <div className="bg-[#111114] p-10 rounded-[2rem] border border-white/5 shadow-2xl transition-all">
          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">High Score (BeatRunner)</h4>
          <p className="text-5xl font-mono text-purple-500 font-medium tracking-tighter">
            {stats.highScore.toLocaleString()}
          </p>
        </div>
        <div className="bg-[#111114] p-10 rounded-[2rem] border border-white/5 shadow-2xl transition-all">
          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 mb-6">Perfect Beats</h4>
          <p className="text-5xl font-mono text-cyan-400 font-medium tracking-tighter">
            {accuracy}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default Library;
