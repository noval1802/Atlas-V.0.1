'use client';

import { memo, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, AlertTriangle, Camera,
  CloudLightning, Ship, Database, Ghost,
  Flame, Tv, Radio, Mountain, Anchor, Shield
} from 'lucide-react';
import type { ActiveLayers } from '@/lib/layer-feeds';
import { isGlobalCamera, isTollCamera, isTptCamera } from '@/lib/cctv-layers';
import { mapDataList, type MapData } from '@/lib/map-data';
import type { Matra } from '@/lib/kotamaops-points';
import { TERRAIN_MIN_ZOOM, type TerrainStatus } from '@/lib/map-terrain';

interface LayerPanelProps {
  data: MapData;
  activeLayers: ActiveLayers;
  setActiveLayers: React.Dispatch<React.SetStateAction<ActiveLayers>>;
  isMobile?: boolean;
  theme?: 'core' | 'ghost';
  setTheme?: (theme: 'core' | 'ghost') => void;
  terrainStatus?: TerrainStatus;
  onTerrainRetry?: () => void;
  onTerrainFocus?: () => void;
  on3DModeSelected?: () => void;
  /** False while the splash is up; the rail slides in when it turns true. */
  revealed?: boolean;
}

interface LayerDef {
  key: keyof ActiveLayers;
  label: string;
  dataKey: string;
  description?: string;
  /** Counts only the Kotamaops of this matra. */
  matra?: Matra;
  /** Key of the layer this one modifies. Renders indented beneath it. */
  parent?: keyof ActiveLayers;
  /** Indented under the row above for grouping only; switches on its own. */
  indent?: boolean;
  /** The row stays usable while any of these layers is on. Defaults to the parent. */
  enabledBy?: (keyof ActiveLayers)[];
  /** Count only cameras whose source matches. */
  source?: string;
  /** Count only the items this accepts. */
  match?: (item: Record<string, unknown>) => boolean;
}

/* Erupting volcanoes count under Erupsi only, so the five rows add up to the total. */
const volcanoAt = (level: number) => (v: Record<string, unknown>) => v.level === level && v.erupting !== true;

interface LayerGroupDef {
  label: string;
  fullLabel: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  layers: LayerDef[];
}

