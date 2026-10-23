'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, RefreshCw, MapPin, Camera, Maximize2, Cctv } from 'lucide-react';
import { CameraFeedView, useCameraFeed } from './camera-feed-view';
import type { WatchedCamera } from '@/lib/dashboard-state';

interface CameraViewerProps {
  camera: WatchedCamera | null;
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
  /** This camera is in the viewer's SPACE multiviewer. */
  pinned?: boolean;
  onTogglePin?: () => void;
}

export default function CameraViewer({ camera, onClose, onLocate, pinned = false, onTogglePin }: CameraViewerProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const iv = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toISOString().split('T')[1].slice(0, 8) + 'Z');
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const camId = camera ? `CAM-${Math.abs(camera.lat * 10000).toFixed(0).padStart(4, '0').slice(-4)}-${Math.abs(camera.lng * 10000).toFixed(0).padStart(4, '0').slice(-4)}` : 'UNKNOWN';

  
  const feed = useCameraFeed(camera);
  const { setImageUrl, view, externalOnly, streamType, resolvedEmbed, watchLiveUrl, gone } = feed;

  if (!camera) return null;

  return (
    <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, type: "spring", bounce: 0 }}
          className={`fixed z-[500] ${
            fullscreen 
              ? 'inset-2 md:inset-4' 
              : 'bottom-[70px] left-2 right-2 md:bottom-6 md:right-6 md:left-auto md:w-[480px]'
          }`}
        >
          <div className="overflow-hidden h-full flex flex-col bg-black/85 backdrop-blur-xl border border-[var(--border-primary)]" style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.9), inset 0 0 30px rgba(0,0,0,0.8)' }}>
            
            {/* Tactical Grid Overlay on background */}
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{
              backgroundImage: 'linear-gradient(var(--border-secondary) 1px, transparent 1px), linear-gradient(90deg, var(--border-secondary) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }} />

            {/* Tactical Header */}
            <div className="flex flex-col border-b border-[var(--border-primary)] bg-black/60 relative z-10">
              {/* Top Meta Bar */}
              <div className="flex items-center justify-between px-3 py-1 border-b border-white/5 text-[9px] font-mono tracking-[0.2em] text-[var(--text-muted)] bg-[var(--hover-accent)]">
                <div className="flex items-center gap-3">
                  <span className="text-[var(--gold-primary)] font-bold">{camId}</span>
                  <span>{camera.lat?.toFixed(4)}, {camera.lng?.toFixed(4)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>{currentTime}</span>
                  <span className="text-[var(--gold-primary)]">SECURE UPLINK</span>
                </div>
              </div>

              {/* Main Title Bar */}
              <div className="flex items-center justify-between px-3 md:px-4 py-2 md:py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative flex items-center justify-center w-6 h-6 border border-[var(--gold-primary)] bg-[var(--gold-primary)]/10 rounded-sm">
                    <Camera className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                    <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-[var(--gold-primary)]" />
                    <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-[var(--gold-primary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[11px] md:text-[12px] font-mono font-bold tracking-widest truncate text-white uppercase" style={{ textShadow: '0 0 10px rgba(255,255,255,0.3)' }}>{camera.name}</h3>
                    <p className="text-[9px] md:text-[9px] font-mono text-[var(--gold-primary)] uppercase tracking-wider opacity-80">{camera.city}, {camera.country} • SOURCE: {camera.source}</p>
                  </div>
                </div>
                
                {/* Controls */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                  {streamType === 'jpg' && (
                    <button 
                      onClick={() => {
                        const targetUrl = camera.feed_url || camera.stream_url;
                        if (targetUrl) {
                          const url = targetUrl.includes('?') ? `${targetUrl}&_t=${Date.now()}` : `${targetUrl}?_t=${Date.now()}`;
                          setImageUrl(url);
                        }
                      }} 
                      className="p-1.5 rounded-sm bg-white/5 border border-white/10 hover:bg-[var(--gold-primary)]/20 hover:border-[var(--gold-primary)] transition-all" title="Refresh feed"
                    >
                      <RefreshCw className="w-3 h-3 text-[var(--text-secondary)] hover:text-[var(--gold-primary)]" />
                    </button>
                  )}
                  {onTogglePin && (
                    <button
                      type="button"
                      onClick={onTogglePin}
                      aria-pressed={pinned}
                      title={pinned ? 'Keluarkan dari multiviewer SPACE' : 'Tampilkan di multiviewer SPACE'}
                      className={`flex items-center gap-1 px-2 py-1 rounded-sm border text-[9px] font-mono font-bold tracking-widest transition-all ${
                        pinned ? 'bg-[#00E5FF]/20 border-[#00E5FF] text-[#00E5FF]' : 'bg-white/5 border-white/10 text-[var(--text-secondary)] hover:bg-[#00E5FF]/15 hover:border-[#00E5FF] hover:text-[#00E5FF]'
                      }`}
                    >
                      <Cctv className="w-3 h-3" />
                      <span className="hidden sm:inline">{pinned ? 'DI SPACE' : 'PILIH UNTUK SPACE'}</span>
                    </button>
                  )}
                  {camera.lat && camera.lng && (
                    <button onClick={() => onLocate?.(camera.lat, camera.lng)} className="p-1.5 rounded-sm bg-white/5 border border-white/10 hover:bg-[var(--gold-primary)]/20 hover:border-[var(--gold-primary)] transition-all" title="Fly to location">
                      <MapPin className="w-3 h-3 text-[var(--text-secondary)] hover:text-[var(--gold-primary)]" />
                    </button>
                  )}
                  <button onClick={() => setFullscreen(!fullscreen)} className="hidden md:block p-1.5 rounded-sm bg-white/5 border border-white/10 hover:bg-[var(--text-primary)]/20 hover:border-[var(--text-primary)] transition-all" title="Toggle fullscreen">
                    <Maximize2 className="w-3 h-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" />
                  </button>
                  <button onClick={onClose} className="p-1.5 rounded-sm bg-red-900/30 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500 transition-all ml-2">
                    <X className="w-4 h-4 md:w-3 md:h-3 text-red-400 hover:text-red-200" />
                  </button>
                </div>
              </div>
            </div>

          {/* Camera Feed */}
          <div className={`relative bg-[#020202] ${fullscreen ? 'flex-1 overflow-hidden' : 'aspect-video max-h-[35vh] md:max-h-none'}`}>
            {/* Tactical CRT Overlay */}
            <div className="absolute inset-0 pointer-events-none z-20" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 2px)',
              backgroundSize: '100% 4px',
            }} />
            <div className="absolute inset-0 pointer-events-none z-20 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]" />

            <CameraFeedView feed={feed} contain={fullscreen} />

            {/* Tactical Crosshairs */}
            <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
              <div className="w-[80%] h-[1px] bg-white/5 absolute top-1/2 -translate-y-1/2" />
              <div className="h-[80%] w-[1px] bg-white/5 absolute left-1/2 -translate-x-1/2" />
              <div className="w-16 h-16 border border-white/10 rounded-full" />
              <div className="w-1 h-1 bg-[var(--gold-primary)]/50 absolute" />
            </div>
          </div>

          {/* Advanced Tactical Footer */}
          <div className="bg-black border-t border-[var(--border-primary)] relative z-10">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
              <div className="flex gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-[var(--text-muted)] font-mono tracking-widest">FEED TYPE</span>
                  <span className="text-[9px] text-white font-mono tracking-widest uppercase">
                    {view === 'offline' ? (gone ? 'WITHDRAWN' : 'OFFLINE') : watchLiveUrl ? 'SNAPSHOT' : externalOnly ? 'EXTERNAL' : resolvedEmbed ? 'YOUTUBE LIVE' : streamType}
                  </span>
                </div>
                <div className="flex flex-col border-l border-white/10 pl-4">
                  <span className="text-[9px] text-[var(--text-muted)] font-mono tracking-widest">STATUS</span>
                  {/* Nothing is being received locally for an external feed — don't claim otherwise. */}
                  <span className={`text-[9px] font-mono tracking-widest ${externalOnly ? 'text-[var(--gold-primary)]' : 'text-[var(--alert-green)]'}`}>
                    {view === 'offline' ? (gone ? 'REMOVED BY SOURCE' : 'OFF AIR AT SOURCE') : watchLiveUrl ? 'LIVE VIDEO AT SOURCE' : externalOnly ? 'HOSTED OFF-PLATFORM' : 'ACTIVE / RECORDING'}
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                {/* A withdrawn camera's page is a 404 — the big button is already
                    hidden for it, and this link would lead to the same dead page. */}
                {!gone && (camera.feed_url || camera.external_url || (streamType === 'iframe' && camera.stream_url)) && (
                  <a href={camera.external_url || camera.feed_url || (streamType === 'iframe' ? camera.stream_url : undefined)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-[9px] font-mono text-[var(--gold-primary)] tracking-widest">
                    <ExternalLink className="w-2.5 h-2.5" /> RAW FEED
                  </a>
                )}
                <a href={`https://www.google.com/maps/@${camera.lat},${camera.lng},17z`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-[9px] font-mono text-[var(--cyan-primary)] tracking-widest">
                  <MapPin className="w-2.5 h-2.5" /> MAP TARGET
                </a>
              </div>
            </div>
            {/* Animated data stream bar */}
            <div className="h-[2px] w-full bg-[var(--border-primary)] overflow-hidden relative">
              <div className="motion-progress-sweep absolute top-0 bottom-0 left-0 bg-[var(--gold-primary)] shadow-[0_0_8px_var(--gold-primary)] w-1/3" />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
