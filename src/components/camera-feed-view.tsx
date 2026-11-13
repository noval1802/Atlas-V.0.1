'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, ExternalLink, PlayCircle } from 'lucide-react';
import Hls from 'hls.js';
import { isHostedOffPlatform, liveFeedAtSource, localEmbed, needsResolution, offPlatformView } from '@/lib/camera-feed';
import type { WatchedCamera } from '@/lib/dashboard-state';
import { BUFFERING_BADGE_MS, STALL_MS, START_TIMEOUT_MS, nextRetryDelay } from '@/lib/stream-recovery';

/** Playback state for one camera. Shared by the map's CameraViewer and the SPACE grid, so both play every feed type the same way. */
export function useCameraFeed(camera: WatchedCamera | null) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  /** An automatic reconnect is pending. */
  const [reconnecting, setReconnecting] = useState(false);
  /** The live video has been waiting for data long enough to say so. */
  const [buffering, setBuffering] = useState(false);
  const autoRetries = useRef(0);
  /** This camera has shown video at least once, across reconnects. */
  const everPlayed = useRef(false);
  const lastCameraKey = useRef<unknown>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const flvRef = useRef<{ destroy: () => void } | null>(null);

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
    setBuffering(false);
    // A new camera starts with a fresh reconnect budget; a reconnect of the same one does not.
    const cameraKey = camera.id ?? camera.stream_url;
    if (lastCameraKey.current !== cameraKey) {
      lastCameraKey.current = cameraKey;
      autoRetries.current = 0;
      everPlayed.current = false;
      setReconnecting(false);
    }

    /* Every branch hands back this teardown, so closing the viewer, swapping a
       SPACE tile or retrying stops the old stream instead of leaving it
       downloading in the background. */
    let cancelled = false;
    let nativeVideo: HTMLVideoElement | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stallTimer: ReturnType<typeof setTimeout> | undefined;
    let badgeTimer: ReturnType<typeof setTimeout> | undefined;
    let startTimer: ReturnType<typeof setTimeout> | undefined;
    let jumpedToLive = false;
    let hasPlayed = false;
    let watched: HTMLVideoElement | null = null;

    /* Reconnect by rebuilding the player after a short wait; the error screen
       only appears once every automatic attempt has failed. */
    const reconnect = () => {
      if (cancelled || retryTimer) return;
      clearTimeout(startTimer);
      // A stream that never showed a frame gets one more try, not the full budget.
      const delay = !everPlayed.current && autoRetries.current >= 1 ? null : nextRetryDelay(autoRetries.current);
      if (delay === null) {
        setReconnecting(false);
        setError(true);
        return;
      }
      setReconnecting(true);
      retryTimer = setTimeout(() => {
        autoRetries.current += 1;
        setRetryCount(c => c + 1);
      }, delay);
    };

    /* A live stream that waits too long: first jump to the live edge (the
       segments behind it may simply have been slow), then reconnect. */
    const onStall = () => {
      stallTimer = undefined;
      const video = watched;
      const edge = hlsRef.current?.liveSyncPosition;
      if (video && !jumpedToLive && typeof edge === 'number' && edge - video.currentTime > 1) {
        jumpedToLive = true;
        video.currentTime = edge;
        stallTimer = setTimeout(onStall, STALL_MS);
        return;
      }
      reconnect();
    };
    const onWaiting = () => {
      // Before the first frame, a slow source is still starting; hls.js's own timeouts cover a dead one.
      if (!hasPlayed) return;
      stallTimer ??= setTimeout(onStall, STALL_MS);
      badgeTimer ??= setTimeout(() => setBuffering(true), BUFFERING_BADGE_MS);
    };
    const onPlaying = () => {
      clearTimeout(stallTimer);
      clearTimeout(badgeTimer);
      stallTimer = badgeTimer = undefined;
      clearTimeout(startTimer);
      jumpedToLive = false;
      hasPlayed = true;
      everPlayed.current = true;
      autoRetries.current = 0;
      setLoading(false);
      setBuffering(false);
      setReconnecting(false);
    };
    // First frame decoded: drop the overlay even if autoplay was refused and 'playing' never comes.
    const onFirstFrame = () => setLoading(false);
    const watch = (video: HTMLVideoElement) => {
      watched = video;
      startTimer = setTimeout(() => { if (!hasPlayed && video.readyState < 2) reconnect(); }, START_TIMEOUT_MS);
      video.addEventListener('loadeddata', onFirstFrame);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('stalled', onWaiting);
      video.addEventListener('playing', onPlaying);
    };

    const teardown = () => {
      cancelled = true;
      clearTimeout(retryTimer);
      clearTimeout(stallTimer);
      clearTimeout(badgeTimer);
      clearTimeout(startTimer);
      if (watched) {
        watched.removeEventListener('loadeddata', onFirstFrame);
        watched.removeEventListener('waiting', onWaiting);
        watched.removeEventListener('stalled', onWaiting);
        watched.removeEventListener('playing', onPlaying);
      }
      hlsRef.current?.destroy();
      hlsRef.current = null;
      flvRef.current?.destroy();
      flvRef.current = null;
      if (nativeVideo) {
        nativeVideo.removeAttribute('src');
        nativeVideo.load();
      }
    };

    if (externalOnly) {
      setLoading(false);
      return teardown;
    }

    if (streamType === 'hls' && camera.stream_url) {
      if (Hls.isSupported() && videoRef.current) {
        // Live feed: keep ~10s behind the playhead, not the whole session (hls.js default is Infinity).
        const hls = new Hls({ enableWorker: false, backBufferLength: 10 });
        hlsRef.current = hls;
        hls.loadSource(camera.stream_url);
        hls.attachMedia(videoRef.current);
        // The loading overlay stays until the first frame ('playing'), not just the playlist.
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoRef.current?.play().catch(() => {});
        });
        watch(videoRef.current);
        let mediaRecovered = false;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return; // hls.js retries non-fatal network errors itself
          // A decode error is usually recoverable in place once; anything else rebuilds the player.
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecovered) {
            mediaRecovered = true;
            hls.recoverMediaError();
            return;
          }
          reconnect();
        });
      } else if (videoRef.current?.canPlayType('application/vnd.apple.mpegurl')) {
        nativeVideo = videoRef.current;
        watch(nativeVideo);
        nativeVideo.addEventListener('error', reconnect, { once: true });
        nativeVideo.src = camera.stream_url;
        nativeVideo.addEventListener('loadedmetadata', () => {
          videoRef.current?.play().catch(() => {});
        }, { once: true });
      }
      return teardown;
    }

    // HTTP-FLV (e.g. Surakarta): no browser plays FLV natively, so mpegts.js is
    // loaded only when an FLV camera is actually opened.
    if (streamType === 'flv' && camera.stream_url) {
      const url = camera.stream_url;
      import('mpegts.js').then(({ default: mpegts }) => {
        if (cancelled || !videoRef.current || !mpegts.isSupported()) { if (!cancelled) setError(true); return; }
        watch(videoRef.current);
        const player = mpegts.createPlayer(
          { type: 'flv', url, isLive: true, cors: true },
          // Off by default in mpegts.js; without it a live tile buffers the whole session.
          { autoCleanupSourceBuffer: true, autoCleanupMaxBackwardDuration: 30, autoCleanupMinBackwardDuration: 10 },
        );
        flvRef.current = player;
        player.attachMediaElement(videoRef.current);
        player.on(mpegts.Events.ERROR, reconnect);
        player.load();
        videoRef.current.play().catch(() => {});
      }).catch(() => { if (!cancelled) reconnect(); });
      return teardown;
    }

    if (streamType === 'mjpeg' && camera.stream_url) {
      setLoading(false);
      return teardown;
    }

    if ((streamType === 'iframe' || streamType === 'mp4') && streamUrl) {
      setLoading(false);
      return teardown;
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
    return teardown;
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

  /** The operator's own retry: a fresh set of automatic attempts. */
  const retry = () => {
    autoRetries.current = 0;
    setError(false);
    setRetryCount(c => c + 1);
  };

  return {
    camera, imageUrl, setImageUrl, loading, setLoading, error, setError, retry, videoRef,
    externalFeedUrl, view, externalOnly, streamType, streamUrl, resolvedEmbed, watchLiveUrl, gone,
    reconnecting, buffering,
  };
}