const LAYER_GROUPS: LayerGroupDef[] = [
  {
    label: 'KOTAMAOPS',
    fullLabel: 'Kotamaops',
    icon: Shield,
    layers: [
      { key: 'tni_ad', label: 'TNI AD', dataKey: 'kotamaops', matra: 'AD' },
      { key: 'tni_al', label: 'TNI AL', dataKey: 'kotamaops', matra: 'AL' },
      { key: 'tni_au', label: 'TNI AU', dataKey: 'kotamaops', matra: 'AU' },
    ],
  },
  {
    label: 'MARITIME',
    fullLabel: 'MARITIM',
    icon: Ship,
    layers: [
      { key: 'maritime', label: 'Kapal & Pelabuhan', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
    ],
  },
  {
    label: 'SURVEIL',
    fullLabel: 'PEMANTAUAN CCTV',
    icon: Camera,
    layers: [
      { key: 'cctv_previews', label: 'Pratinjau Langsung', dataKey: '', enabledBy: ['cctv', 'cctv_jm', 'cctv_jakarta', 'cctv_global'] },
      { key: 'cctv_global', label: 'GLOBAL', dataKey: 'cameras', match: isGlobalCamera, indent: true },
      { key: 'cctv_jm', label: 'CCTV TOL', dataKey: 'cameras', match: isTollCamera, indent: true },
      { key: 'cctv', label: 'CCTV KOTA', dataKey: 'cameras', match: c => !isGlobalCamera(c) && !isTollCamera(c) && !isTptCamera(c), indent: true },
      { key: 'cctv_jakarta', label: 'CCTV JAKARTA', dataKey: 'cameras', source: 'TPT CCTV', indent: true },
      { key: 'live_news', label: 'Siaran Berita Langsung', dataKey: 'live_feeds', indent: true },
    ],
  },
  {
    label: 'HAZARD',
    fullLabel: 'BENCANA ALAM',
    icon: CloudLightning,
    layers: [
      { key: 'earthquakes', label: 'Gempa Bumi', dataKey: 'earthquakes' },
      { key: 'fires', label: 'Titik Api', dataKey: 'fires' },
      { key: 'volcanoes', label: 'Gunung Api (MAGMA)', dataKey: 'volcanoes' },
      { key: 'volcano_l1', label: 'Level I · Normal', dataKey: 'volcanoes', parent: 'volcanoes', match: volcanoAt(1) },
      { key: 'volcano_l2', label: 'Level II · Waspada', dataKey: 'volcanoes', parent: 'volcanoes', match: volcanoAt(2) },
      { key: 'volcano_l3', label: 'Level III · Siaga', dataKey: 'volcanoes', parent: 'volcanoes', match: volcanoAt(3) },
      { key: 'volcano_l4', label: 'Level IV · Awas', dataKey: 'volcanoes', parent: 'volcanoes', match: volcanoAt(4) },
      { key: 'volcano_erupt', label: 'Erupsi', description: 'Sedang erupsi, apa pun levelnya', dataKey: 'volcanoes', parent: 'volcanoes', match: v => v.erupting === true },
      { key: 'weather', label: 'Cuaca Ekstrem', dataKey: 'weather_events' },
    ],
  },
  {
    label: 'THREAT',
    fullLabel: 'ANCAMAN & INTELIJEN',
    icon: AlertTriangle,
    layers: [
      { key: 'global_incidents', label: 'Insiden Global', dataKey: 'gdelt' },
      { key: 'alert_pins', label: 'Pin Peringatan Langsung', dataKey: 'alert_pins' },
      { key: 'gdelt_events', label: 'Peristiwa GDELT', dataKey: 'gdelt_events' },
    ],
  },
  {
    label: 'DISPLAY',
    fullLabel: 'TAMPILAN',
    icon: Sun,
    layers: [
      { key: 'day_night', label: 'Siang / Malam', dataKey: '' },
      { key: 'terrain_3d', label: 'Gedung 3D', description: 'Detail kota · zoom 14.5+', dataKey: '' },
      { key: 'terrain_elevation', label: 'Relief 3D', description: 'Pegunungan · zoom 10+', dataKey: '' },
    ],
  },
];

/* ── Minimal Toggle Switch ── */
/**
 * Presentational only. The row around it is the button, and a button inside a
 * button is invalid HTML — the browser reparents it, which breaks hydration and
 * silently drops the click handler on the inner control.
 */
function ToggleSwitch({ active }: { active: boolean }) {
  return (
    <span
      role="presentation"
      className="relative flex-shrink-0 block"
      style={{ width: 28, height: 14 }}
    >
      <div
        className="absolute inset-0 rounded-full transition-all duration-300"
        style={{
          background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
          border: active ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.12)',
          boxShadow: active ? '0 0 8px rgba(255,255,255,0.1)' : 'none',
        }}
      />
      <motion.div
        className="absolute top-[2px] rounded-full"
        style={{
          width: 10,
          height: 10,
          background: active ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)',
          boxShadow: active ? '0 0 6px rgba(255,255,255,0.4)' : 'none',
        }}
        animate={{ left: active ? 16 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </span>
  );
}

/**
 * The elbow that ties a sub-layer row to the layer above it. Indentation alone
 * reads as a typo at this size; the line is what says "this belongs to that".
 */
function SubLayerStem() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-[6px] top-0 h-1/2 w-[8px] rounded-bl-[3px] border-b border-l border-white/[0.14]"
    />
  );
}

