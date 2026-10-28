'use client';

import { buildGeometry, closeRing, drawReducer, initialDrawState, measure, type DrawAction, type DrawMode, type DrawProgress, type DrawResult, type DrawState } from '@/lib/draw';
import { useEffect, useRef, useState, useCallback, memo } from 'react';
import * as maplibregl from 'maplibre-gl';
import { installTerrainTileProtocol } from '@/lib/terrain-tiles';
import { createSatelliteLayer, parseColor, SAT_MAX_ZOOM, type SatPoint } from '@/lib/satellite-layer';
import { MAP_DEFAULTS, MAP_PALETTE_KEYS, readMapPalette, satColorFor, type MapPalette } from '@/lib/map-palette';
import { STYLE_EVENT } from '@/lib/style-tokens';
import { ALERT_KINDS, timeAgo, type AlertKind } from '@/lib/alert-digest';
import SatelliteCard, { type SatelliteDetail } from '@/components/SatelliteCard';
import CctvPreviews, { type PreviewCamera } from '@/components/CctvPreviews';
import MapControls from '@/components/MapControls';
import LiveNewsPreviews, { type PreviewFeed } from '@/components/LiveNewsPreviews';
import { attachTerrain, type TerrainStatus } from '@/lib/map-terrain';
import { isJasaMargaCamera, isTptCamera } from '@/lib/cctv-layers';
import type { CatalogCamera } from '@/lib/camera-catalog';
import { MATRA_LAYER, kotamaopsFeatures, kotamaopsIconId, safeKotamaopsLogo } from '@/lib/kotamaops-points';
import { NKRI_CENTER } from '@/lib/nkri-view';
import { tileRequestUrl } from '@/lib/tile-proxy';
import { CAMERA_ICON_ID, cameraGlyph, cameraIconData, loadCameraGlyph } from '@/lib/camera-icon';
import { KARHUTLA_LAPSIT_AT, formatKarhutlaAmount, formatPersonel, karhutlaReport } from '@/lib/karhutla-lapsit';
import { KOTAMAOPS_FLAME_CODES, KOTAMAOPS_FLAME_FRAMES, KOTAMAOPS_FLAME_FRAME_MS, KOTAMAOPS_FLAME_HEIGHT, KOTAMAOPS_FLAME_WIDTH, drawKotamaopsFlame, kotamaopsFlameImageId, nextKotamaopsFlameFrame } from '@/lib/kotamaops-flame';
import type { ArcGisMapLayer, MapEntity } from '@/lib/dashboard-state';
import type { ActiveLayers } from '@/lib/layer-feeds';
import { type AlertPinReport, type FlightRow, type MapData, type SatellitePoint } from '@/lib/map-data';
import {
  clickedProperties, pointCoordinates,
  type BalloonPopup, type CameraPopup, type ChokePopup,
  type EarthquakePopup, type FirePopup, type FlightPopup,
  type GdeltEventPopup, type IncidentPopup, type KotamaopsPopup, type NewsPopup,
  type PortPopup, type RadiationPopup,
  type ShipPopup, type WeatherPopup,
  htmlEsc,
  urlSafe,
} from '@/lib/map-popup';
import { applyBasemapTone } from '@/lib/basemap-tone';
import { applyMapProjection } from '@/lib/map-projection';
import { computeSolarTerminator } from '@/lib/solar-terminator';
import 'maplibre-gl/dist/maplibre-gl.css';

type SatelliteRow = SatellitePoint;

interface OsirisWindow extends Window {
  _globeSpinTimer?: number;
  __osirisMap?: maplibregl.Map;
}

/** A GeoJSON feature loose enough for every layer writer. MapLibre receives it once, inside setGeo. */
interface MapFeature {
  type: string;
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: object | null;
  id?: string | number;
}

interface OsirisMapProps {
  data: MapData;
  activeLayers: ActiveLayers;
  onEntityClick?: (entity: MapEntity) => void;
  onMouseCoords?: (coords: { lat: number; lng: number }) => void;
  onRightClick?: (coords: { lat: number; lng: number }) => void;
  onViewStateChange?: (vs: { zoom: number; latitude: number }) => void;
  /** `alertId` also opens that Live Alert's pin once the camera arrives.
   *  `duration` overrides the default 2 s flight. */
  flyToLocation?: { lat: number; lng: number; zoom?: number; alertId?: string; duration?: number; ts: number } | null;
  /** Fires once, when the map has drawn its first complete frame. */
  onReady?: () => void;
  /** Which Live Alerts to pin — the reports the feed is showing. Null pins them all. */
  alertPinIds?: string[] | null;
  projection?: 'mercator' | 'globe';
  terrainEnabled?: boolean;
  terrainRetry?: number;
  terrainFocus?: number;
  onTerrainStatusChange?: (status: TerrainStatus) => void;

  mapStyle?: string;
  demoMode?: boolean;
  theme?: 'core' | 'ghost';
  drawnPolygons?: Array<{ id: string; name: string; geojson: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.LineString>; color: string }>;
  arcgisLayers?: ArcGisMapLayer[];
  /** Active draw mode, or null when not drawing. */
  drawMode?: DrawMode | null;
  onDrawProgress?: (p: DrawProgress | null) => void;
  onDrawCancel?: () => void;
  /**
   * Undo / finish / cancel driven from a button rather than the keyboard.
   * Carries a seq so pressing the same button twice still registers.
   */
  drawCommand?: { action: DrawAction["type"]; seq: number } | null;
  onDrawComplete?: (result: DrawResult) => void;
  onMapCenter?: (coords: { lat: number; lng: number; bounds?: { west: number; south: number; east: number; north: number } }) => void;
  /** Active turn-by-turn route drawn as a line with origin/destination pins. */
  route?: {
    geometry: { type: 'LineString'; coordinates: [number, number][] };
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    /** Unselected alternatives, drawn dimmed behind the active line. */
    alternates?: Array<{ type: 'LineString'; coordinates: [number, number][] }>;
    /** Highlighted portion for the step the operator has selected. */
    activeSegment?: [number, number][] | null;
  } | null;
  /** Live position from the browser — drawn as a pulsing dot with accuracy ring. */
  userLocation?: { lat: number; lng: number; accuracy?: number; heading?: number | null } | null;
  /** Keep the camera centred on userLocation as it moves. */
  followUser?: boolean;
  /** Fired when the operator pans/zooms/rotates while follow mode is on. */
  onFollowInterrupt?: () => void;
  /** Live navigation: tighter zoom and the map turned to face travel direction. */
  navigating?: boolean;
  /** Corroborated endpoint airports for watched aircraft, keyed by icao24. */
  aircraftAirports?: Record<string, Array<{ icao: string; iata?: string; city?: string; lat: number; lng: number }>>;
  /** Path of the nginx basemap cache (e.g. /proxy/tiles); null keeps the /api/proxy-tiles route. Read once, when the map is created. */
  tileProxy?: string | null;
}


const EMPTY_FC = { type: 'FeatureCollection' as const, features: [] };

/** A colour, or an expression for one, as addLayer takes it. */
type LayerColor = NonNullable<Extract<Parameters<maplibregl.Map['addLayer']>[0], { type: 'circle' }>['paint']>['circle-color'];

/** A Live Alerts report as /api/news sends it — only the fields a pin reads. */
type PinnedReport = AlertPinReport;

/** A report posted this recently gets the pulsing ring. */
const ALERT_FRESH_MS = 15 * 60_000;

/** Two right-clicks count as one double right-click this close in time… */
const DOUBLE_RIGHT_MS = 500;
/** …and this close on screen, so a second click elsewhere starts afresh. */
const DOUBLE_RIGHT_SLOP_PX = 12;

/** What a pin carries: flat, as map feature properties must be. */
interface AlertPinProps {
  id: string;
  kind: AlertKind;
  /** Reports pinned to this same place, this one included. */
  stack: number;
  /** Posted in the last quarter of an hour. */
  fresh: boolean;
  title: string;
  source_name: string;
  lean: string;
  published: string;
  link: string;
  place_name: string;
  place_label: string;
  precision: string;
  media_kind: string;
  video: string;
  thumb: string;
  duration: string;
}

interface AlertPinFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: AlertPinProps;
}