export type CameraFeed = ReturnType<typeof useCameraFeed>;

/** The picture: player plus loading, offline, external and error states. Fills its positioned parent. */
export function CameraFeedView({ feed, contain = false }: { feed: CameraFeed; contain?: boolean }) {
  const {
    camera, imageUrl, loading, setLoading, error, setError, retry, videoRef,
    externalFeedUrl, view, externalOnly, streamType, streamUrl, watchLiveUrl, gone,
    reconnecting, buffering,
  } = feed;
  if (!camera) return null;
  return (
    <>
      {loading && !error && !externalOnly && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-30 backdrop-blur-sm">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: 'var(--gold-dim)', borderTopColor: 'transparent' }} />
            <span className="text-[10px] font-mono tracking-[0.25em]" style={{ color: 'var(--gold-primary)' }}>
              {reconnecting ? 'MENYAMBUNG ULANG…' : 'MEMUAT VIDEO…'}
            </span>
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
            <span className="text-[10px] font-mono text-red-400 tracking-widest block mb-1">KAMERA TIDAK DAPAT DIPUTAR</span>
            <span className="text-[9px] font-mono text-[var(--text-muted)]">Sumber mati atau terlalu lambat</span>
            <button onClick={retry} className="block mx-auto mt-3 px-3 py-1 text-[9px] font-mono text-[#7E57C2] border border-[#7E57C2]/30 rounded hover:bg-[#7E57C2]/10 transition-colors tracking-wider">
              COBA LAGI
            </button>
          </div>
        </div>
      ) : streamType === 'hls' || streamType === 'flv' ? (
        <>
        {buffering && !loading && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1" role="status">
            <div className="w-2.5 h-2.5 border border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--gold-primary)', borderTopColor: 'transparent' }} />
            <span className="text-[9px] font-mono tracking-wider" style={{ color: 'var(--gold-primary)' }}>MENYANGGA · SUMBER LAMBAT</span>
          </div>
        )}
        <video
          ref={videoRef}
          className={`w-full h-full ${contain ? 'object-contain' : 'object-cover'}`}
          autoPlay
          muted
          playsInline
        />
        </>
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
          // Camera pages come from feed data: let the player run, but not navigate the top window or open popups.
          sandbox="allow-scripts allow-same-origin allow-presentation"
          // Not no-referrer: YouTube refuses embeds without a Referer (player error 153).
          referrerPolicy="strict-origin-when-cross-origin"
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
