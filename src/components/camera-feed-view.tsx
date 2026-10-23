'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ExternalLink, PlayCircle } from 'lucide-react';
import Hls from 'hls.js';
import { isHostedOffPlatform, liveFeedAtSource, localEmbed, needsResolution, offPlatformView } from '@/lib/camera-feed';
import type { WatchedCamera } from '@/lib/dashboard-state';

/** Playback state for one camera. Shared by the map's CameraViewer and the SPACE grid, so both play every feed type the same way. */
export function useCameraFeed(camera: WatchedCamera | null) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const externalFeedUrl = camera?.external_url || camera?.feed_url;
  const hostedOffPlatform = isHostedOffPlatform(camera);

  /**
   * A SkylineWebcams page is usually a wrapper around a public YouTube
   * livestream published by the camera's actual operator, so it can play here
   * rather than sending the viewer off-platform. Resolved live rather than
   * baked into the camera data: a livestream that restarts comes back under a
   * new video id, and a baked id would work until it silently didn't.
   *
   * The answer is stored against the URL it belongs to. Keying it that way is
   * what makes switching cameras safe: a reply that arrives late carries the
   * previous key, so it is simply not read rather than painting the last
   * camera's stream into the current one. It also means neither `resolving`
   * nor the reset needs to be written back into state — both fall out of the
   * key comparison at render.
   */
  // A link that already names the video needs no lookup at all.
  const directEmbed = localEmbed(camera);
  // Snapshot cameras are checked too, in the background: the picture shows
  // immediately and is withdrawn only if the source says the camera is gone.
  const resolveKey: string | null =
    (camera && needsResolution(camera) ? camera.external_url : null) ?? liveFeedAtSource(camera);
  const [resolution, setResolution] = useState<{ key: string; embed: string | null; offline: boolean; kind?: string } | null>(null);
  const resolvedEmbed = directEmbed ?? (resolution && resolution.key === resolveKey ? resolution.embed : null);
  const resolving = Boolean(resolveKey) && resolution?.key !== resolveKey;
  const offline = resolution?.key === resolveKey && resolution.offline;
  const gone = resolution?.key === resolveKey && resolution.kind === 'missing';

  // Live video exists at the source but cannot be replayed here, so offer the
  // way through to it and stop calling the still image a live feed.
  const watchLiveUrl = liveFeedAtSource(camera);

  useEffect(() => {
    if (!resolveKey) return;
    let live = true;
    fetch(`/api/cctv/resolve?url=${encodeURIComponent(resolveKey)}`)
      .then(r => r.json())
      .then(d => { if (live) setResolution({ key: resolveKey, embed: d?.embeddable ? d.embedUrl : null, offline: d?.kind === 'offline' || d?.kind === 'missing', kind: d?.kind }); })
      // A resolver failure is not a broken camera — it falls back to the link.
      .catch(() => { if (live) setResolution({ key: resolveKey, embed: null, offline: false }); });
    return () => { live = false; };
  }, [resolveKey]);

  const streamType = resolvedEmbed ? 'iframe' : (camera?.stream_type || 'jpg');
  const streamUrl: string | undefined = resolvedEmbed || camera?.stream_url;
  const view = offPlatformView({ hostedOffPlatform, resolving, resolvedEmbed, offline });
  const externalOnly = view !== 'inline';

  useEffect(() => {
    if (!camera) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this effect drives the external HLS/image player and resets its UI for each camera
    setLoading(true);
    setError(false);
    setImageUrl(null);

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (externalOnly) {
      setLoading(false);
      return;
    }

    if (streamType === 'hls' && camera.stream_url) {
      if (Hls.isSupported() && videoRef.current) {
        const hls = new Hls({ enableWorker: false });
        hlsRef.current = hls;
        hls.loadSource(camera.stream_url);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          videoRef.current?.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) setError(true);
        });
      } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = camera.stream_url;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setLoading(false);
          videoRef.current?.play().catch(() => {});
        });
      }
      return;
    }

    if (streamType === 'mjpeg' && camera.stream_url) {
      setLoading(false);
      return;
    }

    if ((streamType === 'iframe' || streamType === 'mp4') && streamUrl) {
      setLoading(false);
      return;
    }

    // JPG fallback
    const targetUrl = camera.feed_url || camera.stream_url;
    if (targetUrl) {
      const url = targetUrl.includes('?') ? `${targetUrl}&_t=${Date.now()}` : `${targetUrl}?_t=${Date.now()}`;
      setImageUrl(url);
    } else {
      setError(true);
      setLoading(false);
    }
  }, [camera, streamType, streamUrl, externalOnly, retryCount]);

  // Auto-refresh for JPGs
  useEffect(() => {
    if (streamType !== 'jpg' || (!camera?.feed_url && !camera?.stream_url)) return;
    const targetUrl = camera.feed_url || camera.stream_url;
    if (!targetUrl) return;

    const iv = setInterval(() => {
      const url = targetUrl.includes('?') ? `${targetUrl}&_t=${Date.now()}` : `${targetUrl}?_t=${Date.now()}`;
      setImageUrl(url);
    }, 5000); // 5s refresh for JPG
    return () => clearInterval(iv);
  }, [camera, streamType]);

  return {
    camera, imageUrl, setImageUrl, loading, setLoading, error, setError, setRetryCount, videoRef,
    externalFeedUrl, view, externalOnly, streamType, streamUrl, resolvedEmbed, watchLiveUrl, gone,
  };
}