function OsirisMap({ data, activeLayers, onEntityClick, onMouseCoords, onRightClick, onViewStateChange, onReady, flyToLocation, alertPinIds = null, projection = 'globe', terrainEnabled = false, terrainRetry = 0, terrainFocus = 0, onTerrainStatusChange, mapStyle = 'dark', demoMode = false, theme = 'core', drawnPolygons = [], arcgisLayers = [], drawMode = null, onDrawComplete, onDrawProgress, onDrawCancel, drawCommand = null, onMapCenter, route = null, userLocation = null, followUser = false, onFollowInterrupt, navigating = false, aircraftAirports = {}, tileProxy = null }: OsirisMapProps) {
  const tileProxyRef = useRef(tileProxy);
  /* The logo resolver lives in the map-init effect; it reads the latest Kotamaops from here. */
  const kotamaopsRef = useRef(data.kotamaops ?? []);
  useEffect(() => {
    kotamaopsRef.current = data.kotamaops ?? [];
  }, [data.kotamaops]);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  /* The Live Alert pins currently drawn, and the opener for one of them, so
     the feed's locate button can land on a pin and open it. */
  const alertPinsRef = useRef<AlertPinFeature[]>([]);
  const openAlertPinRef = useRef<((id: string) => void) | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Do not replay an earlier explicit zoom request after theme/retry remounts.
  const lastTerrainFocus = useRef(terrainFocus);
  const wasNavigating = useRef(false);
  /**
   * What the map's own layers draw with, mirrored out of the `--map-*` custom
   * properties. Held in state rather than read at each use so a change re-runs
   * the recolour effects; held in a ref as well for the click handlers, which
   * are registered once on load and would otherwise close over the first value.
   */
  const [palette, setPalette] = useState<MapPalette>(MAP_DEFAULTS);
  const paletteRef = useRef(palette);
  useEffect(() => { paletteRef.current = palette; }, [palette]);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  const prevDrawnPolygonsRef = useRef<string[]>([]);
  const prevArcgisLayersRef = useRef<string[]>([]);
  const satLayerRef = useRef<ReturnType<typeof createSatelliteLayer> | null>(null);
  // pick() returns an index into the array last handed to setPoints, so the
  // matching catalogue rows are kept in the same order to resolve it.
  const satRowsRef = useRef<SatelliteRow[]>([]);
  /** Index of the selected satellite in the array last handed to setPoints. */
  const satPickedRef = useRef<number | null>(null);
  /** The selection's NORAD id. The index moves whenever the catalogue is
   *  re-polled and re-filtered; the id does not, so it is what identifies the
   *  selection across a refresh and what discards a late orbit reply. */
  const satSelectedIdRef = useRef<string | null>(null);
  /** When the catalogue positions were propagated for, so an orbit can be drawn
   *  around the marker rather than around the moment it was clicked. */
  const satEpochRef = useRef<number | null>(null);
  const [selectedSat, setSelectedSat] = useState<SatelliteDetail | null>(null);

  /** Drops the selection: the ring, the orbit track and the readout together.
   *  Leaving any one of them behind is what made a closed popup look like a
   *  still-selected satellite. */
  const clearSat = useCallback(() => {
    if (satPickedRef.current === null && satSelectedIdRef.current === null) return;
    satPickedRef.current = null;
    satSelectedIdRef.current = null;
    satLayerRef.current?.setSelected(null);
    satLayerRef.current?.setOrbit(null);
    setSelectedSat(null);
  }, []);
  const drawingCoordsRef = useRef<number[][]>([]);
  const cameraColorRef = useRef('');

  /* Draws (or redraws) the CCTV marker. Shows the fallback dot until the SVG arrives, then swaps it in with the latest colour. */
  const setCameraIcon = useCallback((map: maplibregl.Map, color: string) => {
    cameraColorRef.current = color;
    const draw = (image?: HTMLImageElement) => {
      const data = cameraIconData(cameraColorRef.current, image);
      if (map.hasImage(CAMERA_ICON_ID)) map.updateImage(CAMERA_ICON_ID, data);
      else map.addImage(CAMERA_ICON_ID, data, { pixelRatio: 2 });
    };
    draw(cameraGlyph());
    if (!cameraGlyph()) {
      loadCameraGlyph().then(
        (image) => {
          try { draw(image); } catch { /* map was removed before the icon loaded */ }
        },
        (error) => console.warn('[OSIRIS]', error.message),
      );
    }
  }, []);

  // Create aircraft icon on canvas (for WebGL symbol layer)
  const createIcon = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const cx = size / 2, cy = size / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.4);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx, cy + size * 0.35);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
    ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
    ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
    ctx.closePath();
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  const createDot = useCallback((map: maplibregl.Map, id: string, color: string, size: number) => {
    if (map.hasImage(id)) return;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 1, 0, Math.PI * 2);
    ctx.fill();
    map.addImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // ── DEMO MODE SPINNING ──
    let spinReq: number | undefined = undefined;
    let isSpinning = false;
    
    const startSpinning = () => {
      if (!map) return;
      isSpinning = true;
      let lastTime = performance.now();
      
      const frame = (time: number) => {
        if (!isSpinning) return;
        
        // Only spin if the user is not actively dragging or zooming the map
        if (!map.isMoving() && !map.isZooming()) {
          const dt = time - lastTime;
          const center = map.getCenter();
          // Adjust spin speed: 0.5 degrees per second
          center.lng += (0.5 * dt) / 1000;
          map.setCenter(center);
        }
        
        lastTime = time;
        spinReq = requestAnimationFrame(frame);
      };
      
      spinReq = requestAnimationFrame(frame);
    };

    if (demoMode) {
      startSpinning();
    } else {
      isSpinning = false;
      if (spinReq) cancelAnimationFrame(spinReq);
    }

    return () => {
      isSpinning = false;
      if (spinReq) cancelAnimationFrame(spinReq);
      if (typeof window !== 'undefined' && (window as OsirisWindow)._globeSpinTimer) {
        clearInterval((window as OsirisWindow)._globeSpinTimer);
      }
    };
  }, [mapReady, demoMode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let logosAlive = true;
    let flameTimer = 0;
    
    // Select basemap style
    const styleUrl = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

    const container = containerRef.current;
    maplibregl.setWorkerUrl(`/vendor/maplibre/${maplibregl.getVersion()}/maplibre-gl-worker.mjs`);
    /* Open on the whole globe turned to Indonesia, so the post-splash fly-in to NKRI is a dive, not a spin. */
    const baseOptions = {
      container,
      style: styleUrl,
      center: [NKRI_CENTER.lng, NKRI_CENTER.lat] as [number, number], zoom: 1.8, minZoom: 1.5, maxZoom: 18,
      /* The basemap is CARTO's, drawn from OpenStreetMap, and the places on it
         are searched and named through OpenStreetMap too. Both have to be
         credited on the map itself; this was switched off, which is half of
         what Nominatim's operators asked us to put right (issue #16). It is
         collapsed by default so it costs a corner icon, not the view. */
      attributionControl: {
        compact: true,
        // The style credits CARTO and OSM for the map; this credits OSM for the
        // search results, place names and pins that come from Nominatim.
        customAttribution: 'Geocoding © OpenStreetMap contributors',
      },
      maxPitch: 85,
      transformRequest: (url: string) => {
        // CARTO requests go through our own proxy: the nginx tile cache when configured, else /api/proxy-tiles.
        const proxied = tileRequestUrl(url, window.location.origin, tileProxyRef.current);
        return proxied === url ? { url } : { url: proxied, credentials: 'same-origin' as const };
      },
    };

    // MapLibre asks for a high-performance WebGL2 context and throws outright if it
    // cannot get one. Some machines refuse that exact request while still granting a
    // plainer one, so walk down to weaker requests before giving up. The WebGL1 rung
    // this used to have cannot come back: MapLibre 6's ContextType is 'webgl2' alone,
    // so machines that only ever managed WebGL1 are now out of reach either way.
    // Dropping antialias is the last rung left for a struggling GPU.
    const attributeFallbacks: maplibregl.MapOptions['canvasContextAttributes'][] = [
      undefined,
      { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false },
      { powerPreference: 'low-power', failIfMajorPerformanceCaveat: false, antialias: false },
    ];

    let map: maplibregl.Map | undefined;
    for (const canvasContextAttributes of attributeFallbacks) {
      try {
        map = new maplibregl.Map(
          canvasContextAttributes ? { ...baseOptions, canvasContextAttributes } : baseOptions
        );
        break;
      } catch (e) {
        // A failed constructor leaves its canvas behind; the next attempt needs a clean container.
        container.innerHTML = '';
        if (canvasContextAttributes === attributeFallbacks[attributeFallbacks.length - 1]) throw e;
        console.warn('[OSIRIS] WebGL context rejected, retrying with weaker attributes:', e instanceof Error ? e.message : e);
      }
    }
    if (!map) return;

    map.on('load', () => {
      mapRef.current = map;

      /* Measure the container once the layout has settled. The constructor
         may have read it before it had a size, and a map that starts at the
         400x300 fallback never recovers on its own. */
      map.resize();
      applyBasemapTone(map);

      // Theme colors
      const isGhost = theme === 'ghost';
      const phantomPurple = '#B388FF';
      const phantomDark = '#1A0040';
      /* The first paint reads the same `--map-*` properties the recolour
         effects below push in later. Deriving them from `theme` here as well
         is what let the two drift: the effect's ghost palette was four
         distinct violets, this block's was one, and whichever ran last won. */
      const bootStyle = getComputedStyle(document.body);
      const boot = readMapPalette(name => bootStyle.getPropertyValue(name));
      const cameraColor = boot.cctv;
      const flightCom = boot.flightCivil;
      const flightPriv = boot.flightPrivate;
      const flightGov = boot.flightGov;
      const flightMil = boot.flightMilitary;

      // Create icons — OSIRIS Unified Palette
      createIcon(map, 'plane-cyan', flightCom, 24);   
      createIcon(map, 'plane-green', flightPriv, 24);   
      createIcon(map, 'plane-pink', flightGov, 24);    
      createIcon(map, 'plane-red', flightMil, 24);     
      createIcon(map, 'plane-grey', boot.flightUnknown, 24);
      createDot(map, 'dot-gold', isGhost ? phantomPurple : '#D4AF37', 8);
      createDot(map, 'dot-red', isGhost ? phantomPurple : '#D32F2F', 10);
      createDot(map, 'dot-orange', isGhost ? phantomPurple : '#E65100', 10);
      createDot(map, 'dot-green', isGhost ? phantomPurple : '#26A69A', 10);
      createDot(map, 'dot-fire', isGhost ? phantomPurple : '#E65100', 10);
      createDot(map, 'dot-cctv', cameraColor, 10);

      const sources = ['flights','military','jets','private-fl','satellites','earthquakes','gdelt','day-night','cctv','cctv-jm','cctv-jakarta','fires','weather','maritime','maritime-choke','maritime-ships','live-news', 'war-alerts-targets', 'war-alerts-lines', 'balloons', 'radiation', 'gdelt-events', 'alert-pins', 'kotamaops'];
      // Camera sources cluster so dense cities (Jakarta, Bandung) collapse to a
      // count below zoom 12 instead of a pile of overlapping icons. Clustering
      // stops below the preview zoom (13), so individual cameras are intact when
      // previews open.
      const CLUSTERED = new Set(['cctv', 'cctv-jm', 'cctv-jakarta']);
      sources.forEach(s => map.addSource(s, CLUSTERED.has(s)
        ? { type: 'geojson', data: EMPTY_FC, cluster: true, clusterRadius: 50, clusterMaxZoom: 12 }
        : { type: 'geojson', data: EMPTY_FC }));

      // ── FLIGHT ROUTE VISUALIZATION SOURCES & LAYERS ──

      // Warning icon generator (parameterized — eliminates 3x copy-paste)
      const createWarningIcon = (id: string, color: string) => {
        const s = 20;
        const c = document.createElement('canvas');
        c.width = s; c.height = s;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(s/2, 1);
        ctx.lineTo(s - 1, s - 1);
        ctx.lineTo(1, s - 1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('!', s/2, s - 4);
        map.addImage(id, { width: s, height: s, data: new Uint8Array(ctx.getImageData(0, 0, s, s).data) });
      };
      createWarningIcon('warn-icon', '#D32F2F');
      createWarningIcon('warn-orange', '#E65100');
      createWarningIcon('warn-yellow', '#F9A825');

      map.addLayer({ id: 'day-night-fill', type: 'fill', source: 'day-night', paint: { 'fill-color': isGhost ? '#0D0030' : '#000022', 'fill-opacity': 0.35 }});

      // Earthquakes — amber threat spectrum
      map.addLayer({ id: 'eq-circles', type: 'circle', source: 'earthquakes', paint: {
        'circle-radius': ['interpolate',['linear'],['get','magnitude'], 2.5,4, 5,12, 7,24],
        'circle-color': ['interpolate',['linear'],['get','magnitude'], 2.5,'#F9A825', 4,'#E65100', 6,'#D32F2F'],
        'circle-opacity': 0.55, 'circle-blur': 0.3, 'circle-stroke-width': 1, 'circle-stroke-color': '#F9A825', 'circle-stroke-opacity': 0.25,
      }});
      map.addLayer({ id: 'eq-label', type: 'symbol', source: 'earthquakes', filter: ['>=',['get','magnitude'],4.5], layout: {
        'text-field': ['concat','M',['to-string',['get','magnitude']]], 'text-size': 9, 'text-font': ['Open Sans Regular'], 'text-offset': [0,1.5],
      }, paint: { 'text-color': '#F9A825', 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Fires — burnt sienna
      map.addLayer({ id: 'fires-heat', type: 'circle', source: 'fires', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,8],
        'circle-color': '#E65100', 'circle-opacity': 0.45, 'circle-blur': 0.5,
      }});

      setCameraIcon(map, cameraColor);
      // CCTV and CCTV JM share the paint. The JM source is a separate toggle.
      const addCameraLayers = (prefix: string, source: string) => {
        const single: maplibregl.FilterSpecification = ['!', ['has', 'point_count']];
        map.addLayer({ id: `${prefix}-glow`, type: 'circle', source, filter: single, paint: {
          'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14, 14,20],
          'circle-color': '#000000', 'circle-opacity': 0.35, 'circle-blur': 1,
        }});
        map.addLayer({ id: `${prefix}-dots`, type: 'symbol', source, filter: single, layout: {
          'icon-image': CAMERA_ICON_ID,
          'icon-size': ['interpolate',['linear'],['zoom'], 1,0.5, 5,0.7, 10,0.95, 14,1.25],
          'icon-allow-overlap': true, 'icon-ignore-placement': true,
        }});
        map.addLayer({ id: `${prefix}-label`, type: 'symbol', source, minzoom: 10, filter: single, layout: {
          'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
          'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
        }, paint: { 'text-color': cameraColor, 'text-halo-color': '#000000', 'text-halo-width': 1.5, 'text-opacity': 0.8 }});
        // Clustered: a count bubble that expands on click (see cluster handlers below).
        map.addLayer({ id: `${prefix}-cluster`, type: 'circle', source, filter: ['has', 'point_count'], paint: {
          'circle-color': cameraColor, 'circle-opacity': 0.2,
          'circle-radius': ['step', ['get', 'point_count'], 12, 50, 16, 200, 22],
          'circle-stroke-width': 1.5, 'circle-stroke-color': cameraColor, 'circle-stroke-opacity': 0.8,
        }});
        map.addLayer({ id: `${prefix}-cluster-count`, type: 'symbol', source, filter: ['has', 'point_count'], layout: {
          'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11, 'text-font': ['Open Sans Regular'],
        }, paint: { 'text-color': cameraColor, 'text-halo-color': '#000000', 'text-halo-width': 1 }});
      };
      addCameraLayers('cctv', 'cctv');
      addCameraLayers('cctv-jm', 'cctv-jm');
      addCameraLayers('cctv-jakarta', 'cctv-jakarta');

      map.addLayer({ id: 'gdelt-dots', type: 'circle', source: 'gdelt', paint: {
        'circle-radius': 4, 'circle-color': '#D32F2F', 'circle-opacity': 0.5, 'circle-stroke-width': 1, 'circle-stroke-color': '#D32F2F', 'circle-stroke-opacity': 0.25,
      }});

      /* ── GDELT 2.0 Events — coloured by CAMEO QuadClass so cooperation and
         conflict are separable at a glance, sized by article volume. ── */
      map.addLayer({ id: 'gdelt-events-dots', type: 'circle', source: 'gdelt-events', paint: {
        'circle-radius': ['interpolate',['linear'],['get','articles'], 1,3, 10,5, 50,8, 200,12],
        'circle-color': ['match',['get','quad'],
          1,'#00E676',   // verbal cooperation
          2,'#00E5FF',   // material cooperation
          3,'#FF9500',   // verbal conflict
          4,'#FF3D3D',   // material conflict
          '#9B978E'],
        'circle-opacity': 0.75,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#000000',
        'circle-stroke-opacity': 0.6,
      }});

      // Weather Events (NASA EONET) — deep violet
      map.addLayer({ id: 'weather-glow', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,12, 5,20, 10,30],
        'circle-color': '#7E57C2', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'weather-dots', type: 'circle', source: 'weather', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,5, 5,8, 10,14],
        'circle-color': ['match', ['get','icon'], 'cyclone','#7E57C2', 'volcano','#D32F2F', '#7E57C2'],
        'circle-opacity': 0.75,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#7E57C2', 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'weather-label', type: 'symbol', source: 'weather', layout: {
        'text-field': ['get','title'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#7E57C2', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // Satellites.
      // Every satellite is drawn once, by the custom 3D layer below, at its
      // altitude. These two circle layers are kept defined — the source feeds
      // the 3D layer and other code refers to them — but hidden: drawing the
      // same satellite both flat on the ground and again up at altitude is
      // what made the map read as half 2D and half 3D.
      // Hit-testing is handled by the 3D layer's own GPU pick pass, since
      // queryRenderedFeatures cannot see into a custom WebGL layer.
      map.addLayer({ id: 'sat-glow', type: 'circle', source: 'satellites', layout: { visibility: 'none' }, paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,6], 'circle-color': ['get','color'], 'circle-opacity': 0.3, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'sat-dots', type: 'circle', source: 'satellites', layout: { visibility: 'none' }, paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,1.5, 5,3], 'circle-color': ['get','color'], 'circle-opacity': 1.0,
      }});
      // The spacecraft themselves, lifted to their orbit.
      if (!map.getLayer('sat-3d')) {
        satLayerRef.current = createSatelliteLayer('sat-3d');
        map.addLayer(satLayerRef.current);
      }

      // Maritime — ports & naval bases — ocean teal
      map.addLayer({ id: 'maritime-glow', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,6, 5,12, 10,20],
        'circle-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'],
        'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'maritime-dots', type: 'circle', source: 'maritime', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,9],
        'circle-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1.5, 'circle-stroke-color': ['match', ['get','type'], 'naval','#D32F2F', 'energy','#E65100', '#26C6DA'], 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'maritime-label', type: 'symbol', source: 'maritime', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#26C6DA', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.7 }});

      // Maritime chokepoints — amber threat spectrum
      map.addLayer({ id: 'choke-glow', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,18, 10,28],
        'circle-color': '#E65100', 'circle-opacity': 0.1, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'choke-dots', type: 'circle', source: 'maritime-choke', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,7, 10,12],
        'circle-color': ['match', ['get','risk'], 'CRITICAL','#D32F2F', 'HIGH','#E65100', 'ELEVATED','#F9A825', '#26A69A'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#E65100', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'choke-label', type: 'symbol', source: 'maritime-choke', minzoom: 3, layout: {
        'text-field': ['get','name'], 'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 2], 'text-max-width': 14, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#E65100', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.9 }});

      // Live News — muted rose
      map.addLayer({ id: 'news-glow', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,8, 5,14, 10,22],
        'circle-color': '#EC407A', 'circle-opacity': 0.08, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'news-dots', type: 'circle', source: 'live-news', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,10],
        'circle-color': '#EC407A', 'circle-opacity': 0.8,
        'circle-stroke-width': 1.5, 'circle-stroke-color': '#EC407A', 'circle-stroke-opacity': 0.4,
      }});
      map.addLayer({ id: 'news-label', type: 'symbol', source: 'live-news', minzoom: 4, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.8], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': '#EC407A', 'text-halo-color': '#000', 'text-halo-width': 1, 'text-opacity': 0.8 }});

      // Live Alert pins — a report at the place it names, coloured by what it describes
      const alertColor: LayerColor = ['match', ['get','kind'], 'rocket', ALERT_KINDS.rocket.color, 'event', ALERT_KINDS.event.color, ALERT_KINDS.news.color];
      map.addLayer({ id: 'alert-pin-glow', type: 'circle', source: 'alert-pins', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,7, 6,14, 10,22],
        'circle-color': alertColor, 'circle-opacity': 0.16, 'circle-blur': 0.8,
      }});
      map.addLayer({ id: 'alert-pin-dots', type: 'circle', source: 'alert-pins', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3.5, 6,6, 10,8],
        'circle-color': alertColor,
        // A region is placed less exactly than a town, so it is drawn as a ring.
        'circle-opacity': ['case', ['==', ['get','precision'], 'region'], 0.15, 0.95],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': ['match', ['get','precision'], 'region', alertColor, '#0A0A0A'] as LayerColor,
      }});
      // A report just in, and the pin a popup is open on, each get a ring.
      map.addLayer({ id: 'alert-pin-pulse', type: 'circle', source: 'alert-pins', filter: ['==', ['get','fresh'], true], paint: {
        'circle-radius': 9, 'circle-color': 'transparent',
        'circle-stroke-color': alertColor as never, 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.7,
      }});
      map.addLayer({ id: 'alert-pin-selected', type: 'circle', source: 'alert-pins', filter: ['==', ['get','id'], ''], paint: {
        'circle-radius': 13, 'circle-color': 'transparent',
        'circle-stroke-color': '#FFFFFF', 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 0.85,
      }});
      map.addLayer({ id: 'alert-pin-label', type: 'symbol', source: 'alert-pins', minzoom: 5, layout: {
        // "Riyadh ·3" when three reports name the same town.
        'text-field': ['case', ['>', ['get','stack'], 1],
          ['concat', ['get','place_name'], ' ·', ['to-string', ['get','stack']]],
          ['get','place_name']],
        'text-size': 10, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': alertColor, 'text-halo-color': '#000', 'text-halo-width': 1.2, 'text-opacity': 0.9 }});

      // Flight layers (WebGL symbol — GPU rendered, handles 50K+ smooth)
      const flightLayers = [
        { id: 'fl-commercial', src: 'flights', icon: 'plane-cyan' },
        { id: 'fl-private', src: 'private-fl', icon: 'plane-green' },
        { id: 'fl-jets', src: 'jets', icon: 'plane-pink' },
        { id: 'fl-military', src: 'military', icon: 'plane-red' },
      ];
      flightLayers.forEach(l => {
        map.addLayer({ id: l.id, type: 'symbol', source: l.src, layout: {
          'icon-image': l.icon, 'icon-size': ['interpolate',['linear'],['zoom'], 1,0.4, 5,0.7, 10,1],
          'icon-rotate': ['get','heading'], 'icon-rotation-alignment': 'map', 'icon-allow-overlap': true, 'icon-ignore-placement': true,
        }, paint: { 'icon-opacity': 0.85 }});
      });

      // Route layers are added later (after setMapReady) so they render on top of everything.

      // Balloons (moving entities)
      map.addLayer({ id: 'balloon-dots', type: 'circle', source: 'balloons', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,3, 5,5, 10,7],
        'circle-color': ['get', 'color'],
        'circle-opacity': 0.8,
        'circle-stroke-width': 1, 'circle-stroke-color': '#fff', 'circle-stroke-opacity': 0.5,
      }});
      map.addLayer({ id: 'balloon-label', type: 'symbol', source: 'balloons', minzoom: 4, layout: {
        'text-field': ['get','callsign'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.2], 'text-max-width': 12, 'text-allow-overlap': false,
      }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Radiation — violet base, threat spectrum for danger/warning
      map.addLayer({ id: 'rad-glow', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,10, 5,20, 10,40],
        'circle-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'],
        'circle-opacity': 0.12, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'rad-dots', type: 'circle', source: 'radiation', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,4, 5,6, 10,8],
        'circle-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'],
        'circle-opacity': 0.85,
        'circle-stroke-width': 1.5, 'circle-stroke-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'], 'circle-stroke-opacity': 0.35,
      }});
      map.addLayer({ id: 'rad-label', type: 'symbol', source: 'radiation', minzoom: 5, layout: {
        'text-field': ['concat', ['to-string', ['get','reading']], ' nSv/h'], 'text-size': 9, 'text-font': ['Open Sans Bold'],
        'text-offset': [0, 1.5], 'text-allow-overlap': false,
      }, paint: { 'text-color': ['match', ['get','status'], 'DANGER','#D32F2F', 'WARNING','#E65100', '#7E57C2'], 'text-halo-color': '#000', 'text-halo-width': 1 }});

      // Maritime Ships (moving entities) — ocean teal family
      map.addLayer({ id: 'ship-dots', type: 'circle', source: 'maritime-ships', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 1,2, 5,4, 10,6],
        'circle-color': ['match', ['get','type'], 'military','#D32F2F', 'tanker','#E65100', 'cargo','#26C6DA', '#B0BEC5'],
        'circle-opacity': 0.75,
      }});
      map.addLayer({ id: 'ship-label', type: 'symbol', source: 'maritime-ships', minzoom: 5, layout: {
        'text-field': ['get','name'], 'text-size': 9, 'text-font': ['Open Sans Regular'],
        'text-offset': [0, 1.2], 'text-allow-overlap': false,
      }, paint: { 'text-color': ['match', ['get','type'], 'military','#D32F2F', 'tanker','#E65100', 'cargo','#26C6DA', '#B0BEC5'], 'text-halo-color': '#000', 'text-halo-width': 1 }});


      if (!map.hasImage('kotamaops-shield')) {
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        ctx.beginPath();
        ctx.moveTo(16, 2);
        ctx.lineTo(28, 8);
        ctx.lineTo(28, 16);
        ctx.quadraticCurveTo(28, 26, 16, 30);
        ctx.quadraticCurveTo(4, 26, 4, 16);
        ctx.lineTo(4, 8);
        ctx.closePath();
        ctx.fillStyle = '#1C3D24';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#D4AF37';
        ctx.stroke();
        ctx.fillStyle = '#D4AF37';
        ctx.fillRect(11, 14, 10, 2);
        map.addImage('kotamaops-shield', { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
      }
      const logoLoads = new Set<string>();
      const ensureKotamaopsLogo = async (id: string) => {
        const point = kotamaopsRef.current.find((item) => kotamaopsIconId(item.code) === id);
        const logo = point ? safeKotamaopsLogo(point.logo) : "";
        if (!point || !logo || map.hasImage(id) || logoLoads.has(id)) return;
        logoLoads.add(id);
        try {
          const response = await map.loadImage(logo);
          if (logosAlive && !map.hasImage(id)) map.addImage(id, response.data, { pixelRatio: 2 });
        } catch (error) {
          console.warn("[OSIRIS] logo Kotamaops gagal dimuat:", point.code, error instanceof Error ? error.message : error);
        } finally {
          logoLoads.delete(id);
        }
      };
      map.setMissingStyleImageResolver((id) => ensureKotamaopsLogo(id));
      for (const point of kotamaopsRef.current) void ensureKotamaopsLogo(kotamaopsIconId(point.code));
      map.addLayer({ id: 'kotamaops-glow', type: 'circle', source: 'kotamaops', paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 8, 6, 14, 10, 18],
        'circle-color': '#D4AF37', 'circle-opacity': 0.18, 'circle-blur': 0.8,
      }});
      map.addLayer({ id: 'kotamaops-icon', type: 'symbol', source: 'kotamaops', layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.38, 5, 0.62, 8, 0.9, 12, 1.1],
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': ['get', 'code'],
        'text-font': ['Open Sans Bold'],
        'text-size': 11,
        'text-offset': [0, 0.25],
        'text-anchor': 'top',
        'text-optional': true,
        'text-allow-overlap': false,
      }, paint: {
        'text-color': '#F3E6B8',
        'text-halo-color': '#000000',
        'text-halo-width': 1.4,
      }});
      for (let frame = 0; frame < KOTAMAOPS_FLAME_FRAMES; frame += 1) {
        const canvas = document.createElement('canvas');
        canvas.width = KOTAMAOPS_FLAME_WIDTH;
        canvas.height = KOTAMAOPS_FLAME_HEIGHT;
        const ctx = canvas.getContext('2d')!;
        drawKotamaopsFlame(ctx, frame);
        const id = kotamaopsFlameImageId(frame);
        if (!map.hasImage(id)) {
          map.addImage(id, { width: canvas.width, height: canvas.height, data: new Uint8Array(ctx.getImageData(0, 0, canvas.width, canvas.height).data) }, { pixelRatio: 2 });
        }
      }
      map.addLayer({ id: 'kotamaops-flame', type: 'symbol', source: 'kotamaops', filter: ['in', ['get', 'code'], ['literal', KOTAMAOPS_FLAME_CODES]], layout: {
        'icon-image': kotamaopsFlameImageId(0),
        'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.42, 5, 0.62, 8, 0.82, 12, 1],
        'icon-anchor': 'bottom',
        'icon-offset': [0, -58],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      }});
      let flameFrame = 0;
      flameTimer = window.setInterval(() => {
        if (!logosAlive || document.hidden || !map.getLayer('kotamaops-flame')) return;
        flameFrame = nextKotamaopsFlameFrame(flameFrame);
        map.setLayoutProperty('kotamaops-flame', 'icon-image', kotamaopsFlameImageId(flameFrame));
      }, KOTAMAOPS_FLAME_FRAME_MS);

      setMapReady(true);
      // 'load' means the style parsed; 'idle' means the tiles are drawn.
      // The splash waits for the second, so it lifts onto a finished globe.
      map.once('idle', () => onReadyRef.current?.());
      // Dev-only handle. The map is otherwise unreachable from the console,
      // which makes interaction bugs guesswork rather than diagnosis.
      if (process.env.NODE_ENV === 'development') (window as OsirisWindow).__osirisMap = map;
    });

    // Events
    let lastMove = 0;
    map.on('mousemove', e => {
      const now = Date.now();
      if (now - lastMove > 100) {
        lastMove = now;
        onMouseCoords?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });
    /* The region dossier opens on a double right-click: two within
       DOUBLE_RIGHT_MS and a few pixels of each other. A single right-click
       was too easy to make by accident — it opened a panel and set off a
       place lookup and a country's worth of Wikidata requests. A touch
       long-press is already deliberate, so on a phone one still opens it;
       asking for two there would make it all but unreachable. */
    let lastRightClick: { at: number; x: number; y: number } | null = null;
    map.on('contextmenu', e => {
      e.preventDefault();
      const open = () => onRightClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      if ((e.originalEvent as PointerEvent).pointerType === 'touch') { open(); return; }

      const now = performance.now();
      const { x, y } = e.point;
      const isSecond = lastRightClick !== null
        && now - lastRightClick.at < DOUBLE_RIGHT_MS
        && Math.hypot(x - lastRightClick.x, y - lastRightClick.y) < DOUBLE_RIGHT_SLOP_PX;
      if (isSecond) {
        lastRightClick = null;
        open();
      } else {
        lastRightClick = { at: now, x, y };
      }
    });
    const reportViewState = () => { const c = map.getCenter(); onViewStateChange?.({ zoom: map.getZoom(), latitude: c.lat }); };
    map.on('load', reportViewState);
    map.on('moveend', reportViewState);
    // Lightweight settled-view diagnostics for camera/terrain regressions.
    const reportCamera = () => {
      const center = map.getCenter();
      container.dataset.mapCamera = JSON.stringify({ zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(), lat: center.lat, lng: center.lng });
    };
    map.on('load', reportCamera);
    map.on('moveend', reportCamera);
    map.on('idle', reportCamera);
    reportCamera();

    // ── POPUP HELPER ──
    const popup = (coords: maplibregl.LngLatLike, html: string, anchor?: maplibregl.PositionAnchor) => {
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '420px', offset: anchor === 'bottom' ? 12 : 14, anchor }).setLngLat(coords).setHTML(html).addTo(map);
    };
    const pStyle = `background:rgba(21,26,41,0.95);backdrop-filter:blur(16px);border-radius:10px;padding:16px;font-family:'JetBrains Mono',monospace;`;
    const linkStyle = `display:inline-block;margin-top:8px;padding:5px 12px;font-size:10px;letter-spacing:0.12em;text-decoration:none;border-radius:5px;font-family:'JetBrains Mono',monospace;`;

    // ── XSS PROTECTION HELPERS ──
    const idSafe = (value: unknown): string => String(value ?? '').replace(/[^a-zA-Z0-9_\.\-]/g, '');

    const formatTime = (iso: string | null) => {
      if (!iso) return '—';
      try {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' });
      } catch { return '—'; }
    };

    // ── Flights (with FlightAware + ADS-B Exchange links + ROUTE VISUALIZATION) ──
    ['fl-commercial','fl-private','fl-jets','fl-military'].forEach(layer => {
      map.on('click', layer, e => {
        const p = clickedProperties<FlightPopup>(e);
        const coords = pointCoordinates(e.features?.[0]?.geometry);
        if (!p || !coords) return;
        const cs = (p.callsign||'').trim();

        // Show initial popup immediately (without route data)
        const routeLoadingId = `route-info-${Date.now()}`;
        popup(coords, `<div style="${pStyle}border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <span style="color:#E8E6E0;font-size:15px;font-weight:700;letter-spacing:0.08em;">${htmlEsc(cs)}</span>
            <span style="color:#5C5A54;font-size:10px;">${htmlEsc(p.icao24||'')}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px;">
            <div><span style="color:#5C5A54;font-size:9px;">MODEL</span><br/><span style="color:#B0BEC5;">${htmlEsc(p.model||'—')}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">ALT</span><br/><span style="color:#B0BEC5;">${p.alt?Math.round(p.alt)+'m':'—'}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">SPEED</span><br/><span style="color:#B0BEC5;">${htmlEsc(String(p.speed_knots||'—'))}kt</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">HDG</span><br/><span style="color:#B0BEC5;">${Math.round(p.heading||0)}°</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">REG</span><br/><span style="color:#B0BEC5;">${htmlEsc(p.registration||'—')}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">POS</span><br/><span style="color:#B0BEC5;">${coords[1].toFixed(2)},${coords[0].toFixed(2)}</span></div>
          </div>
          <div id="ac-${idSafe(p.icao24||'')}" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
            <span style="color:#5C5A54;font-size:9px;letter-spacing:0.1em;">IDENTIFYING AIRFRAME…</span>
          </div>
          <button onclick="window.osirisWatchFlight && window.osirisWatchFlight({ icao24: '${idSafe(p.icao24||'')}', callsign: '${idSafe(cs)}' })" style="width:100%;margin-top:8px;padding:6px 12px;background:rgba(0,229,255,0.10);border:1px solid rgba(0,229,255,0.35);color:#7FE9FF;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:bold;letter-spacing:0.1em;border-radius:4px;cursor:pointer;">+ WATCH THIS AIRCRAFT</button>
          <div id="${routeLoadingId}" style="margin-top:8px;padding:6px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <span style="color:#5C5A54;font-size:9px;letter-spacing:0.1em;">RESOLVING ROUTE…</span>
          </div>
          <div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;">
            <a href="https://www.flightaware.com/live/flight/${encodeURIComponent(cs)}" target="_blank" style="${linkStyle}color:#78909C;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">FLIGHTAWARE</a>
            <a href="https://globe.adsbexchange.com/?icao=${encodeURIComponent(p.icao24||'')}" target="_blank" style="${linkStyle}color:#78909C;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">ADS-B</a>
            <a href="https://www.radarbox.com/data/flights/${encodeURIComponent(cs)}" target="_blank" style="${linkStyle}color:#78909C;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.03);">RADARBOX</a>
          </div>
        </div>`);

        // The transponder only reports a type code (often nothing at all), so
        // resolve the real manufacturer/model and registration out of band.
        if (p.icao24) {
          fetch(`/api/aircraft?icao24=${encodeURIComponent(p.icao24)}`)
            .then(r => (r.ok ? r.json() : null))
            .then((d) => {
              const el = document.getElementById(`ac-${p.icao24}`);
              if (!el || !d || d.error) {
                if (el) el.innerHTML = '<span style="color:#5C5A54;font-size:9px;">AIRFRAME NOT IN REGISTRY</span>';
                return;
              }
              const bits = [d.registration, d.typeCode, d.operator].filter(Boolean)
                .map((x: string) => htmlEsc(String(x))).join(' · ');
              el.innerHTML =
                `<div style="color:#E8E6E0;font-size:11px;line-height:1.35;">${htmlEsc(d.model || 'Unidentified type')}</div>` +
                (bits ? `<div style="color:#78909C;font-size:9px;margin-top:2px;">${bits}</div>` : '');
            })
            .catch(() => {});
        }

        // Resolve origin/destination for the readout only. The line this used
        // to draw was a straight hop between two airports, which is not the
        // path flown — watched aircraft draw their real reported track instead.
        const cleanCallsign = cs.replace(/\s+/g, '');
        const routeParams = new URLSearchParams({
          callsign: cleanCallsign,
          icao24: p.icao24 || '',
          lat: String(coords[1]),
          lng: String(coords[0]),
          speed: String(p.speed_knots || 0),
        });
        fetch(`/api/flight-route?${routeParams}`)
          .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
          .then(routeData => {
            const el = document.getElementById(routeLoadingId);
            if (!el) return;
            if (routeData.found && routeData.origin && routeData.destination) {
              const depTime = formatTime(routeData.departureTime);
              const arrTime = formatTime(routeData.arrivalTime);
              const pct = Math.round((routeData.progress || 0) * 100);
              const distKm = routeData.totalDistanceKm || 0;
              el.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
                  <div><span style="color:#5C5A54;font-size:8px;">FROM</span><br/><span style="color:#E8E6E0;font-size:13px;font-weight:700;">${htmlEsc(routeData.origin.iata || routeData.origin.icao)}</span> <span style="color:#5C5A54;font-size:9px;">${htmlEsc(routeData.origin.city)}</span></div>
                  <span style="color:#5C5A54;font-size:11px;">&rarr;</span>
                  <div style="text-align:right;"><span style="color:#5C5A54;font-size:8px;">TO</span><br/><span style="color:#E8E6E0;font-size:13px;font-weight:700;">${htmlEsc(routeData.destination.iata || routeData.destination.icao)}</span> <span style="color:#5C5A54;font-size:9px;">${htmlEsc(routeData.destination.city)}</span></div>
                </div>
                <div style="height:2px;background:rgba(255,255,255,0.06);border-radius:1px;margin:6px 0;"><div style="width:${pct}%;height:100%;background:rgba(255,255,255,0.35);border-radius:1px;"></div></div>
                <div style="display:flex;justify-content:space-between;font-size:10px;color:#78909C;">
                  <span>DEP ${depTime}</span>
                  <span>${pct}% &middot; ${distKm.toLocaleString()}km</span>
                  <span>ARR ${arrTime}</span>
                </div>
              `;
            } else {
              el.innerHTML = `<span style="color:#5C5A54;font-size:9px;">NO SCHEDULED ROUTE</span>`;
            }
          })
          .catch(() => {
            const el = document.getElementById(routeLoadingId);
            if (el) el.innerHTML = `<span style="color:#5C5A54;font-size:9px;">ROUTE UNAVAILABLE</span>`;
          });
      });
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── CCTV and CCTV JM (opens CameraViewer panel) ──
    const openCamera = (e: maplibregl.MapLayerMouseEvent) => {
      const p = clickedProperties<CameraPopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      onEntityClick?.({
        type: 'cctv',
        id: p.id,
        name: p.name,
        city: p.city,
        country: p.country,
        source: p.source,
        feed_url: p.feed_url,
        stream_url: p.stream_url,
        stream_type: p.stream_type,
        external_url: p.external_url,
        lat: coords[1],
        lng: coords[0],
      });
      map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 13), duration: 1000 });
    };
    map.on('click', 'cctv-dots', openCamera);
    map.on('click', 'cctv-jm-dots', openCamera);
    map.on('click', 'cctv-jakarta-dots', openCamera);

    // Clicking a camera cluster zooms in until it splits apart.
    const zoomCluster = (src: string) => (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const clusterId = feature?.properties?.cluster_id;
      const coords = pointCoordinates(feature?.geometry);
      if (clusterId == null || !coords) return;
      const source = map.getSource(src) as maplibregl.GeoJSONSource | undefined;
      source?.getClusterExpansionZoom(clusterId).then(zoom => {
        map.easeTo({ center: coords as [number, number], zoom, duration: 600 });
      }).catch(() => {});
    };
    for (const src of ['cctv', 'cctv-jm', 'cctv-jakarta']) {
      map.on('click', `${src}-cluster`, zoomCluster(src));
    }

    // ── Earthquakes (BMKG) ──
    map.on('click', 'eq-circles', e => {
      const p = clickedProperties<EarthquakePopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,149,0,0.3);">
        <div style="color:#FF9500;font-size:14px;font-weight:700;margin-bottom:4px;">M${htmlEsc(String(p.magnitude ?? ''))} EARTHQUAKE</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;">${htmlEsc(p.place||'Unknown location')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">DEPTH</span><br/><span style="color:#E8E6E0;">${htmlEsc(String(p.depth||'—'))}km</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}, ${coords[0].toFixed(3)}</span></div>
        </div>
        <a href="${urlSafe(p.url || 'https://data.bmkg.go.id/gempabumi/')}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:#FF9500;border:1px solid rgba(255,149,0,0.4);background:rgba(255,149,0,0.1);">📊 ${htmlEsc(p.source || 'BMKG')}</a>
      </div>`);
    });

    // ── Satellites (SatNOGS powered) ──
    // Layers with their own click handlers. The satellite pick defers to
    // these, and to nothing else — the basemap is not a click target.
    const CLICKABLE_LAYERS = new Set(['cctv-dots','cctv-jm-dots','cctv-jakarta-dots','eq-circles','fires-heat',
      'gdelt-dots','weather-dots','maritime-dots','choke-dots','news-dots',
      'balloon-dots','rad-dots','ship-dots','gdelt-events-dots',
     'flight-dots','military-dots','jet-dots','private-dots','alert-pin-dots','kotamaops-icon','kotamaops-flame']);

    // Satellites are picked on the GPU: the pick pass runs the same vertex
    // shader as the visible one, so the target is always exactly where the
    // marker was drawn — including its altitude. A ground-projected hit test
    // would put the target under the satellite instead of on it.
    map.on('click', e => {
      const layer = satLayerRef.current;
      if (!layer) return;
      // Defer to any layer that has its own click handler, so a camera or an
      // aircraft under the cursor is not stolen by a satellite behind it.
      // Only those layers count: querying every feature matches the basemap
      // land and water fills at essentially any point on the globe, which
      // made this bail out every single time.
      const hits = map.queryRenderedFeatures(e.point);
      if (hits.some(f => f.layer?.id && CLICKABLE_LAYERS.has(f.layer.id))) return;
      const idx = layer.pick(e.point.x, e.point.y);
      const p = idx == null ? null : satRowsRef.current[idx];
      // Clicking past every satellite is how a selection is dismissed, so an
      // empty click has to clear the ring and the track rather than leave them
      // lit over nothing.
      if (idx == null || !p) { clearSat(); return; }

      // The readout is a panel, not a MapLibre popup: a popup can only anchor
      // to a ground coordinate, and these markers are drawn at altitude. Any
      // other layer's popup is still welcome to the screen, but not on top of
      // this selection.
      popupRef.current?.remove();
      layer.setOrbit(null);
      satPickedRef.current = idx;
      satSelectedIdRef.current = p.noradId ?? null;
      layer.setSelected(idx);
      setSelectedSat({ ...p, periodMinutes: null, track: p.noradId ? 'loading' : 'unavailable' });

      // Draw the selected satellite's orbit. Fetched per click rather than
      // bundled with the catalogue: that payload is already megabytes, and an
      // operator looks at one orbit at a time.
      if (p.noradId) {
        const wanted = p.noradId;
        // A slower reply for a satellite the operator has already moved on
        // from must not draw over the one they are looking at now.
        const stale = () => satSelectedIdRef.current !== wanted;
        const mark = (track: SatelliteDetail['track'], periodMinutes: number | null = null) =>
          setSelectedSat(prev => (prev && prev.noradId === wanted ? { ...prev, track, periodMinutes } : prev));
        const at = satEpochRef.current;
        fetch(`/api/satellites/orbit?id=${encodeURIComponent(wanted)}${at ? `&t=${at}` : ''}`)
          .then(r => (r.ok ? r.json() : null))
          .then(d => {
            if (stale()) return;
            if (!d?.segments?.length) { mark('unavailable'); return; }
            layer.setOrbit(
              d.segments.map((seg: number[][]) => seg.map(([lng, lat, altKm]) => ({ lng, lat, altKm }))),
              parseColor(satColorFor(p.category, p.color, paletteRef.current)),
            );
            mark('ready', typeof d.periodMinutes === 'number' ? d.periodMinutes : null);
          })
          // No track is fine; the satellite still shows — but the readout says so
          // rather than sitting on 'plotting' forever.
          .catch(() => { if (!stale()) mark('unavailable'); });
      }
    });

    // The cursor should say a satellite is clickable, like every other layer.
    // Picking re-renders the entire catalogue and reads back from the GPU.
    // Keep that work out of camera gestures and limit hover checks to 10/sec.
    // Click selection above remains immediate and full precision.
    let hoverFrame = 0;
    let lastHoverPick = -Infinity;
    map.on('mousemove', e => {
      const layer = satLayerRef.current;
      if (!layer || hoverFrame || map.isMoving() || performance.now() - lastHoverPick < 100) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        if (map.isMoving()) return;
        const canvas = map.getCanvas();
        // Never fight another layer that has already claimed the cursor.
        if (canvas.style.cursor && canvas.style.cursor !== 'pointer') return;
        lastHoverPick = performance.now();
        const over = layer.pick(e.point.x, e.point.y) != null;
        if (over) canvas.style.cursor = 'pointer';
        else if (canvas.style.cursor === 'pointer') canvas.style.cursor = '';
      });
    });

    // ── Fires (with NASA FIRMS link) ──
    map.on('click', 'fires-heat', e => {
      const p = clickedProperties<FirePopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      popup(coords, `<div style="${pStyle}border:1px solid rgba(255,107,0,0.3);">
        <div style="color:#FF6B00;font-size:12px;font-weight:700;margin-bottom:6px;">🔥 ACTIVE FIRE DETECTED</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">BRIGHTNESS</span><br/><span style="color:#FF6B00;">${htmlEsc(String(p.brightness||'—'))}K</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <a href="https://firms.modaps.eosdis.nasa.gov/map/#d:24hrs;l:noaa20-viirs,viirs,modis_a,modis_t;@${coords[0]},${coords[1]},10z" target="_blank" style="${linkStyle}color:#FF6B00;border:1px solid rgba(255,107,0,0.4);background:rgba(255,107,0,0.1);">🛰️ NASA FIRMS MAP</a>
      </div>`);
    });

    // ── GDELT 2.0 Events ──
    const QUAD_COLOR: Record<string, string> = { '1': '#00E676', '2': '#00E5FF', '3': '#FF9500', '4': '#FF3D3D' };
    map.on('click', 'gdelt-events-dots', e => {
      const p = clickedProperties<GdeltEventPopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      const accent = QUAD_COLOR[String(p.quad)] ?? '#9B978E';
      const src = urlSafe(p.url);
      const tone = Number(p.tone);
      popup(coords, `
      <div style="${pStyle}border:1px solid ${accent}66;min-width:250px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="width:7px;height:7px;border-radius:50%;background:${accent};box-shadow:0 0 8px ${accent};"></span>
          <span style="color:${accent};font-size:10px;font-weight:700;letter-spacing:0.15em;">${htmlEsc(p.quad_label)}</span>
        </div>
        <div style="color:#E8E6E0;font-size:12px;font-weight:700;margin-bottom:8px;">${htmlEsc(p.name)}</div>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;font-size:10px;color:#9B978E;">
          <span style="opacity:0.6;">Goldstein</span><span style="color:${Number(p.goldstein) < 0 ? '#FF3D3D' : '#00E676'};">${htmlEsc(p.goldstein)}</span>
          <span style="opacity:0.6;">Avg tone</span><span style="color:${tone < 0 ? '#FF9500' : '#00E676'};">${htmlEsc(p.tone)}</span>
          <span style="opacity:0.6;">Articles</span><span style="color:#E8E6E0;">${htmlEsc(p.articles)}</span>
          <span style="opacity:0.6;">Country</span><span style="color:#E8E6E0;">${htmlEsc(p.country || '—')}</span>
        </div>
        <div style="margin-top:8px;font-size:9px;color:#5C5A54;">GDELT 2.0 · ${htmlEsc(String(p.date).slice(0, 16).replace('T', ' '))}Z</div>
        ${src !== '#' ? `<a href="${src}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:${accent};border:1px solid ${accent}66;background:${accent}1a;">SOURCE ARTICLE</a>` : ''}
      </div>`);
    });

    // ── GDELT Conflicts (with source article) ──
    map.on('click', 'gdelt-dots', e => {
      const p = clickedProperties<IncidentPopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      
      // These are GDACS alerts and each one carries its own report URL. This
      // used to guess a Liveuamap regional war map from the coordinates
      // instead, which sent every event outside the six hardcoded boxes — all
      // of the Americas, Asia and Oceania among them — to the Ukraine map.
      const src = urlSafe(p.url);
      // GDACS is a natural-disaster feed. Every event here was headed
      // "CONFLICT EVENT" — on a live sample that mislabelled 342 of 369
      // events, nearly all of them wildfires.
      const KIND: Record<string, [string, string]> = {
        earthquake: ['🌐 EARTHQUAKE',   '#FF9500'],
        wildfire:   ['🔥 WILDFIRE',     '#FF6B1A'],
        flood:      ['🌊 FLOOD',        '#00B0FF'],
        weather:    ['🌀 TROPICAL CYCLONE', '#00E5FF'],
        volcano:    ['🌋 VOLCANO',      '#FF3D3D'],
        drought:    ['☀️ DROUGHT',      '#FFD500'],
      };
      const [kindLabel, kindColor] = KIND[String(p.kind)] ?? ['⚠️ GLOBAL INCIDENT', '#FF3D3D'];

      popup(coords, `<div style="${pStyle}border:1px solid ${kindColor}4d;">
        <div style="color:${kindColor};font-size:12px;font-weight:700;margin-bottom:6px;">${kindLabel}</div>
        <div style="font-size:9px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.name||'Unclassified incident')}</div>
        ${src !== '#' ? `<a href="${src}" target="_blank" rel="noopener noreferrer" style="${linkStyle}flex:1;text-align:center;color:${kindColor};border:1px solid ${kindColor}66;background:${kindColor}26;display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ OPEN SOURCE ↗ ]</a>` : ''}
      </div>`);
    });


    // ── Generic hover for clickables ──
    ['cctv-dots','cctv-jm-dots','cctv-jakarta-dots','cctv-cluster','cctv-jm-cluster','cctv-jakarta-cluster','eq-circles','fires-heat','gdelt-dots','weather-dots','maritime-dots','choke-dots','news-dots','balloon-dots','rad-dots','ship-dots','gdelt-events-dots','alert-pin-dots','kotamaops-icon','kotamaops-flame'].forEach(layer => {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    });

    // ── Balloons / Sondes ──
    map.on('click', 'balloon-dots', e => {
      const p = clickedProperties<BalloonPopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      popup(coords, `<div style="${pStyle}border:1px solid ${htmlEsc(String(p.color ?? ''))}40;">
        <div style="color:${htmlEsc(String(p.color ?? ''))};font-size:12px;font-weight:700;letter-spacing:0.1em;margin-bottom:4px;">🎈 ${htmlEsc(String(p.callsign ?? ''))}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${htmlEsc(String(p.type ?? '').toUpperCase())} / STATUS: ${htmlEsc(String(p.status ?? '').toUpperCase())}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;">
          <div><span style="color:#5C5A54;">ALTITUDE</span><br/><span style="color:#E8E6E0;">${htmlEsc(String(p.altitude ?? ''))} m</span></div>
          <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:#E8E6E0;">${Math.round(p.speed)} km/h</span></div>
          <div><span style="color:#5C5A54;">VERT RATE</span><br/><span style="color:${p.verticalRate > 0 ? '#00E676' : '#FF3D3D'};">${p.verticalRate.toFixed(1)} m/s</span></div>
          <div><span style="color:#5C5A54;">TEMP</span><br/><span style="color:#E8E6E0;">${htmlEsc(String(p.temperature ?? ''))}°C</span></div>
        </div>
      </div>`);
    });

    // ── Radiation ──
    map.on('click', 'rad-dots', e => {
      const p = clickedProperties<RadiationPopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      const color = p.status === 'DANGER' ? '#FF1744' : p.status === 'WARNING' ? '#FF9500' : '#AB47BC';
      popup(coords, `<div style="${pStyle}border:1px solid ${color}40;">
        <div style="color:${color};font-size:12px;font-weight:700;margin-bottom:4px;">☢️ ${htmlEsc(String(p.name ?? ''))}</div>
        <div style="font-size:9px;color:#aaa;margin-bottom:8px;">${htmlEsc(String(p.city ?? ''))}, ${htmlEsc(String(p.country ?? ''))}</div>
        <div style="display:grid;grid-template-columns:1fr;gap:4px;font-size:11px;">
          <div><span style="color:#5C5A54;font-size:9px;">READING</span><br/><span style="color:${color};font-weight:bold;">${htmlEsc(String(p.reading ?? ''))} nSv/h</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">STATUS</span><br/><span style="color:${color};">${htmlEsc(String(p.status ?? ''))}</span></div>
          <div><span style="color:#5C5A54;font-size:9px;">NETWORK</span><br/><span style="color:#E8E6E0;">${htmlEsc(String(p.network ?? ''))}</span></div>
        </div>
      </div>`);
    });

    // ── Maritime Ships ──
    map.on('click', 'ship-dots', e => {
      const p = clickedProperties<ShipPopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      const color = p.type === 'military' ? '#FF1744' : p.type === 'tanker' ? '#FF9500' : '#00E5FF';
      const icon = p.type === 'military' ? '⚔️' : p.type === 'tanker' ? '🛢️' : '🚢';
      
      popup(coords, `<div style="${pStyle}border:1px solid ${color}60;box-shadow:inset 0 0 12px ${color}15;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid ${color}40;padding-bottom:6px;margin-bottom:8px;">
          <div style="color:${color};font-size:12px;font-weight:700;letter-spacing:0.1em;">${icon} [ ${htmlEsc(String(p.type||'VESSEL').toUpperCase())} ]</div>
          <div style="color:#5C5A54;font-size:9px;">FLAG: ${htmlEsc(p.flag||'UNK')}</div>
        </div>
        <div style="color:#E8E6E0;font-size:11px;font-weight:bold;margin-bottom:10px;">${htmlEsc(p.name || 'UNIDENTIFIED VESSEL')}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:9px;margin-bottom:8px;background:rgba(0,0,0,0.3);padding:6px;border-radius:4px;">
          <div><span style="color:#5C5A54;">SPEED</span><br/><span style="color:${color};font-family:monospace;">${Number(p.speed).toFixed(1)} kn</span></div>
          <div><span style="color:#5C5A54;">HEADING</span><br/><span style="color:${color};font-family:monospace;">${Number(p.heading).toFixed(0)}°</span></div>
          <div><span style="color:#5C5A54;">LATITUDE</span><br/><span style="color:#E8E6E0;font-family:monospace;">${coords[1].toFixed(4)}°</span></div>
          <div><span style="color:#5C5A54;">LONGITUDE</span><br/><span style="color:#E8E6E0;font-family:monospace;">${coords[0].toFixed(4)}°</span></div>
        </div>
        <div><span style="color:#5C5A54;font-size:9px;">DESTINATION: </span><span style="color:#E8E6E0;font-size:9px;">${htmlEsc(p.destination || 'UNKNOWN')}</span></div>
        <a href="https://www.marinetraffic.com/en/ais/details/ships/mmsi:${encodeURIComponent(String(p.mmsi ?? ''))}" target="_blank" rel="noopener noreferrer" style="${linkStyle}flex:1;text-align:center;color:${color};border:1px solid ${color}40;background:${color}15;display:inline-block;width:100%;box-sizing:border-box;margin-top:4px;">[ OPEN SOURCE ↗ ]</a>
      </div>`);
    });

    // ── Weather Events (BMKG + NASA EONET + GDACS) ──
    map.on('click', 'weather-dots', e => {
      const p = clickedProperties<WeatherPopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      const iconEmoji = p.icon === 'cyclone' ? '🌀' : p.icon === 'volcano' ? '🌋' : p.icon === 'flood' ? '🌊' : p.icon === 'drought' ? '🏜️' : p.icon === 'ice' ? '🧊' : p.icon === 'weather' ? '⚠️' : '⚡';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(224,64,251,0.3);">
        <div style="color:#E040FB;font-size:14px;font-weight:700;margin-bottom:6px;">${iconEmoji} ${htmlEsc(p.type || 'Weather Event')}</div>
        <div style="font-size:10px;color:#E8E6E0;margin-bottom:8px;line-height:1.4;">${htmlEsc(p.title || 'Unknown event')}</div>
        ${p.description ? `<div style="font-size:9px;color:#B0ACA3;margin-bottom:8px;line-height:1.5;max-height:140px;overflow-y:auto;white-space:pre-line;">${htmlEsc(p.description)}</div>` : ''}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:9px;margin-bottom:8px;">
          <div><span style="color:#5C5A54;">SEVERITY</span><br/><span style="color:${p.severity === 'high' ? '#FF1744' : '#FFD700'};">${(p.severity||'low').toUpperCase()}</span></div>
          <div><span style="color:#5C5A54;">COORDS</span><br/><span style="color:#E8E6E0;">${coords[1].toFixed(3)}°, ${coords[0].toFixed(3)}°</span></div>
        </div>
        <div style="display:flex;gap:6px;">
          ${urlSafe(p.infographic) !== '#' ? `<a href="${urlSafe(p.infographic)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:#E040FB;border:1px solid rgba(224,64,251,0.4);background:rgba(224,64,251,0.1);">🖼 INFOGRAFIS BMKG</a>` : ''}
          ${urlSafe(p.source) !== '#' ? `<a href="${urlSafe(p.source)}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:#E040FB;border:1px solid rgba(224,64,251,0.4);background:rgba(224,64,251,0.1);">📡 SOURCE</a>` : ''}
        </div>
      </div>`);
    });

    const openKotamaops = (e: maplibregl.MapLayerMouseEvent) => {
      const p = clickedProperties<KotamaopsPopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      const logo = safeKotamaopsLogo(String(p.logo || ''));
      const report = karhutlaReport(String(p.code || ''));
      const karhutlaLine = (label: string, value: string, color: string) =>
        `<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;white-space:nowrap;"><span style="color:#5C5A54;letter-spacing:0.06em;flex:none;">${label}</span><span style="color:${color};font-weight:700;text-align:right;">${htmlEsc(value)}</span></div>`;
      const karhutla = report ? `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(212,175,55,0.28);display:grid;gap:3px;font-size:9px;">
          <div style="color:#D4AF37;font-size:8px;letter-spacing:0.14em;">KARHUTLA · ${htmlEsc(KARHUTLA_LAPSIT_AT)}</div>
          ${karhutlaLine('AWAL', formatKarhutlaAmount(report.awalTitik, report.awalHa), '#FF8A80')}
          ${karhutlaLine('SUDAH PADAM', formatKarhutlaAmount(report.padamTitik, report.padamHa), '#81D4FA')}
          ${karhutlaLine('DALAM PEMADAMAN', formatKarhutlaAmount(report.prosesTitik, report.prosesHa), report.prosesHa > 0 ? '#FF8A80' : '#8A8880')}
          ${karhutlaLine('PERSONEL SIAGA', formatPersonel(report.personelSiaga), '#F3E6B8')}
        </div>` : '';
      popup(coords, `<div style="${pStyle}border:1px solid rgba(212,175,55,0.45);min-width:250px;max-width:320px;background:#0C0E1A;padding:10px 12px;">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
          ${logo ? `<img src="${logo}" alt="" width="44" height="44" style="width:44px;height:44px;object-fit:contain;flex:none;" />` : ''}
          <div>
            <div style="color:#D4AF37;font-size:10px;letter-spacing:0.16em;margin-bottom:4px;">TNI ${htmlEsc(p.matra || 'AD')}</div>
            <div style="color:#F3E6B8;font-size:14px;font-weight:700;margin-bottom:2px;">${htmlEsc(p.name || 'Kotamaops')}</div>
            <div style="color:#5C5A54;font-size:9px;letter-spacing:0.08em;">${htmlEsc(p.code || '')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 6px;font-size:9px;">
          <div><span style="color:#5C5A54;">WILAYAH</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.region || '—')}</span></div>
          <div><span style="color:#5C5A54;">LOKASI</span><br/><span style="color:#E8E6E0;">${htmlEsc(p.location || '—')}</span></div>
          <div><span style="color:#5C5A54;">LINTANG</span><br/><span style="color:#E8E6E0;">${Number(coords[1]).toFixed(5)}°</span></div>
          <div><span style="color:#5C5A54;">BUJUR</span><br/><span style="color:#E8E6E0;">${Number(coords[0]).toFixed(5)}°</span></div>
        </div>
        ${karhutla}
      </div>`, 'bottom');
    };
    map.on('click', 'kotamaops-icon', openKotamaops);
    map.on('click', 'kotamaops-flame', openKotamaops);

    // ── Maritime Ports & Naval Bases ──
    map.on('click', 'maritime-dots', e => {
      const p = clickedProperties<PortPopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      const typeColor = p.type === 'naval' ? '#FF3D3D' : p.type === 'energy' ? '#FF9500' : '#00BCD4';
      const typeLabel = p.type === 'naval' ? 'NAVAL BASE' : p.type === 'energy' ? 'ENERGY PORT' : 'CONTAINER PORT';
      
      const congestionHtml = p.congestion ? `
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.1);">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
            <div><span style="color:#5C5A54;font-size:9px;">CONGESTION</span><br/><span style="color:${p.congestion === 'SEVERE' ? '#FF1744' : p.congestion === 'CONGESTED' ? '#FF9500' : '#00E676'};font-weight:bold;font-size:10px;">${htmlEsc(String(p.congestion))}</span></div>
            <div><span style="color:#5C5A54;font-size:9px;">EST. DWELL TIME</span><br/><span style="color:#E8E6E0;font-weight:bold;font-size:10px;">${htmlEsc(String(p.dwell_time || 'Unknown'))}</span></div>
          </div>
        </div>` : '';

      popup(coords, `<div style="${pStyle}border:1px solid ${typeColor}40;">
        <div style="color:${typeColor};font-weight:bold;font-size:11px;margin-bottom:4px;">${htmlEsc(String(p.name ?? ''))}</div>
        <div style="color:#999;font-size:9px;margin-bottom:6px;">${typeLabel} — ${htmlEsc(String(p.country ?? ''))}</div>
        ${p.volume ? `<div style="font-size:9px;color:#aaa;">Volume: <span style="color:${typeColor};font-weight:bold;">${htmlEsc(String(p.volume))}</span></div>` : ''}
        ${p.fleet ? `<div style="font-size:9px;color:#aaa;">Fleet: <span style="color:${typeColor};font-weight:bold;">${htmlEsc(String(p.fleet))}</span></div>` : ''}
        ${p.rank ? `<div style="font-size:9px;color:#aaa;">Global Rank: <span style="color:${typeColor};font-weight:bold;">#${htmlEsc(String(p.rank))}</span></div>` : ''}
        ${congestionHtml}
      </div>`);
    });

    // ── Maritime Chokepoints ──
    map.on('click', 'choke-dots', e => {
      const p = clickedProperties<ChokePopup>(e);
      const coords = pointCoordinates(e.features?.[0]?.geometry);
      if (!p || !coords) return;
      const riskCol = p.risk === 'CRITICAL' ? '#FF1744' : p.risk === 'HIGH' ? '#FF9500' : p.risk === 'ELEVATED' ? '#FFD700' : '#00E676';
      popup(coords, `<div style="${pStyle}border:1px solid ${riskCol}40;">
        <div style="color:#FF9500;font-weight:bold;font-size:11px;margin-bottom:4px;">${htmlEsc(String(p.name ?? ''))}</div>
        <div style="font-size:9px;color:#aaa;">Traffic: <span style="color:#fff;">${htmlEsc(String(p.traffic ?? ''))}</span></div>
        <div style="font-size:9px;color:#aaa;">Risk: <span style="color:${riskCol};font-weight:bold;">${htmlEsc(String(p.risk ?? ''))}</span></div>
      </div>`);
    });

    // ── Live News (opens feed viewer) ──
    map.on('click', 'news-dots', e => {
      const p = clickedProperties<NewsPopup>(e);
      if (!p) return;
      onEntityClick?.({
        type: 'live_news',
        name: p.name,
        city: p.city,
        country: p.country,
        url: p.url,
        category: p.category,
        embed_allowed: p.embed_allowed !== false && p.embed_allowed !== 'false',
      });
    });

    // ── Live Alert pins: the report, the place it names, and its footage ──
    const alertPopupHtml = (reports: AlertPinProps[]) => {
      const [p, ...rest] = reports;
      const c = (ALERT_KINDS[p.kind as AlertKind] ?? ALERT_KINDS.news).color;
      const label = (ALERT_KINDS[p.kind as AlertKind] ?? ALERT_KINDS.news).label;
      const link = urlSafe(p.link);
      const video = urlSafe(p.video);
      const thumb = urlSafe(p.thumb);
      /* Footage plays in place where Telegram serves the file; a video it
         only shows in the app gets its preview and a way through to it. */
      const media = video !== '#'
        ? `<video src="${video}"${thumb !== '#' ? ` poster="${thumb}"` : ''} controls playsinline preload="none" style="display:block;width:100%;max-height:180px;margin-top:10px;border-radius:6px;background:#000;"></video>`
        : thumb !== '#'
          ? `<a href="${link}" target="_blank" rel="noopener noreferrer" style="display:block;position:relative;margin-top:10px;">
              <img src="${thumb}" referrerpolicy="no-referrer" alt="" style="display:block;width:100%;max-height:180px;object-fit:cover;border-radius:6px;">
              ${p.media_kind === 'video' ? `<span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.75);color:#fff;font-size:9px;letter-spacing:0.1em;padding:4px 10px;border-radius:12px;">▶ WATCH ON TELEGRAM${p.duration ? ` · ${htmlEsc(p.duration)}` : ''}</span>` : ''}
            </a>`
          : '';
      const more = rest.slice(0, 4).map(r => {
        const rc = (ALERT_KINDS[r.kind as AlertKind] ?? ALERT_KINDS.news).color;
        return `<a href="${urlSafe(r.link)}" target="_blank" rel="noopener noreferrer" style="display:flex;gap:6px;align-items:baseline;color:#C9C5BC;text-decoration:none;font-size:10px;line-height:1.35;margin-top:5px;">
          <span style="flex:none;width:6px;height:6px;border-radius:50%;background:${rc};transform:translateY(-1px);"></span>
          <span>${htmlEsc(r.title)} <span style="color:#5C5A54;">· ${htmlEsc(r.source_name)} · ${htmlEsc(timeAgo(r.published))}</span></span>
        </a>`;
      }).join('');
      return `
      <div style="${pStyle}border:1px solid ${c}66;width:300px;max-width:100%;padding:14px;max-height:min(44vh,440px);overflow-y:auto;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:9.5px;letter-spacing:0.12em;">
          <span style="width:7px;height:7px;border-radius:50%;background:${c};box-shadow:0 0 8px ${c};"></span>
          <span style="color:${c};font-weight:700;">${label}</span>
          <span style="color:#8A8880;margin-left:auto;">${htmlEsc(timeAgo(p.published))}</span>
        </div>
        <div style="color:#F2EFE8;font-family:Inter,system-ui,sans-serif;font-size:12.5px;font-weight:600;line-height:1.35;">${htmlEsc(p.title)}</div>
        <div style="margin-top:6px;font-size:9.5px;color:#8A8880;">${htmlEsc(p.source_name)}${p.lean ? ` · <span style="color:#9B978E;">${htmlEsc(p.lean)}</span>` : ''}</div>
        <div style="margin-top:6px;font-size:9.5px;color:${c};" title="The place the post names, resolved against OpenStreetMap. Town-level: a post names a place, not an exact spot.">📍 ${htmlEsc(p.place_label)}<span style="color:#5C5A54;"> · ${p.precision === 'region' ? 'region' : 'place'} named in the post · © OpenStreetMap</span></div>
        ${media}
        ${link !== '#' ? `<a href="${link}" target="_blank" rel="noopener noreferrer" style="${linkStyle}color:${c};border:1px solid ${c}66;background:${c}1a;">OPEN POST ↗</a>` : ''}
        ${more ? `<div style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);"><div style="font-size:8.5px;letter-spacing:0.14em;color:#5C5A54;">ALSO HERE</div>${more}</div>` : ''}
      </div>`;
    };

    /* Several reports can name the same town; they stack, newest first. */
    const reportsAt = (coords: [number, number], leadId?: string) => {
      const seen = new Set<string>();
      return alertPinsRef.current
        .filter(f => f.geometry.coordinates[0] === coords[0] && f.geometry.coordinates[1] === coords[1])
        .map(f => f.properties)
        .filter(p => !seen.has(p.id) && seen.add(p.id))
        .sort((a, b) => (a.id === leadId ? -1 : b.id === leadId ? 1 : Date.parse(b.published) - Date.parse(a.published)));
    };

    /** Rings the pin a popup is open on, and clears the ring when it closes. */
    const markSelected = (id: string) => {
      try { map.setFilter('alert-pin-selected', ['==', ['get','id'], id]); } catch { /* style not settled */ }
    };
    const openAlertPopup = (feature: AlertPinFeature, leadId?: string) => {
      popup(feature.geometry.coordinates, alertPopupHtml(reportsAt(feature.geometry.coordinates, leadId)));
      markSelected(feature.properties.id);
      popupRef.current?.once('close', () => markSelected(''));
    };

    map.on('click', 'alert-pin-dots', e => {
      // Matched by id: a rendered feature's geometry is tile-quantised, so it
      // does not equal the coordinates the pin was placed at.
      const ids = new Set((e.features ?? []).map(f => f.properties?.id));
      const lead = alertPinsRef.current.find(f => ids.has(f.properties.id));
      if (lead) openAlertPopup(lead);
    });

    openAlertPinRef.current = (id: string) => {
      const f = alertPinsRef.current.find(x => x.properties.id === id);
      if (f) openAlertPopup(f, id);
    };

    /*
     * Keep the canvas the size of its container.
     *
     * MapLibre reads the container once, when it is constructed, and falls
     * back to 400x300 if the container has no size yet. Its own trackResize
     * watches the window, which never fires when the container is what
     * changed — so a map built a frame too early stayed 400x300 inside a full
     * screen container for the rest of the session, which is what the live
     * site was serving: a small square of map in the corner of a black page.
     * A window resize did not recover it; one resize() call did.
     */
    const sizeToContainer = new ResizeObserver(() => map.resize());
    sizeToContainer.observe(container);

    return () => {
      logosAlive = false;
      window.clearInterval(flameTimer);
      sizeToContainer.disconnect();
      cancelAnimationFrame(hoverFrame);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Day/Night
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const update = () => {
      const src = map.getSource('day-night') as maplibregl.GeoJSONSource | undefined;
      if (!src) return;
      if (!activeLayers.day_night) { src.setData(EMPTY_FC); return; }
      src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [computeSolarTerminator()] }, properties: {} }] });
    };
    update();
    const iv = setInterval(update, 300000); // 5 min (was 1 min — shadow barely moves)
    return () => clearInterval(iv);
  }, [mapReady, activeLayers.day_night]);

  // Helper to set GeoJSON
  const setGeo = useCallback((source: string, features: MapFeature[]) => {
    const src = mapRef.current?.getSource(source) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData({ type: 'FeatureCollection', features: features as GeoJSON.Feature[] });
  }, []);

  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); });
  }, []);

  // Flight data → GeoJSON (GPU rendered)
  useEffect(() => {
    if (!mapReady) return;
    const toFeatures = (arr: FlightRow[] | undefined, decimate: number = 1) => {
      let filtered = arr ?? [];
      if (decimate > 1) {
        filtered = filtered.filter((_, i) => i % decimate === 0);
      }
      return filtered.map(f => ({
        type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [f.lng, f.lat] },
        properties: { callsign: f.callsign, heading: f.heading || 0, alt: f.alt, model: f.model, speed_knots: f.speed_knots, registration: f.registration, icao24: f.icao24 },
      }));
    };
    setGeo('flights', activeLayers.flights ? toFeatures(data.commercial_flights, 10) : []);
    setGeo('private-fl', activeLayers.private ? toFeatures(data.private_flights, 2) : []);
    setGeo('jets', activeLayers.jets ? toFeatures(data.private_jets, 2) : []);
    setGeo('military', activeLayers.military ? toFeatures(data.military_flights) : []);
  }, [mapReady, data.commercial_flights, data.private_flights, data.private_jets, data.military_flights, activeLayers.flights, activeLayers.private, activeLayers.jets, activeLayers.military]);

  /**
   * Pull the palette out of the document whenever it can have changed.
   *
   * Two triggers, and they need different timing. The Style Studio writes the
   * properties and then dispatches, so reading straight away is correct. A
   * theme switch flips a class on <body> from an effect in the page component
   * — a parent, so it runs *after* this one — and reading now would return the
   * outgoing theme. The extra frame covers that case.
   */
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.body);
      const next = readMapPalette(name => cs.getPropertyValue(name));
      setPalette(prev => (MAP_PALETTE_KEYS.every(k => prev[k] === next[k]) ? prev : next));
    };
    read();
    const raf = requestAnimationFrame(read);
    window.addEventListener(STYLE_EVENT, read);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener(STYLE_EVENT, read);
    };
  }, [theme]);

    // Update aircraft icon colors dynamically on theme switch
    useEffect(() => {
      if (!mapReady || !mapRef.current) return;
      const map = mapRef.current;

      const updateMapIcon = (id: string, color: string, size: number) => {
        if (!map.hasImage(id)) return;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const cx = size / 2, cy = size / 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.4);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.1);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx - size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx - size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx, cy + size * 0.35);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.15);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.3);
        ctx.lineTo(cx + size * 0.4, cy + size * 0.2);
        ctx.lineTo(cx + size * 0.12, cy + size * 0.1);
        ctx.closePath();
        ctx.fill();
        map.updateImage(id, { width: size, height: size, data: new Uint8Array(ctx.getImageData(0, 0, size, size).data) });
      };

      updateMapIcon('plane-cyan', palette.flightCivil, 24);
      updateMapIcon('plane-green', palette.flightPrivate, 24);
      updateMapIcon('plane-pink', palette.flightGov, 24);
      updateMapIcon('plane-red', palette.flightMilitary, 24);
      updateMapIcon('plane-grey', palette.flightUnknown, 24);
    }, [mapReady, palette]);

    /* Cameras share one marker image, so a colour change redraws it; the label colour is a paint property. */
    useEffect(() => {
      if (!mapReady || !mapRef.current) return;
      const map = mapRef.current;
      setCameraIcon(map, palette.cctv);
      for (const id of ['cctv-label', 'cctv-jm-label', 'cctv-jakarta-label', 'cctv-cluster-count', 'cctv-jm-cluster-count', 'cctv-jakarta-cluster-count']) {
        if (map.getLayer(id)) map.setPaintProperty(id, 'text-color', palette.cctv);
      }
      for (const id of ['cctv-cluster', 'cctv-jm-cluster', 'cctv-jakarta-cluster']) {
        if (map.getLayer(id)) {
          map.setPaintProperty(id, 'circle-color', palette.cctv);
          map.setPaintProperty(id, 'circle-stroke-color', palette.cctv);
        }
      }
    }, [mapReady, palette.cctv, setCameraIcon]);

  // ── DECOUPLED LAYER RENDERERS (Performance Optimized) ──

  useEffect(() => {
    if (!mapReady) return;
    setGeo('earthquakes', activeLayers.earthquakes && data.earthquakes ? data.earthquakes.map(eq => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [eq.lng, eq.lat] }, properties: { id: eq.id, magnitude: eq.magnitude, place: eq.place, depth: eq.depth, source: eq.source } })) : []);
  }, [mapReady, data.earthquakes, activeLayers.earthquakes, setGeo]);

  /** Catalogue rows -> the packed form the 3D layer draws. */
  const toSatPoints = useCallback((rows: SatelliteRow[]): SatPoint[] => rows.map((s) => ({
    lng: s.lng,
    lat: s.lat,
    altKm: s.alt,
    color: parseColor(satColorFor(s.category, s.color, palette)),
    // Stations are the ones an operator is usually looking for, so they get
    // to be findable in a field of several hundred identical dots.
    size: s.category === 'science' || /ISS|TIANGONG/i.test(s.name || '') ? 2.2 : 1,
  })), [palette]);

  /**
   * Re-points the selection at the same satellite after a refresh.
   *
   * pick() returns an index into the last setPoints() array, and every poll
   * rebuilds that array — a filtered one changes length as well as order. Left
   * as a bare index the highlight ring quietly slides onto whichever satellite
   * now sits at that slot, taking the readout with it.
   */
  const resyncSatSelection = useCallback((rows: SatelliteRow[]) => {
    const id = satSelectedIdRef.current;
    if (!id) return;
    const i = rows.findIndex(r => r.noradId === id);
    // Filtered out, or gone from the catalogue: there is nothing to point at.
    if (i < 0) { clearSat(); return; }
    satPickedRef.current = i;
    satLayerRef.current?.setSelected(i);
    // The satellite has moved since it was clicked; the readout should say where
    // it is now, not where it was.
    setSelectedSat(prev => (prev ? { ...prev, lat: rows[i].lat, lng: rows[i].lng, alt: rows[i].alt } : prev));
  }, [clearSat]);

  useEffect(() => {
    if (!mapReady) return;
    const sats = data.satellites ?? [];
    const at = Date.parse(data.satellites_at ?? '');
    satEpochRef.current = Number.isFinite(at) ? at : null;
    
    // If 'All Satellites' is on, show everything
    if (activeLayers.satellites) {
      setGeo('satellites', sats.map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, color: satColorFor(s.category, s.color, palette), mission: s.mission, alt: s.alt, noradId: s.noradId, category: s.category } })));
      satRowsRef.current = sats;
      satLayerRef.current?.setPoints(toSatPoints(sats));
      resyncSatSelection(sats);
      return;
    }
    
    // Otherwise filter by enabled sub-layers
    const enabledCategories: string[] = [];
    if (activeLayers.sat_comms) enabledCategories.push('comms');
    if (activeLayers.sat_military) enabledCategories.push('military');
    if (activeLayers.sat_navigation) enabledCategories.push('navigation');
    if (activeLayers.sat_earth) enabledCategories.push('earth_obs');
    if (activeLayers.sat_science) enabledCategories.push('science');
    
    if (enabledCategories.length === 0) {
      setGeo('satellites', []);
      satRowsRef.current = [];
      satLayerRef.current?.setPoints([]);
      clearSat();
      return;
    }
    
    const filtered = sats.filter(s => s.category != null && enabledCategories.includes(s.category));
    setGeo('satellites', filtered.map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name, color: satColorFor(s.category, s.color, palette), mission: s.mission, alt: s.alt, noradId: s.noradId, category: s.category } })));
    satRowsRef.current = filtered;
    satLayerRef.current?.setPoints(toSatPoints(filtered));
    resyncSatSelection(filtered);
  }, [mapReady, data.satellites, activeLayers.satellites, activeLayers.sat_comms, activeLayers.sat_military, activeLayers.sat_navigation, activeLayers.sat_earth, activeLayers.sat_science, data.satellites_at, setGeo, toSatPoints, resyncSatSelection, clearSat]);

  useEffect(() => {
    if (!mapReady) return;
    // url has to travel with the feature: /api/gdelt gives every event its own
    // GDACS report link, and dropping it here is what left the popup with
    // nothing to link to.
    setGeo('gdelt', activeLayers.global_incidents && data.gdelt ? data.gdelt.map(e => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [e.lng, e.lat] }, properties: { name: e.name, url: e.url, kind: e.type } })) : []);
  }, [mapReady, data.gdelt, activeLayers.global_incidents, setGeo]);

  /* ── GDELT 2.0 Events ── */
  useEffect(() => {
    if (!mapReady) return;
    setGeo('gdelt-events', activeLayers.gdelt_events && data.gdelt_events ? data.gdelt_events.map(e => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.lng, e.lat] },
      properties: {
        name: e.name, country: e.country, quad: e.quad, quad_label: e.quad_label,
        tone: e.tone, goldstein: e.goldstein, articles: e.articles, url: e.url, date: e.date,
      },
    })) : []);
  }, [mapReady, data.gdelt_events, activeLayers.gdelt_events, setGeo]);




  useEffect(() => {
    if (!mapReady) return;
    const feature = (c: CatalogCamera) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { id: c.id, name: c.name, city: c.city, country: c.country, source: c.source, feed_url: c.feed_url, stream_url: c.stream_url, stream_type: c.stream_type, external_url: c.external_url } });
    const jm: CatalogCamera[] = [];
    const jakarta: CatalogCamera[] = [];
    const rest: CatalogCamera[] = [];
    for (const camera of data.cameras ?? []) {
      if (isJasaMargaCamera(camera)) jm.push(camera);
      else if (isTptCamera(camera)) jakarta.push(camera);
      else rest.push(camera);
    }
    setGeo('cctv', activeLayers.cctv ? rest.map(feature) : []);
    setGeo('cctv-jm', activeLayers.cctv_jm ? jm.map(feature) : []);
    setGeo('cctv-jakarta', activeLayers.cctv_jakarta ? jakarta.map(feature) : []);
  }, [mapReady, data.cameras, activeLayers.cctv, activeLayers.cctv_jm, activeLayers.cctv_jakarta, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('fires', activeLayers.fires && data.fires ? data.fires.map(f => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { brightness: f.brightness } })) : []);
  }, [mapReady, data.fires, activeLayers.fires, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('weather', activeLayers.weather && data.weather_events ? data.weather_events.map(w => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [w.lng, w.lat] }, properties: { title: w.title, type: w.type, icon: w.icon, severity: w.severity, source: w.source, id: w.id, description: w.description, infographic: w.infographic } })) : []);
  }, [mapReady, data.weather_events, activeLayers.weather, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('kotamaops', kotamaopsFeatures(data.kotamaops ?? [], (matra) => !!activeLayers[MATRA_LAYER[matra]]));
  }, [mapReady, data.kotamaops, activeLayers.tni_ad, activeLayers.tni_al, activeLayers.tni_au, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('maritime', activeLayers.maritime && data.maritime_ports ? data.maritime_ports.map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { name: p.name, country: p.country, type: p.type, volume: p.volume, fleet: p.fleet, rank: p.rank } })) : []);
    setGeo('maritime-choke', activeLayers.maritime && data.maritime_chokepoints ? data.maritime_chokepoints.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [c.lng, c.lat] }, properties: { name: c.name, traffic: c.traffic, risk: c.risk } })) : []);
    setGeo('maritime-ships', activeLayers.maritime && data.maritime_ships ? data.maritime_ships.map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lng, s.lat] }, properties: { name: s.name || s.mmsi?.toString(), type: s.type || 'cargo', speed: s.speed, heading: s.heading, destination: s.destination, flag: s.flag } })) : []);
  }, [mapReady, data.maritime_ports, data.maritime_chokepoints, data.maritime_ships, activeLayers.maritime, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('balloons', activeLayers.balloons && data.balloons ? data.balloons.map(b => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [b.lng, b.lat] }, properties: { callsign: b.callsign, type: b.type, status: b.status, altitude: b.altitude, speed: b.speed, verticalRate: b.verticalRate, temperature: b.temperature, color: b.color } })) : []);
  }, [mapReady, data.balloons, activeLayers.balloons, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('radiation', activeLayers.radiation && data.radiation ? data.radiation.map(r => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [r.lng, r.lat] }, properties: { name: r.name, city: r.city, country: r.country, reading: r.reading, status: r.status, network: r.network } })) : []);
  }, [mapReady, data.radiation, activeLayers.radiation, setGeo]);

  useEffect(() => {
    if (!mapReady) return;
    setGeo('live-news', activeLayers.live_news && data.live_feeds ? data.live_feeds.map(f => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [f.lng, f.lat] }, properties: { name: f.name, city: f.city, country: f.country, url: f.url, category: f.category, embed_allowed: f.embed_allowed !== false } })) : []);
  }, [mapReady, data.live_feeds, activeLayers.live_news, setGeo]);

  // Live Alert pins. Kept whole in the ref even when the layer is off, so the
  // feed's locate button can still open a report's pin.
  useEffect(() => {
    if (!mapReady) return;
    const reports: PinnedReport[] = Array.isArray(data.alert_pins) ? data.alert_pins : [];
    /* The feed hides what its filters exclude; the map follows it, so a search
       or a theatre filter narrows the pins to the reports being read. */
    const shown = alertPinIds ? new Set(alertPinIds) : null;
    const now = Date.now();

    const placed = reports.flatMap((n): { n: PinnedReport; lat: number; lng: number }[] => {
      if (!n?.place || !Array.isArray(n.coords)) return [];
      const [lat, lng] = n.coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
      if (shown && !shown.has(n.id)) return [];
      return [{ n, lat, lng }];
    });

    // How many reports name each place, so a town can say it carries several.
    const perPlace = new Map<string, number>();
    for (const { lat, lng } of placed) {
      const key = `${lat},${lng}`;
      perPlace.set(key, (perPlace.get(key) ?? 0) + 1);
    }

    alertPinsRef.current = placed.map(({ n, lat, lng }): AlertPinFeature => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: n.id,
        kind: n.alert_kind === 'rocket' || n.alert_kind === 'event' ? n.alert_kind : 'news',
        stack: perPlace.get(`${lat},${lng}`) ?? 1,
        fresh: now - Date.parse(n.published) < ALERT_FRESH_MS,
        title: n.title,
        source_name: n.source_name,
        lean: n.lean ?? '',
        published: n.published,
        link: n.link ?? '',
        place_name: n.place!.name,
        place_label: n.place!.label,
        precision: n.place!.precision,
        media_kind: n.media?.kind ?? '',
        video: n.media?.video ?? '',
        thumb: n.media?.thumb ?? '',
        duration: n.media?.duration ?? '',
      },
    }));
    setGeo('alert-pins', activeLayers.alert_pins ? alertPinsRef.current : []);
  }, [mapReady, data.alert_pins, activeLayers.alert_pins, alertPinIds, setGeo]);

  /* The newest reports pulse, so something that just landed catches the eye
     without the other pins moving. */
  useEffect(() => {
    if (!mapReady || !mapRef.current || !activeLayers.alert_pins) return;
    const map = mapRef.current;
    const tick = () => {
      try {
        map.setPaintProperty('alert-pin-pulse', 'circle-radius', 9 + Math.sin(Date.now() / 260) * 3.5);
        map.setPaintProperty('alert-pin-pulse', 'circle-stroke-opacity', 0.55 + Math.sin(Date.now() / 260) * 0.25);
      } catch { /* style not settled yet */ }
    };
    tick();
    const timer = setInterval(tick, 200);
    return () => clearInterval(timer);
  }, [mapReady, activeLayers.alert_pins]);


  // Visibility
  useEffect(() => {
    if (!mapReady) return;
    setVis(['eq-circles','eq-label'], activeLayers.earthquakes);
    const anySat = activeLayers.satellites || activeLayers.sat_comms || activeLayers.sat_military || activeLayers.sat_navigation || activeLayers.sat_earth || activeLayers.sat_science;
    // The circle layers stay hidden whatever the toggles say — the 3D layer
    // is the single representation, and showing both drew every satellite
    // twice, once flat on the ground and once at altitude.
    setVis(['sat-glow','sat-dots'], false);
    // Clearing the 3D layer is what actually turns satellites off.
    if (!anySat) { satRowsRef.current = []; satLayerRef.current?.setPoints([]); }
    setVis(['gdelt-dots'], activeLayers.global_incidents);
    setVis(['gdelt-events-dots'], activeLayers.gdelt_events);
    setVis(['day-night-fill'], activeLayers.day_night);
    setVis(['fl-commercial'], activeLayers.flights);
    setVis(['fl-private'], activeLayers.private);
    setVis(['fl-jets'], activeLayers.jets);
    setVis(['fl-military'], activeLayers.military);
    setVis(['cctv-glow','cctv-dots','cctv-label','cctv-cluster','cctv-cluster-count'], activeLayers.cctv);
    setVis(['cctv-jm-glow','cctv-jm-dots','cctv-jm-label','cctv-jm-cluster','cctv-jm-cluster-count'], activeLayers.cctv_jm !== false);
    setVis(['cctv-jakarta-glow','cctv-jakarta-dots','cctv-jakarta-label','cctv-jakarta-cluster','cctv-jakarta-cluster-count'], activeLayers.cctv_jakarta !== false);
    setVis(['fires-heat'], activeLayers.fires);
    setVis(['weather-glow','weather-dots','weather-label'], activeLayers.weather);
    setVis(['maritime-glow','maritime-dots','maritime-label'], activeLayers.maritime);
    setVis(['choke-glow','choke-dots','choke-label'], activeLayers.maritime);
    setVis(['ship-dots','ship-label'], activeLayers.maritime);
    setVis(['news-glow','news-dots','news-label'], activeLayers.live_news);
    setVis(['alert-pin-glow','alert-pin-dots','alert-pin-label','alert-pin-pulse','alert-pin-selected'], activeLayers.alert_pins);

    setVis(['balloon-dots','balloon-label'], activeLayers.balloons);
    setVis(['rad-glow','rad-dots','rad-label'], activeLayers.radiation);
  }, [mapReady, activeLayers, setVis]);

  // Projection changes are independent of terrain. Toggling elevation must not
  // zoom, tilt, or reposition the camera the user has already chosen.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    try {
      const projectionChanged = applyMapProjection(map, projection, terrainEnabled);
      const configureSky = projectionChanged || !containerRef.current?.dataset.mapProjection;
      if (containerRef.current) containerRef.current.dataset.mapProjection = projection;
      if (projection === 'globe') {
        // The overview globe's resting tilt, which used to be the initial
        // pitch. Only on a real projection change, so toggling terrain never
        // re-tilts a camera the user has already placed.
        if (configureSky && map.getPitch() < 0.5) map.easeTo({ pitch: 20, duration: 1200 });
        try {
          if (configureSky) map.setSky({
            'sky-color': '#0A0D16',
            'sky-horizon-blend': 0.5,
            'horizon-color': '#141a2a',
            'horizon-fog-blend': 0.3,
            'fog-color': '#0A0D16',
            'fog-ground-blend': 0.9,
          });
        } catch (e) { console.warn('[OSIRIS] Suppressed error:', e instanceof Error ? e.message : e); }
      } else {
        if (map.getPitch() > 0.5) map.easeTo({ pitch: 0, duration: 350 });
      }
    } catch (e) {
      console.warn('Projection switch failed:', e);
    }
  }, [mapReady, projection, terrainEnabled]);

  // Terrain loads only at regional zooms; globe overview stays inexpensive.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainEnabled) return;
    const map = mapRef.current;
    installTerrainTileProtocol(maplibregl.addProtocol);
    const dispose = attachTerrain(map, status => onTerrainStatusChange?.(status));
    return () => {
      // The map constructor effect removes the entire map first on unmount.
      if (mapRef.current === map) dispose();
    };
  }, [mapReady, terrainEnabled, terrainRetry, onTerrainStatusChange]);

  // A user-requested close-up keeps the current location and avoids a fly-out arc.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !terrainFocus || !terrainEnabled || lastTerrainFocus.current === terrainFocus) return;
    lastTerrainFocus.current = terrainFocus;
    const map = mapRef.current;
    map.easeTo({ zoom: Math.max(10.5, map.getZoom()), pitch: 45, duration: 650 });
  }, [mapReady, terrainFocus, terrainEnabled]);

  // Fly-to
  useEffect(() => {
    if (!mapReady || !mapRef.current || !flyToLocation) return;
    const map = mapRef.current;
    const target = { center: [flyToLocation.lng, flyToLocation.lat] as [number, number], zoom: flyToLocation.zoom ?? 8, duration: flyToLocation.duration ?? 2000 };
    const here = map.getCenter();
    /* flyTo on the globe throws (singular matrix) when the centre does not move, e.g. NKRI → NKRI; zoom in place instead. */
    if (Math.abs(here.lng - target.center[0]) < 1e-6 && Math.abs(here.lat - target.center[1]) < 1e-6) map.easeTo(target);
    else map.flyTo(target);
    const alertId = flyToLocation.alertId;
    if (!alertId) return;
    const open = () => openAlertPinRef.current?.(alertId);
    map.once('moveend', open);
    return () => { map.off('moveend', open); };
  }, [mapReady, flyToLocation]);

  // 3D buildings are independent of the elevation renderer.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const enabled = activeLayers.terrain_3d;

    try {
      if (enabled) {
        // CARTO's already-loaded vector tiles include the building footprints
        // and render heights. No second worldwide vector source is needed.

        // ── 3D BUILDING EXTRUSION LAYER ──
        if (!map.getLayer('osiris-3d-buildings')) {
          map.addLayer({
            id: 'osiris-3d-buildings',
            source: 'carto',
            'source-layer': 'building',
            type: 'fill-extrusion',
            minzoom: 14.5,
            paint: {
              'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'render_height'],
                0, '#1a1a2e',
                20, '#16213e',
                50, '#0f3460',
                120, '#533483',
                300, '#e94560',
              ],
              'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15.5, ['get', 'render_height']
              ],
              'fill-extrusion-base': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15.5, ['get', 'render_min_height']
              ],
              'fill-extrusion-opacity': [
                'interpolate', ['linear'], ['zoom'],
                14.5, 0,
                15, 0.7,
              ],
            },
          });
        }

        // Pitch the camera to reveal the 3D skyline
        if (map.getPitch() < 40) {
          map.easeTo({ pitch: 50, duration: 1200 });
        }

      } else {
        // ── DISABLE 3D ──
        if (map.getLayer('osiris-3d-buildings')) map.removeLayer('osiris-3d-buildings');
      }
    } catch (e) {
      console.warn('[OSIRIS] 3D terrain toggle error:', e);
    }
  }, [mapReady, activeLayers.terrain_3d]);

  // Satellite / Dark style switching
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    try {
      if (mapStyle !== 'dark') {
        // Add satellite raster tiles
        if (!map.getSource('satellite-tiles')) {
          map.addSource('satellite-tiles', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            maxzoom: 18,
          });
        }
        if (!map.getLayer('satellite-layer')) {
          map.addLayer({ id: 'satellite-layer', type: 'raster', source: 'satellite-tiles', paint: { 'raster-opacity': 0.85 } }, 'day-night-fill');
        } else {
          map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }
      } else {
        if (map.getLayer('satellite-layer')) {
          map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        }
      }
    } catch (e) {
      console.warn('Style switch failed:', e);
    }
  }, [mapReady, mapStyle]);

  // ── DRAWN POLYGONS ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const currentPolygons = drawnPolygons || [];
    const currentIds = currentPolygons.map(p => p.id);
    
    prevDrawnPolygonsRef.current.forEach(id => {
      if (!currentIds.includes(id)) {
        if (map.getLayer(`drawn-polygon-label-${id}`)) map.removeLayer(`drawn-polygon-label-${id}`);
        if (map.getLayer(`drawn-polygon-line-${id}`)) map.removeLayer(`drawn-polygon-line-${id}`);
        if (map.getLayer(`drawn-polygon-fill-${id}`)) map.removeLayer(`drawn-polygon-fill-${id}`);
        if (map.getSource(`drawn-polygon-${id}-label`)) map.removeSource(`drawn-polygon-${id}-label`);
        if (map.getSource(`drawn-polygon-${id}`)) map.removeSource(`drawn-polygon-${id}`);
      }
    });
    prevDrawnPolygonsRef.current = currentIds;

    currentPolygons.forEach(poly => {
      const sourceId = `drawn-polygon-${poly.id}`;
      const fillLayerId = `drawn-polygon-fill-${poly.id}`;
      const lineLayerId = `drawn-polygon-line-${poly.id}`;
      const labelLayerId = `drawn-polygon-label-${poly.id}`;

      // Build a centroid point feature for the label. A Polygon nests its ring
      // one level deeper than a LineString, so the label of a path would sit at
      // 0,0 if both were read the same way.
      const geom = poly.geojson.geometry;
      const ring = geom.type === 'LineString' ? geom.coordinates : (geom.coordinates[0] ?? []);
      const centroid: [number, number] = ring.length > 0 ? [
        ring.reduce((s, c) => s + c[0], 0) / ring.length,
        ring.reduce((s, c) => s + c[1], 0) / ring.length,
      ] : [0, 0];
      const labelFC = { type: 'FeatureCollection' as const, features: [{ type: 'Feature' as const, properties: { name: poly.name }, geometry: { type: 'Point' as const, coordinates: centroid } }] };

      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data: poly.geojson });
      } else {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(poly.geojson);
      }
      if (!map.getSource(`${sourceId}-label`)) {
        map.addSource(`${sourceId}-label`, { type: 'geojson', data: labelFC });
      } else {
        (map.getSource(`${sourceId}-label`) as maplibregl.GeoJSONSource).setData(labelFC);
      }

      if (!map.getLayer(fillLayerId)) {
        map.addLayer({ id: fillLayerId, type: 'fill', source: sourceId, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': poly.color, 'fill-opacity': 0.12 } });
      }
      if (!map.getLayer(lineLayerId)) {
        map.addLayer({ id: lineLayerId, type: 'line', source: sourceId, paint: { 'line-color': poly.color, 'line-width': 2.5, 'line-dasharray': [6, 3] } });
      }
      if (!map.getLayer(labelLayerId)) {
        map.addLayer({ id: labelLayerId, type: 'symbol', source: `${sourceId}-label`, layout: { 'text-field': ['get', 'name'], 'text-size': 11, 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': poly.color, 'text-halo-color': '#000000', 'text-halo-width': 2 } });
      }
    });
  }, [mapReady, drawnPolygons]);

  // ── DIRECTIONS ROUTE ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const SRC = 'directions-route';
    const SRC_ALT = 'directions-alternates';
    const SRC_ACTIVE = 'directions-active-step';
    const SRC_ENDS = 'directions-endpoints';
    const IDS = [
      'directions-alt-line', 'directions-line-casing', 'directions-line',
      'directions-active-line', 'directions-endpoint-halo', 'directions-endpoint',
    ];

    const teardown = () => {
      IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      [SRC, SRC_ALT, SRC_ACTIVE, SRC_ENDS].forEach(id => { if (map.getSource(id)) map.removeSource(id); });
    };

    if (!route?.geometry?.coordinates?.length) { teardown(); return; }

    const fc = (features: GeoJSON.Feature[]) => ({ type: 'FeatureCollection' as const, features });
    const line = (coords: [number, number][]): GeoJSON.Feature => ({
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: coords },
    });
    const setData = (id: string, data: unknown) => {
      if (!map.getSource(id)) map.addSource(id, { type: 'geojson', data: data as never });
      else (map.getSource(id) as maplibregl.GeoJSONSource).setData(data as never);
    };

    setData(SRC, fc([line(route.geometry.coordinates)]));
    setData(SRC_ALT, fc((route.alternates || []).map(a => line(a.coordinates))));
    setData(SRC_ACTIVE, fc(route.activeSegment?.length ? [line(route.activeSegment)] : []));
    setData(SRC_ENDS, fc([
      { type: 'Feature', properties: { kind: 'origin' }, geometry: { type: 'Point', coordinates: [route.from.lng, route.from.lat] } },
      { type: 'Feature', properties: { kind: 'destination' }, geometry: { type: 'Point', coordinates: [route.to.lng, route.to.lat] } },
    ]));

    // Alternatives sit underneath, muted, so the chosen line stays unambiguous.
    if (!map.getLayer('directions-alt-line')) {
      map.addLayer({
        id: 'directions-alt-line', type: 'line', source: SRC_ALT,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#5C6470',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 14, 5],
          'line-opacity': 0.55,
        },
      });
    }
    if (!map.getLayer('directions-line-casing')) {
      map.addLayer({
        id: 'directions-line-casing', type: 'line', source: SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#001014', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 5, 14, 11], 'line-opacity': 0.9 },
      });
    }
    if (!map.getLayer('directions-line')) {
      map.addLayer({
        id: 'directions-line', type: 'line', source: SRC,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#00E5FF',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.5, 14, 6],
          'line-opacity': 0.95,
        },
      });
    }
    if (!map.getLayer('directions-active-line')) {
      map.addLayer({
        id: 'directions-active-line', type: 'line', source: SRC_ACTIVE,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#D4AF37',
          'line-width': ['interpolate', ['linear'], ['zoom'], 5, 4, 14, 9],
          'line-opacity': 0.95,
        },
      });
    }
    if (!map.getLayer('directions-endpoint-halo')) {
      map.addLayer({
        id: 'directions-endpoint-halo', type: 'circle', source: SRC_ENDS,
        paint: {
          'circle-radius': 9,
          'circle-color': ['match', ['get', 'kind'], 'origin', '#00FF88', '#FF3B30'],
          'circle-opacity': 0.18,
        },
      });
    }
    if (!map.getLayer('directions-endpoint')) {
      map.addLayer({
        id: 'directions-endpoint', type: 'circle', source: SRC_ENDS,
        paint: {
          'circle-radius': 5,
          'circle-color': ['match', ['get', 'kind'], 'origin', '#00FF88', '#FF3B30'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#001014',
        },
      });
    }
  }, [mapReady, route]);

  // ── ROUTE FRAMING ──
  // Kept apart from drawing so picking a step or an alternative redraws without
  // yanking the camera back out to the whole route.
  const routeFrameKey = route
    ? `${route.from.lat},${route.from.lng},${route.to.lat},${route.to.lng},${route.geometry.coordinates.length}`
    : null;
  useEffect(() => {
    if (!mapReady || !mapRef.current || !route?.geometry?.coordinates?.length) return;
    const coords = route.geometry.coordinates;
    let [west, south, east, north] = [coords[0][0], coords[0][1], coords[0][0], coords[0][1]];
    for (const [lng, lat] of coords) {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
    mapRef.current.fitBounds([[west, south], [east, north]], { padding: 90, duration: 900, maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, routeFrameKey]);

  // ── LIVE USER LOCATION ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const SRC = 'user-location';
    const SRC_ACC = 'user-location-accuracy';
    const IDS = ['user-accuracy-fill', 'user-accuracy-line', 'user-dot-pulse', 'user-dot', 'user-dot-core'];

    if (!userLocation) {
      IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      [SRC, SRC_ACC].forEach(id => { if (map.getSource(id)) map.removeSource(id); });
      return;
    }

    const { lat, lng, accuracy } = userLocation;

    // Accuracy is a real-world radius, so it must be a polygon in degrees
    // rather than a fixed pixel circle — it has to shrink as you zoom out.
    const ring: [number, number][] = [];
    const r = Math.min(Math.max(accuracy ?? 0, 0), 5000);
    if (r > 0) {
      const dLat = r / 111320;
      const dLng = r / (111320 * Math.cos((lat * Math.PI) / 180) || 1);
      for (let i = 0; i <= 64; i++) {
        const t = (i / 64) * 2 * Math.PI;
        ring.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
      }
    }

    const point = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } }],
    };
    const accFc = {
      type: 'FeatureCollection',
      features: ring.length
        ? [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }]
        : [],
    };

    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: point as never });
    else (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(point as never);
    if (!map.getSource(SRC_ACC)) map.addSource(SRC_ACC, { type: 'geojson', data: accFc as never });
    else (map.getSource(SRC_ACC) as maplibregl.GeoJSONSource).setData(accFc as never);

    if (!map.getLayer('user-accuracy-fill')) {
      map.addLayer({ id: 'user-accuracy-fill', type: 'fill', source: SRC_ACC, paint: { 'fill-color': '#4285F4', 'fill-opacity': 0.12 } });
    }
    if (!map.getLayer('user-accuracy-line')) {
      map.addLayer({ id: 'user-accuracy-line', type: 'line', source: SRC_ACC, paint: { 'line-color': '#4285F4', 'line-width': 1, 'line-opacity': 0.35 } });
    }
    if (!map.getLayer('user-dot-pulse')) {
      map.addLayer({ id: 'user-dot-pulse', type: 'circle', source: SRC, paint: { 'circle-radius': 8, 'circle-color': '#4285F4', 'circle-opacity': 0.35 } });
    }
    if (!map.getLayer('user-dot')) {
      map.addLayer({ id: 'user-dot', type: 'circle', source: SRC, paint: { 'circle-radius': 7, 'circle-color': '#FFFFFF' } });
    }
    if (!map.getLayer('user-dot-core')) {
      map.addLayer({ id: 'user-dot-core', type: 'circle', source: SRC, paint: { 'circle-radius': 5, 'circle-color': '#4285F4' } });
    }
  }, [mapReady, userLocation]);

  // Pulse the halo. rAF-driven, so it stops when the tab is backgrounded.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !userLocation) return;
    const map = mapRef.current;
    let raf = 0;
    const started = performance.now();
    const tick = (now: number) => {
      if (map.getLayer('user-dot-pulse')) {
        const t = ((now - started) % 2000) / 2000;
        map.setPaintProperty('user-dot-pulse', 'circle-radius', 8 + t * 22);
        map.setPaintProperty('user-dot-pulse', 'circle-opacity', 0.35 * (1 - t));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mapReady, userLocation]);

  // ── FOLLOW MODE ──
  useEffect(() => {
    if (!mapReady || !mapRef.current || !followUser) return;
    const map = mapRef.current;
    // originalEvent is only set when a real input device drove the change, so
    // the easeTo below cannot trip this and cancel its own follow.
    const onGesture = (e: maplibregl.MapMovementEvent) => { if (e.originalEvent) onFollowInterrupt?.(); };
    map.on('dragstart', onGesture);
    map.on('zoomstart', onGesture);
    map.on('rotatestart', onGesture);
    map.on('pitchstart', onGesture);
    return () => {
      map.off('dragstart', onGesture);
      map.off('zoomstart', onGesture);
      map.off('rotatestart', onGesture);
      map.off('pitchstart', onGesture);
    };
  }, [mapReady, followUser, onFollowInterrupt]);

  // Recentering runs on every position fix, so without the handover above the
  // map fights the operator: zoom out to look ahead and the next GPS tick drags
  // the camera back to 16.5. Follow itself is unchanged and resumes on recenter.
  useEffect(() => {
    if (!mapReady || !mapRef.current || !followUser || !userLocation) return;
    // While navigating, sit close in and rotate the map so travel direction is
    // "up" — reading a turn off a north-locked map at speed does not work.
    mapRef.current.easeTo({
      center: [userLocation.lng, userLocation.lat],
      ...(navigating
        ? {
            zoom: Math.max(mapRef.current.getZoom(), 16.5),
            pitch: 50,
            ...(typeof userLocation.heading === 'number' && !Number.isNaN(userLocation.heading)
              ? { bearing: userLocation.heading }
              : {}),
          }
        : {}),
      duration: 700,
    });
  }, [mapReady, followUser, userLocation, navigating]);

  // Restore the selected view only when guidance ends, not on first map load.
  useEffect(() => {
    const ended = wasNavigating.current && !navigating;
    wasNavigating.current = navigating;
    if (!mapReady || !mapRef.current || !ended) return;
    const map = mapRef.current;
    const pitch = projection === 'mercator' ? 0 : activeLayers.terrain_3d ? 50 : terrainEnabled && map.getZoom() >= 10 ? 45 : 20;
    map.easeTo({ pitch, bearing: 0, duration: 600 });
  }, [mapReady, navigating, projection, terrainEnabled, activeLayers.terrain_3d]);

  // ── AIRPORTS FOR WATCHED AIRCRAFT ──
  // The endpoints that survived corroboration against the aircraft's reported
  // track — where the leg began and where it is booked to end.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const SRC = 'watched-airports';
    const IDS = ['watched-airport-glow', 'watched-airport-dot', 'watched-airport-label'];

    // The same airport can serve several watched aircraft — draw it once.
    const seen = new Set<string>();
    const features = Object.values(aircraftAirports).flat()
      .filter((a) => {
        if (!a || seen.has(a.icao)) return false;
        seen.add(a.icao);
        return true;
      })
      .map((a) => ({
        type: 'Feature' as const,
        properties: { label: a.iata || a.icao, city: a.city || '' },
        geometry: { type: 'Point' as const, coordinates: [a.lng, a.lat] },
      }));

    if (features.length === 0) {
      IDS.forEach((id) => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      return;
    }

    const fc = { type: 'FeatureCollection' as const, features };
    if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: fc as never });
    else (map.getSource(SRC) as maplibregl.GeoJSONSource).setData(fc as never);

    if (!map.getLayer('watched-airport-glow')) {
      map.addLayer({
        id: 'watched-airport-glow', type: 'circle', source: SRC,
        paint: { 'circle-radius': 13, 'circle-color': '#FFB300', 'circle-opacity': 0.16, 'circle-blur': 0.8 },
      });
    }
    if (!map.getLayer('watched-airport-dot')) {
      map.addLayer({
        id: 'watched-airport-dot', type: 'circle', source: SRC,
        paint: {
          'circle-radius': 5,
          'circle-color': '#FFFFFF',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFB300',
        },
      });
    }
    if (!map.getLayer('watched-airport-label')) {
      map.addLayer({
        id: 'watched-airport-label', type: 'symbol', source: SRC,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Open Sans Bold'],
          'text-offset': [0, 1.6],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#FFB300', 'text-halo-color': '#0C0E1A', 'text-halo-width': 1.5 },
      });
    }
  }, [mapReady, aircraftAirports]);

  // ── ARCGIS LAYERS ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;
    const currentLayers = arcgisLayers || [];
    const currentIds = currentLayers.map(l => l.id);

    prevArcgisLayersRef.current.forEach(id => {
      if (!currentIds.includes(id)) {
        const sourceId = `arcgis-${id}`;
        if (map.getLayer(`${sourceId}-fill`)) map.removeLayer(`${sourceId}-fill`);
        if (map.getLayer(`${sourceId}-line`)) map.removeLayer(`${sourceId}-line`);
        if (map.getLayer(`${sourceId}-circle`)) map.removeLayer(`${sourceId}-circle`);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      }
    });
    prevArcgisLayersRef.current = currentIds;

    currentLayers.forEach(layer => {
      const sourceId = `arcgis-${layer.id}`;
      const c = layer.color || '#D4AF37';
      const o = layer.opacity ?? 0.8;
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data: layer.geojson });
        // A fill layer with no geometry filter is applied to LineStrings too,
        // and maplibre fills an open path by closing it — which is what draws
        // the triangular wedges across a pipeline or railway dataset. Fill is
        // only ever meaningful for polygons.
        map.addLayer({ id: `${sourceId}-fill`, type: 'fill', source: sourceId, filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': c, 'fill-opacity': o * 0.15, 'fill-outline-color': c } });
        map.addLayer({ id: `${sourceId}-line`, type: 'line', source: sourceId, filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false], paint: { 'line-color': c, 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 1.4, 14, 2, 18, 3], 'line-opacity': o } });
        // A fixed radius does not survive a dense dataset: ~1.2k points at
        // city zoom merge into one blob. Scaling with zoom keeps them as
        // discrete stations when you are far out, and readable up close.
        map.addLayer({ id: `${sourceId}-circle`, type: 'circle', source: sourceId, filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': c, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1.5, 8, 2.5, 11, 4, 14, 6, 18, 9], 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 8, 0.4, 14, 1.2], 'circle-stroke-color': '#000', 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 6, 0.55, 12, 0.85] } });
      } else {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(layer.geojson);
        // Update paint properties for color/opacity changes
        if (map.getLayer(`${sourceId}-fill`)) {
          map.setPaintProperty(`${sourceId}-fill`, 'fill-color', c);
          map.setPaintProperty(`${sourceId}-fill`, 'fill-opacity', o * 0.15);
          map.setPaintProperty(`${sourceId}-fill`, 'fill-outline-color', c);
        }
        if (map.getLayer(`${sourceId}-line`)) {
          map.setPaintProperty(`${sourceId}-line`, 'line-color', c);
          map.setPaintProperty(`${sourceId}-line`, 'line-opacity', o);
        }
        if (map.getLayer(`${sourceId}-circle`)) {
          map.setPaintProperty(`${sourceId}-circle`, 'circle-color', c);
          map.setPaintProperty(`${sourceId}-circle`, 'circle-opacity', o);
        }
      }
    });
  }, [mapReady, arcgisLayers]);

  const drawCbRef = useRef({ onDrawComplete, onDrawProgress, onDrawCancel });
  /** Set by the drawing effect so on-screen buttons can dispatch into it. */
  const drawApplyRef = useRef<((a: DrawAction) => void) | null>(null);
  /* The draw handlers are bound once; refresh what they call after each render. */
  useEffect(() => {
    drawCbRef.current = { onDrawComplete, onDrawProgress, onDrawCancel };
  });

  // ── DRAWING MODE ──
  // A four-mode state machine over one set of map handlers.
  //
  // Every mode collects points; what differs is how many are needed and what
  // geometry they produce. Rectangle and circle are two-click shapes, so the
  // cursor stands in for their second point until it is committed — which is
  // what makes the preview and the final shape come from the same code path
  // instead of two that can disagree.
  //
  // Escape cancels, Backspace removes the last vertex, Enter or a double click
  // finishes. Drawing without an undo is the difference between a tool and a
  // demo: a misplaced vertex twenty clicks in should not cost the whole shape.
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const SRC = 'draw-temp-source';
    const IDS = ['draw-fill-temp', 'draw-line-temp', 'draw-points-temp'];

    const teardown = () => {
      IDS.forEach(id => { if (map.getLayer(id)) map.removeLayer(id); });
      if (map.getSource(SRC)) map.removeSource(SRC);
      drawingCoordsRef.current = [];
      map.getCanvas().style.cursor = '';
      map.doubleClickZoom.enable();
    };

    if (!drawMode) {
      teardown();
      drawCbRef.current.onDrawProgress?.(null);
      return;
    }

    map.doubleClickZoom.disable();
    map.getCanvas().style.cursor = 'crosshair';
    drawingCoordsRef.current = [];

    if (!map.getSource(SRC)) {
      map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'draw-fill-temp', type: 'fill', source: SRC,
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#00E5FF', 'fill-opacity': 0.12 },
      });
      map.addLayer({
        id: 'draw-line-temp', type: 'line', source: SRC,
        filter: ['match', ['geometry-type'], ['LineString', 'Polygon'], true, false],
        paint: { 'line-color': '#00E5FF', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
      map.addLayer({
        id: 'draw-points-temp', type: 'circle', source: SRC,
        filter: ['==', ['geometry-type'], 'MultiPoint'],
        paint: { 'circle-color': '#00E5FF', 'circle-radius': 4, 'circle-stroke-width': 1.5, 'circle-stroke-color': '#04040A' },
      });
    }

    // Declared before paint(), which closes over it. Leaving it below would
    // work only while no call happens in between — a temporal-dead-zone crash
    // waiting for someone to add one.
    let state: DrawState = initialDrawState(drawMode);

    /** Redraw the preview from committed points plus an optional cursor point. */
    const paint = (cursor?: [number, number]) => {
      const committed = state.points;
      const pts = cursor ? [...committed, cursor] : committed;
      const src = map.getSource(SRC) as maplibregl.GeoJSONSource;
      if (!src) return;

      drawCbRef.current.onDrawProgress?.(pts.length ? measure(drawMode, pts) : null);

      if (pts.length === 0) {
        src.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      const features: Array<{
        type: 'Feature';
        properties: Record<string, unknown>;
        geometry:
          | { type: 'MultiPoint' | 'LineString'; coordinates: number[][] }
          | { type: 'Polygon'; coordinates: number[][][] };
      }> = [
        { type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: committed } },
      ];

      const geom = buildGeometry(drawMode, pts);
      if (drawMode === 'line') {
        if (pts.length > 1) {
          features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom } });
        }
      } else if (geom.length >= 3) {
        // Show the enclosed area as it will be, not just its outline.
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [closeRing(geom)] } });
      } else if (geom.length === 2) {
        features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: geom } });
      }

      src.setData({ type: 'FeatureCollection', features: features as GeoJSON.Feature[] });
    };

    // The interaction lives in drawReducer, which is unit tested. This is the
    // adapter: map events in, reducer out, preview repainted.
    const apply = (action: DrawAction) => {
      const t = drawReducer(state, action);
      state = t.state;
      drawingCoordsRef.current = state.points;
      if (t.result) drawCbRef.current.onDrawComplete?.(t.result);
      if (t.cancelled) drawCbRef.current.onDrawCancel?.();
      paint();
    };

    let dblGuard = false;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      if (dblGuard) return;
      apply({ type: 'click', at: [e.lngLat.lng, e.lngLat.lat] });
    };

    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (state.points.length === 0) return;
      paint([e.lngLat.lng, e.lngLat.lat]);
    };

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      dblGuard = true;
      setTimeout(() => { dblGuard = false; }, 300);
      apply({ type: 'dblclick' });
    };

    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') { ev.preventDefault(); apply({ type: 'cancel' }); }
      else if (ev.key === 'Backspace' || ev.key === 'Delete') { ev.preventDefault(); apply({ type: 'undo' }); }
      else if (ev.key === 'Enter') { ev.preventDefault(); apply({ type: 'finish' }); }
    };
    drawApplyRef.current = apply;

    map.on('click', onClick);
    map.on('mousemove', onMove);
    map.on('dblclick', onDblClick);
    window.addEventListener('keydown', onKey);

    return () => {
      map.off('click', onClick);
      map.off('mousemove', onMove);
      map.off('dblclick', onDblClick);
      window.removeEventListener('keydown', onKey);
      drawApplyRef.current = null;
      teardown();
    };
  }, [mapReady, drawMode]);

  // Buttons dispatch into the same reducer the map events use, so a shape
  // finished by clicking "Finish" is identical to one finished by Enter.
  const lastCmdSeq = useRef(-1);
  useEffect(() => {
    if (!drawCommand || drawCommand.seq === lastCmdSeq.current) return;
    lastCmdSeq.current = drawCommand.seq;
    drawApplyRef.current?.({ type: drawCommand.action } as DrawAction);
  }, [drawCommand]);

  // ── MAP CENTER REPORTING ──
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const reportCenter = () => {
      const c = map.getCenter();
      const b = map.getBounds();
      onMapCenter?.({
        lat: c.lat,
        lng: c.lng,
        bounds: b ? { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() } : undefined,
      });
    };

    // Fire immediately so panels get initial coordinates
    reportCenter();

    map.on('moveend', reportCenter);
    return () => { map.off('moveend', reportCenter); };
  }, [mapReady, onMapCenter]);

  // Escape clears the selection, the way it cancels a draw — an overlay that
  // can only be dismissed by hitting a 14px target is one that stays open.
  useEffect(() => {
    if (!selectedSat) return;
    const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') clearSat(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSat, clearSat]);

  // Zooming past the ceiling takes the satellites off the map, so a readout
  // left over from before the zoom would be describing something no longer
  // there — and its ring and orbit are already gone.
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !selectedSat) return;
    const onZoom = () => { if (map.getZoom() > SAT_MAX_ZOOM) clearSat(); };
    onZoom();
    map.on('zoomend', onZoom);
    return () => { map.off('zoomend', onZoom); };
  }, [mapReady, selectedSat, clearSat]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />
      {/* mapReady is only set once the map exists; mapRef goes null only on unmount. */}
      {mapReady && (
        <CctvPreviews
          mapRef={mapRef}
          active={(!!activeLayers.cctv || !!activeLayers.cctv_jm || !!activeLayers.cctv_jakarta) && !!activeLayers.cctv_previews}
          onOpen={(cam: PreviewCamera) => onEntityClick?.({ type: 'cctv', ...cam })}
        />
      )}
      {mapReady && (
        <LiveNewsPreviews
          mapRef={mapRef}
          active={!!activeLayers.live_news}
          feeds={data.live_feeds}
          onOpen={(feed: PreviewFeed) => onEntityClick?.({
            type: 'live_news',
            name: feed.name,
            city: feed.city,
            country: feed.country,
            url: feed.url,
            category: feed.category,
            embed_allowed: true,
          })}
        />
      )}
      {selectedSat && <SatelliteCard sat={selectedSat} onClose={clearSat} />}
      {mapReady && <MapControls mapRef={mapRef} onInteract={onFollowInterrupt} />}
    </>
  );
}

export default memo(OsirisMap);