function LayerPanel({ data, activeLayers, setActiveLayers, isMobile, theme = 'core', setTheme, terrainStatus = 'idle', onTerrainRetry, onTerrainFocus, on3DModeSelected, revealed = true }: LayerPanelProps) {
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  /**
   * A pinned group stays open when the pointer leaves. Hover-only flyouts are
   * fine to glance at and impossible to work in — reaching for a toggle at the
   * far edge closes the thing you were reaching for.
   */
  const [pinnedGroup, setPinnedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!pinnedGroup) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinnedGroup(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinnedGroup]);

  const toggle = (key: keyof ActiveLayers) => {
    if ((key === 'terrain_elevation' || key === 'terrain_3d') && !activeLayers[key]) on3DModeSelected?.();
    setActiveLayers(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const terrainDetails = activeLayers.terrain_elevation ? (
    <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[10px] text-white/60">
      <p role="status">{terrainStatus === 'idle' ? `Relief muncul di zoom ${TERRAIN_MIN_ZOOM}+ · perbesar peta` : terrainStatus === 'waiting' ? 'Relief dimuat saat peta berhenti bergerak' : terrainStatus === 'loading' ? 'Memuat relief di sekitar…' : terrainStatus === 'error' ? 'Relief tidak tersedia; peta tetap bisa dipakai.' : 'Relief aktif'}</p>
      {terrainStatus === 'idle' && <button type="button" onClick={onTerrainFocus} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">Perbesar ke relief</button>}
      {terrainStatus === 'error' && <button type="button" onClick={onTerrainRetry} className="mt-2 min-h-8 rounded border border-white/15 px-2 text-[var(--gold-primary)] hover:bg-white/10">Coba lagi</button>}
      <p className="mt-2 text-white/35">Nearby detail only · cached tiles</p>
      <a className="mt-1 inline-block underline underline-offset-2" href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener noreferrer">Sumber data relief</a>
    </div>
  ) : null;

  /** Switch a whole group at once — off if any are on, otherwise all on. */
  const toggleGroup = (layers: LayerDef[]) => {
    const anyOn = layers.some(l => activeLayers[l.key]);
    if (!anyOn && layers.some(l => l.key === 'terrain_elevation' || l.key === 'terrain_3d')) on3DModeSelected?.();
    setActiveLayers(prev => {
      const next = { ...prev };
      for (const l of layers) next[l.key] = !anyOn;
      return next;
    });
  };

  const visibleGroups = LAYER_GROUPS;

  const getCount = (layer: LayerDef): number | null => {
    if (!layer.dataKey) return null;
    if (layer.matra) return (data.kotamaops ?? []).filter((point) => point.matra === layer.matra).length;
    let total = 0;
    let found = false;
    for (const k of layer.dataKey.split(',')) {
      const list = mapDataList(data, k);
      if (list) {
        found = true;
        total += list.filter((item: { source?: unknown }) => {
          if (layer.match) return layer.match(item as Record<string, unknown>);
          if (layer.source) return item?.source === layer.source;
          return true;
        }).length;
      }
    }
    return found ? total : null;
  };

  const layerDormant = (layer: LayerDef) => {
    const gates = layer.enabledBy ?? (layer.parent ? [layer.parent] : []);
    return gates.length > 0 && gates.every(key => !activeLayers[key]);
  };

  /* ── MOBILE ── */
  if (isMobile) {
    return (
      <div className="flex flex-col gap-5 py-2">
        {visibleGroups.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <div className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/30 border-b border-white/[0.06] pb-1.5">
              {group.fullLabel}
            </div>
            <div className="flex flex-col gap-1">
              {group.layers.map((layer) => {
                const isLayerActive = activeLayers[layer.key];
                const count = getCount(layer);
                const dormant = layerDormant(layer);
                return (
                  <button
                    key={layer.key}
                    onClick={() => toggle(layer.key)}
                    aria-pressed={!!isLayerActive}
                    aria-label={layer.label}
                    className={`relative w-full flex items-center gap-3 py-2 rounded-md text-left hover:bg-white/[0.04] transition-colors ${layer.parent || layer.indent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-40' : ''}`}
                  >
                    {(layer.parent || layer.indent) && <SubLayerStem />}
                    <ToggleSwitch active={!!isLayerActive} />
                    <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors ${isLayerActive ? 'text-white/80' : 'text-white/40'}`}>
                      {layer.label}
                      {layer.description && <span className="block mt-0.5 text-[9px] normal-case tracking-normal text-white/35">{layer.description}</span>}
                    </span>
                    {count !== null && (
                      <span className="text-[10px] font-mono tabular-nums text-white/25">
                        {count.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
              {group.label === 'DISPLAY' && terrainDetails}
            </div>
          </div>
        ))}

        {/* MOBILE GHOST TOGGLE */}
        {setTheme && (
          <div className="flex items-center justify-between pt-3 border-t border-white/[0.06] px-1">
            <span className="text-[10px] font-mono tracking-[0.2em] text-white/25 uppercase">Mode Ghost</span>
            <button
              onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{
                background: theme === 'ghost' ? 'rgba(179, 136, 255, 0.15)' : 'transparent',
                boxShadow: theme === 'ghost' ? '0 0 12px rgba(179, 136, 255, 0.3)' : 'none',
              }}
            >
              <Ghost className="w-4 h-4" style={{ color: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.25)' }} />
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ── DESKTOP ── */
  return (
    <motion.div
      initial={{ x: -60, opacity: 0 }}
      animate={revealed ? { x: 0, opacity: 1 } : { x: -60, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 200, delay: 0.25 }}
      className="absolute top-0 left-0 h-full w-[48px] flex flex-col items-center pt-24 pb-6 z-50 pointer-events-auto"
      style={{
        background: 'rgba(0,0,0,0.15)',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
      }}
    >
      <div className="flex-1 flex flex-col items-center gap-1">
        {visibleGroups.map((group) => {
          /* Sub-layers and modifiers (enabledBy) change other layers rather than draw
             anything of their own, so they do not count towards the rail's reading. */
          const counted = group.layers.filter(l => !l.parent && !l.enabledBy);
          const groupActive = counted.some(l => activeLayers[l.key]);
          const isHovered = hoveredGroup === group.label;
          const Icon = group.icon;

          const activeCount = counted.filter(l => activeLayers[l.key]).length;
          const isPinned = pinnedGroup === group.label;
          const isOpen = isHovered || isPinned;

          return (
            <div
              key={group.label}
              className="relative flex items-center justify-center"
              onMouseEnter={() => setHoveredGroup(group.label)}
              onMouseLeave={() => setHoveredGroup(null)}
            >
              {/* A real button, not a div: this is keyboard reachable, focusable
                  and announced. Clicking pins the flyout open so it can be
                  worked in rather than only glanced at. */}
              <button
                onClick={() => setPinnedGroup(isPinned ? null : group.label)}
                aria-expanded={isOpen}
                aria-label={`${group.fullLabel}${activeCount ? ` — ${activeCount} aktif` : ''}`}
                title={group.fullLabel}
                className="relative w-10 h-10 flex items-center justify-center cursor-pointer rounded-lg transition-all duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                style={{
                  background: isPinned
                    ? 'rgba(255,255,255,0.10)'
                    : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}
              >
                <Icon
                  className="transition-all duration-300"
                  style={{
                    width: 16,
                    height: 16,
                    color: groupActive
                      ? 'rgba(255,255,255,0.75)'
                      : isOpen
                        ? 'rgba(255,255,255,0.45)'
                        : 'rgba(255,255,255,0.22)',
                    filter: groupActive ? 'drop-shadow(0 0 4px rgba(255,255,255,0.3))' : 'none',
                  }}
                />

                {/* How many layers in this group are live. Without it the rail
                    gives no reading at all until each icon is hovered in turn. */}
                {activeCount > 0 && (
                  <span
                    className="absolute top-1 right-1 min-w-[13px] h-[13px] px-[3px] rounded-full flex items-center justify-center text-[9px] font-mono tabular-nums leading-none"
                    style={{
                      background: 'rgba(0,229,255,0.9)',
                      color: '#04040A',
                      boxShadow: '0 0 6px rgba(0,229,255,0.5)',
                    }}
                  >
                    {activeCount}
                  </span>
                )}
              </button>

              {/* Flyout (LEFT side) */}
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ opacity: 0, x: -8, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -4, filter: 'blur(2px)' }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute left-[52px] -top-2 min-w-[220px] rounded-xl p-3 z-[100] pointer-events-auto"
                    style={{
                      /* Opaque enough that the HUD title behind the top groups does not bleed through. */
                      background: 'rgba(0,0,0,0.88)',
                      backdropFilter: 'blur(40px) saturate(1.5)',
                      WebkitBackdropFilter: 'blur(40px) saturate(1.5)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2.5 pb-1.5 border-b border-white/[0.04]">
                      <span className="text-[10px] font-mono tracking-[0.2em] uppercase text-white/35 flex-1">
                        {group.fullLabel}
                      </span>
                      {/* One click switches the whole group instead of each layer in turn. */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleGroup(group.layers); }}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wider text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        {activeCount > 0 ? 'MATIKAN' : 'SEMUA'}
                      </button>
                      {isPinned && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPinnedGroup(null); }}
                          aria-label="Tutup"
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {group.layers.map((layer) => {
                        const isLayerActive = activeLayers[layer.key];
                        const count = getCount(layer);
                        const dormant = layerDormant(layer);

                        return (
                          <button
                            key={layer.key}
                            onClick={() => toggle(layer.key)}
                            aria-pressed={!!isLayerActive}
                            aria-label={layer.label}
                            title={dormant ? 'Aktifkan layer di atasnya untuk memakai ini' : undefined}
                            className={`relative w-full flex items-center gap-3 py-1.5 rounded-md hover:bg-white/[0.05] transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30 ${layer.parent || layer.indent ? 'pl-[22px] pr-1' : 'px-1'} ${dormant ? 'opacity-40' : ''}`}
                          >
                            {(layer.parent || layer.indent) && <SubLayerStem />}
                            <ToggleSwitch active={!!isLayerActive} />
                            <span className={`text-[11px] font-mono uppercase tracking-wider flex-1 transition-colors duration-200 ${isLayerActive ? 'text-white/70' : 'text-white/35'}`}>
                              {layer.label}
                              {layer.description && <span className="block mt-0.5 text-[9px] normal-case tracking-normal text-white/35">{layer.description}</span>}
                            </span>
                            {count !== null && (
                              <span className={`text-[10px] font-mono tabular-nums transition-colors ${isLayerActive ? 'text-white/45' : 'text-white/20'}`}>
                                {count.toLocaleString()}
                              </span>
                            )}
                          </button>
                        );
                      })}
                      {group.label === 'DISPLAY' && terrainDetails}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Subtle separator */}
      <div className="w-5 h-px bg-white/[0.06] my-2" />

      {/* Ghost Protocol Toggle */}
      {setTheme && (
        <button
          onClick={() => setTheme(theme === 'core' ? 'ghost' : 'core')}
          className="w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-500 cursor-pointer"
          style={{
            background: theme === 'ghost' ? 'rgba(179, 136, 255, 0.1)' : 'transparent',
          }}
          title="Ghost Protocol"
        >
          <Ghost
            className="transition-all duration-500"
            style={{
              width: 15,
              height: 15,
              color: theme === 'ghost' ? '#B388FF' : 'rgba(255,255,255,0.15)',
              filter: theme === 'ghost' ? 'drop-shadow(0 0 6px rgba(179, 136, 255, 0.5))' : 'none',
            }}
          />
        </button>
      )}
    </motion.div>
  );
}

export default memo(LayerPanel);
