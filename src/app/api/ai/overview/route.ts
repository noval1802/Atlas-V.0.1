/**
 * ═══════════════════════════════════════════════════════════════
 *  ATLAS — One-Click Alerts Overview
 *  POST /api/ai/overview   body: { mode: 'alerts', payload }
 *
 *  Builds the read-out and the structured brief (threads, seismic,
 *  coverage) for the Live Alerts panel with the built-in heuristic
 *  analyst. No external model is called: operational data stays on
 *  this server. A Gemini path existed here and was removed on purpose.
 * ═══════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/ssrf-guard';
import {
  BLOCS, buildAlertBrief,
  type AlertBrief, type Bloc, type DigestQuake, type DigestReport,
} from '@/lib/alert-digest';

export const dynamic = 'force-dynamic';

type Mode = 'alerts';

/* ─────────────────────────── Digest builders ─────────────────────────── */

type Digest = { summaryLine: string; facts: string[]; highlights: string[] };

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && !Number.isNaN(n) ? n : null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '');
}

type Loose = Record<string, unknown>;
const rec = (v: unknown): Loose => (v !== null && typeof v === 'object' ? (v as Loose) : {});
const isBloc = (v: unknown): v is Bloc => typeof v === 'string' && Object.hasOwn(BLOCS, v);
const str = (v: unknown, max = 300): string | null => (typeof v === 'string' && v ? v.slice(0, max) : null);

/** Accepts the panel's compact slice or an older full dashboard payload. */
function normalizeReports(raw: unknown): DigestReport[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).flatMap((item, i): DigestReport[] => {
    const n = rec(item);
    const rawTitle = str(n.title);
    const title = rawTitle ? decodeEntities(rawTitle) : '';
    if (!title) return [];
    return [{
      id: str(n.id, 100) ?? String(i),
      title,
      text: str(n.text ?? n.description, 800),
      source: str(n.source) ?? 'unknown',
      source_name: str(n.source_name),
      bloc: isBloc(n.bloc) ? n.bloc : null,
      published: str(n.published, 40),
      link: str(n.link, 500),
      flag: str(n.flag, 20),
      views: typeof n.views === 'number' ? n.views : null,
      also_reported_by: Array.isArray(n.also_reported_by)
        ? n.also_reported_by.slice(0, 12).map(entry => {
            const a = rec(entry);
            return { source: str(a.source) ?? 'unknown', source_name: str(a.source_name), bloc: isBloc(a.bloc) ? a.bloc : null };
          })
        : null,
    }];
  });
}

function normalizeQuakes(raw: unknown): DigestQuake[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map(item => {
    const q = rec(item);
    const props = rec(q.properties);
    return {
      magnitude: num(q.magnitude ?? q.mag ?? props.mag),
      place: str(q.place ?? props.place),
      time: typeof q.time === 'number' || typeof q.time === 'string' ? q.time : null,
      tsunami: num(q.tsunami),
      url: str(q.url, 500),
    };
  });
}

function digestAlerts(payload: unknown): { digest: Digest; brief: AlertBrief; reports: DigestReport[] } {
  const p = rec(payload);
  const reports = normalizeReports(p.news ?? p.news_intel);
  const brief = buildAlertBrief({
    news: reports,
    earthquakes: normalizeQuakes(p.earthquakes ?? p.quakes),
  });

  const facts = [...brief.facts];
  const highlights = [...brief.highlights];

  const weather = Array.isArray(p.weather_events) ? p.weather_events.map(rec) : [];
  if (weather.length) {
    const high = weather.filter(w => str(w.severity)?.toLowerCase() === 'high').length;
    const types = [...new Set(weather.map(w => str(w.type)).filter(Boolean))].slice(0, 3).join(', ');
    facts.push(`${weather.length} active severe-weather events${high ? `, ${high} high-severity` : ''}${types ? ` (${types})` : ''}.`);
    if (high) highlights.push(`${high} severe weather`);
  }

  const conflicts = Array.isArray(p.conflicts) ? p.conflicts : [];
  if (conflicts.length) facts.push(`${conflicts.length} conflict zones on the map layer.`);

  if (!facts.length) facts.push('No significant alerts in the current feed window.');
  return { digest: { summaryLine: brief.bottomLine, facts, highlights }, brief, reports };
}

/* ─────────────────────────── Renderers ─────────────────────────── */

function heuristicOverview(mode: Mode, digest: Digest): string {
  const bullets = digest.facts.map(f => `• ${f}`).join('\n');
  return `${digest.summaryLine}\n\n${bullets}`;
}

/* ─────────────────────────── Handler ─────────────────────────── */

export async function POST(request: NextRequest) {
  if (isRateLimited(getClientIp(request), 20)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  let body: { mode?: Mode; payload?: unknown };
  try {
    body = await request.json() as { mode?: Mode; payload?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const mode: Mode = 'alerts';
  const alerts = digestAlerts(body.payload);
  const digest = alerts.digest;

  const overview = heuristicOverview(mode, digest);
  const generatedBy = 'analyst';

  return NextResponse.json({
    mode,
    overview,
    highlights: digest.highlights,
    generatedBy,
    generatedAt: new Date().toISOString(),
    brief: alerts.brief,
  });
}