export type CameraFeed = ReturnType<typeof useCameraFeed>;

/** The picture: player plus loading, offline, external and error states. Fills its positioned parent. */
export function CameraFeedView({ feed, contain = false }: { feed: CameraFeed; contain?: boolean }) {
  const {
    camera, imageUrl, loading, setLoading, error, setError, setRetryCount, videoRef,
    externalFeedUrl, view, externalOnly, streamType, streamUrl, watchLiveUrl, gone,
  } = feed;
  if (!camera) return null;
  return (
    <>
      {loading && !error && !externalOnly && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--gold-dim)', borderTopColor: 'transparent' }} />
            <span className="text-[10px] font-mono tracking-[0.25em]" style={{ color: 'var(--gold-primary)' }}>DECRYPTING FEED...</span>
          </div>
        </div>
      )}

      {view === 'resolving' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 backdrop-blur-sm p-4 text-center">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: 'var(--gold-dim)', borderTopColor: 'transparent' }} />
          <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: 'var(--gold-primary)' }}>ACQUIRING UPLINK</p>
          <p className="text-[9px] font-mono text-[var(--text-muted)] mt-2 uppercase">Locating a direct feed</p>
        </div>
      ) : view === 'offline' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 backdrop-blur-sm p-4 text-center">
          <CameraOff className="w-6 h-6 mb-3 opacity-50 text-[var(--text-muted)]" />
          <p className="text-[11px] font-mono uppercase tracking-widest text-[var(--text-secondary)]">{gone ? 'CAMERA WITHDRAWN' : 'CAMERA OFFLINE'}</p>
          <p className="text-[9px] font-mono text-[var(--text-muted)] mt-2 max-w-[80%] uppercase">{gone ? 'No longer published at source' : 'The operator has this feed off air'}</p>
          {/* No ACCESS TERMINAL button: the page it would open is either
              showing the same 'offline' banner we just read, or a 404. */}
        </div>
      ) : view === 'external' ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 backdrop-blur-sm p-4 text-center">
          <ExternalLink className="w-6 h-6 mb-3 opacity-50" style={{ color: 'var(--gold-primary)' }} />
          <p className="text-[11px] font-mono uppercase tracking-widest" style={{ color: 'var(--gold-primary)' }}>SECURE FEED ENCRYPTED</p>
          <p className="text-[9px] font-mono text-[var(--text-muted)] mt-2 max-w-[80%] uppercase">This feed requires external clearance</p>
          <a 
            href={externalFeedUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-4 px-4 py-2 rounded text-[10px] font-mono font-bold tracking-widest transition-all hover:bg-white/10"
            style={{ border: '1px solid var(--border-primary)', color: 'var(--gold-primary)' }}
          >
            ACCESS TERMINAL
          </a>
        </div>
      ) : error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90">
          <div className="text-center">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mb-2 mx-auto"><Camera className="w-4 h-4 text-red-400" /></div>
            <span className="text-[10px] font-mono text-red-400 tracking-widest block mb-1">FEED UNAVAILABLE</span>
            <span className="text-[9px] font-mono text-[var(--text-muted)]">Camera may be offline or restricted</span>
            <button onClick={() => { setError(false); setRetryCount(c => c + 1); }} className="block mx-auto mt-3 px-3 py-1 text-[9px] font-mono text-[#7E57C2] border border-[#7E57C2]/30 rounded hover:bg-[#7E57C2]/10 transition-colors tracking-wider">
              RETRY
            </button>
          </div>
        </div>
      ) : streamType === 'hls' ? (
        <video
          ref={videoRef}
          className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
          autoPlay
          muted
          playsInline
        />
      ) : streamType === 'mjpeg' && camera.stream_url ? (
        <img
          src={camera.stream_url}
          alt={camera.name}
          className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
      ) : streamType === 'mp4' && camera.stream_url ? (
        <video
          src={camera.stream_url}
          className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
          autoPlay
          muted
          playsInline
          loop
        />
      ) : streamType === 'iframe' && streamUrl ? (
        <iframe
          src={streamUrl}
          className="w-full h-full border-0"
          allow="autoplay; contain"
          allowFullScreen
        />
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt={camera.name}
          className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
        />
      ) : null}

      {/* Live indicator */}
      {!error && !loading && !externalOnly && (
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/80 border border-[var(--gold-primary)]/50 px-2 py-1 shadow-[0_0_10px_rgba(0,0,0,0.8)]">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
          <span className="text-[9px] font-mono text-white tracking-[0.2em]">
            {watchLiveUrl ? 'SNAPSHOT' : streamType === 'jpg' ? 'LIVE SAT-LINK' : 'LIVE FEED'}
          </span>
        </div>
      )}

      {/* Live video is on the operator's own page; this is the way to it. */}
      {watchLiveUrl && !error && !externalOnly && (
        <a
          href={watchLiveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-sm border text-[10px] font-mono font-bold tracking-widest transition-all hover:bg-[var(--gold-primary)]/25"
          style={{ borderColor: 'var(--gold-primary)', color: 'var(--gold-primary)', background: 'rgba(0,0,0,0.75)' }}
          title="Live video is hosted by the camera operator — opens their page"
        >
          <PlayCircle className="w-3 h-3" /> WATCH LIVE
        </a>
      )}
    </>
  );
}
