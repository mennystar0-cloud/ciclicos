import { useState, useMemo } from 'react';
import { formatTallaConCategoria, formatTallaFromVkey } from './ropaUtils.ts';
import { Printer, AlertTriangle } from './icons.tsx';
import type { Folio, Scan, ToastType } from './types.ts';

// ─── Tipos compartidos con ReportTab ─────────────────────────────────────────
export type ReportStatus = 'ok' | 'faltante' | 'sobrante' | 'parcial';
export interface ReportRow {
    vkey: string; mod: string; color: string; talla: string;
    teo: number; fis: number; diff: number; status: ReportStatus;
    areaMap: { [area: string]: number };
}
export interface AjusteSugerido {
    mod: string; tipo: 'talla' | 'color';
    sobrante: { vkey: string; color: string; talla: string; exceso: number };
    faltante: { vkey: string; color: string; talla: string; falta: number };
    piezas: number;
}

type SectionKey = 'resumen' | 'areas' | 'operadores' | 'modelos'
    | 'faltante' | 'parcial' | 'sobrante' | 'ok' | 'ajustes' | 'firmas';
type ExtraCol = 'obs' | 'check' | 'none';

interface Config {
    sections: Record<SectionKey, boolean>;
    soloEscaneados: boolean;   // solo modelos con al menos 1 escaneo
    aplicarFiltros: boolean;   // búsqueda / talla / color activos en pantalla
    extraCol: ExtraCol;
    orden: 'diff' | 'mod';
    saltoPagina: boolean;      // cada sección en hoja nueva
}

const SECTION_META: { key: SectionKey; label: string; desc: string; group: 'resumen' | 'detalle' | 'extra' }[] = [
    { key: 'resumen',    label: 'Resumen general',        desc: 'Cobertura, teórico, físico, faltantes, sobrantes', group: 'resumen' },
    { key: 'areas',      label: 'Escaneos por área',      desc: 'Piezas, % del físico, modelos y operadores',     group: 'resumen' },
    { key: 'operadores', label: 'Escaneos por operador',  desc: 'Quién escaneó, cuánto y en qué áreas',           group: 'resumen' },
    { key: 'modelos',    label: 'Resumen por modelo',     desc: 'Una fila por modelo (más corto que por SKU)',     group: 'resumen' },
    { key: 'faltante',   label: 'Faltantes',              desc: 'SKUs sin ningún escaneo',                         group: 'detalle' },
    { key: 'parcial',    label: 'Parciales',              desc: 'Escaneados pero incompletos',                     group: 'detalle' },
    { key: 'sobrante',   label: 'Sobrantes',              desc: 'Más físico que teórico',                          group: 'detalle' },
    { key: 'ok',         label: 'OK (sin diferencia)',    desc: 'Físico igual al teórico',                         group: 'detalle' },
    { key: 'ajustes',    label: 'Ajustes posibles',       desc: 'Sobrante que compensa faltante (talla/color)',    group: 'extra' },
    { key: 'firmas',     label: 'Firmas',                 desc: 'Responsable, auditor y gerente al final',         group: 'extra' },
];

const allOff = (): Record<SectionKey, boolean> =>
    Object.fromEntries(SECTION_META.map(s => [s.key, false])) as Record<SectionKey, boolean>;
const pick = (...keys: SectionKey[]) => { const o = allOff(); keys.forEach(k => { o[k] = true; }); return o; };

const DEFAULT_CONFIG: Config = {
    sections: pick('resumen', 'areas', 'firmas'),
    soloEscaneados: false, aplicarFiltros: false, extraCol: 'obs', orden: 'diff', saltoPagina: false,
};

const PRESETS: { id: string; label: string; desc: string; config: Config }[] = [
    {
        id: 'cierre', label: 'Cierre de inventario', desc: 'Resumen, áreas, operadores, modelos, diferencias y firmas',
        config: { ...DEFAULT_CONFIG, sections: pick('resumen', 'areas', 'operadores', 'modelos', 'faltante', 'parcial', 'sobrante', 'firmas'), soloEscaneados: false },
    },
    {
        id: 'diferencias', label: 'Solo diferencias', desc: 'Faltantes, parciales, sobrantes y ajustes de modelos escaneados',
        config: { ...DEFAULT_CONFIG, sections: pick('resumen', 'faltante', 'parcial', 'sobrante', 'ajustes'), soloEscaneados: true },
    },
    {
        id: 'recuento', label: 'Recuento en piso', desc: 'Lista con casilla ☐ por modelo para volver a contar',
        config: { ...DEFAULT_CONFIG, sections: pick('faltante', 'parcial', 'sobrante'), soloEscaneados: true, extraCol: 'check', orden: 'mod' },
    },
];

const STORAGE_KEY = 'conteo:customReport_v1';
const ROWS_PER_PAGE = 38;
const WARN_ROWS = 1500;

const loadConfig = (): Config => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_CONFIG;
        const saved = JSON.parse(raw);
        return { ...DEFAULT_CONFIG, ...saved, sections: { ...DEFAULT_CONFIG.sections, ...(saved.sections || {}) } };
    } catch { return DEFAULT_CONFIG; }
};
const saveConfig = (c: Config) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(c)); } catch { /* sin storage */ } };

const esc = (v: unknown) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n: number) => n.toLocaleString('es-MX');
const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;
const diffCls = (n: number) => n < 0 ? 'neg' : n > 0 ? 'pos' : 'zero';
const fmtTime = (ts: number) => new Date(ts).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
const fmtDur = (ms: number) => {
    const m = Math.round(ms / 60000);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

// ─── COMPONENTE ──────────────────────────────────────────────────────────────
export const CustomReportModal = ({ folio, rows, filteredRows, hasActiveFilters, scans, ajustes, onClose, addToast }: {
    folio: Folio;
    rows: ReportRow[];           // todas las filas del folio
    filteredRows: ReportRow[];   // filas con búsqueda / talla / color de pantalla (sin filtro de estado)
    hasActiveFilters: boolean;
    scans: Scan[];
    ajustes: AjusteSugerido[];
    onClose: () => void;
    addToast: (m: string, t?: ToastType) => void;
}) => {
    const [cfg, setCfg] = useState<Config>(loadConfig);
    const update = (patch: Partial<Config>) => setCfg(c => ({ ...c, ...patch }));
    const toggleSection = (k: SectionKey) => setCfg(c => ({ ...c, sections: { ...c.sections, [k]: !c.sections[k] } }));

    // Filas válidas (sin marcadores internos __SYS__ / __VAR__)
    const cleanAll = useMemo(() => rows.filter(r => !r.color.startsWith('__')), [rows]);

    // Base sobre la que se arman las secciones de detalle
    const base = useMemo(() => {
        let list = (cfg.aplicarFiltros && hasActiveFilters ? filteredRows : rows).filter(r => !r.color.startsWith('__'));
        if (cfg.soloEscaneados) {
            const scannedMods = new Set(cleanAll.filter(r => r.fis > 0).map(r => r.mod));
            list = list.filter(r => scannedMods.has(r.mod));
        }
        return list;
    }, [rows, filteredRows, cleanAll, cfg.aplicarFiltros, cfg.soloEscaneados, hasActiveFilters]);

    const sortRows = (list: ReportRow[]) => [...list].sort((a, b) =>
        cfg.orden === 'mod'
            ? a.mod.localeCompare(b.mod) || a.color.localeCompare(b.color) || parseFloat(a.talla) - parseFloat(b.talla)
            : a.diff - b.diff || a.mod.localeCompare(b.mod));

    const byStatus = useMemo(() => {
        const o: Record<ReportStatus, ReportRow[]> = { faltante: [], parcial: [], sobrante: [], ok: [] };
        base.forEach(r => o[r.status].push(r));
        return o;
    }, [base]);

    const modelos = useMemo(() => {
        const m = new Map<string, { mod: string; teo: number; fis: number; skus: number; falt: number; parc: number; sobr: number; ok: number }>();
        base.forEach(r => {
            let e = m.get(r.mod);
            if (!e) { e = { mod: r.mod, teo: 0, fis: 0, skus: 0, falt: 0, parc: 0, sobr: 0, ok: 0 }; m.set(r.mod, e); }
            e.teo += r.teo; e.fis += r.fis; e.skus++;
            if (r.status === 'faltante') e.falt++; else if (r.status === 'parcial') e.parc++; else if (r.status === 'sobrante') e.sobr++; else e.ok++;
        });
        return [...m.values()].sort((a, b) => cfg.orden === 'mod' ? a.mod.localeCompare(b.mod) : (a.fis - a.teo) - (b.fis - b.teo));
    }, [base, cfg.orden]);

    const areas = useMemo(() => {
        const m = new Map<string, { area: string; piezas: number; vkeys: Set<string>; mods: Set<string>; users: Set<string>; first: number; last: number }>();
        scans.forEach(s => {
            const k = s.area || 'SIN ÁREA';
            let e = m.get(k);
            if (!e) { e = { area: k, piezas: 0, vkeys: new Set(), mods: new Set(), users: new Set(), first: s.ts, last: s.ts }; m.set(k, e); }
            e.piezas++; e.vkeys.add(s.vkey); e.mods.add(s.mod); if (s.user) e.users.add(s.user);
            e.first = Math.min(e.first, s.ts); e.last = Math.max(e.last, s.ts);
        });
        return [...m.values()].sort((a, b) => b.piezas - a.piezas);
    }, [scans]);

    const operadores = useMemo(() => {
        const m = new Map<string, { user: string; piezas: number; areas: Map<string, number>; first: number; last: number }>();
        scans.forEach(s => {
            const k = s.user || 'Sin operador';
            let e = m.get(k);
            if (!e) { e = { user: k, piezas: 0, areas: new Map(), first: s.ts, last: s.ts }; m.set(k, e); }
            e.piezas++; e.areas.set(s.area, (e.areas.get(s.area) || 0) + 1);
            e.first = Math.min(e.first, s.ts); e.last = Math.max(e.last, s.ts);
        });
        return [...m.values()].sort((a, b) => b.piezas - a.piezas);
    }, [scans]);

    const ajustesBase = useMemo(() => {
        if (!cfg.soloEscaneados && !(cfg.aplicarFiltros && hasActiveFilters)) return ajustes;
        const mods = new Set(base.map(r => r.mod));
        return ajustes.filter(a => mods.has(a.mod));
    }, [ajustes, base, cfg.soloEscaneados, cfg.aplicarFiltros, hasActiveFilters]);

    // Filas que generará cada sección (para el contador y el aviso)
    const rowCount: Record<SectionKey, number> = {
        resumen: 1, areas: areas.length, operadores: operadores.length, modelos: modelos.length,
        faltante: byStatus.faltante.length, parcial: byStatus.parcial.length,
        sobrante: byStatus.sobrante.length, ok: byStatus.ok.length,
        ajustes: ajustesBase.length, firmas: 0,
    };
    const totalRows = SECTION_META.reduce((a, s) => a + (cfg.sections[s.key] ? rowCount[s.key] : 0), 0);
    const pagesEst = Math.max(1, Math.ceil((totalRows + 15) / ROWS_PER_PAGE));
    const anySelected = SECTION_META.some(s => cfg.sections[s.key]);
    const tooBig = totalRows > WARN_ROWS;

    // ─── Generación del HTML ────────────────────────────────────────────────
    const buildHtml = () => {
        const now = new Date();
        const totTeo = cleanAll.reduce((a, r) => a + r.teo, 0);
        const totFis = cleanAll.reduce((a, r) => a + r.fis, 0);
        const piezasFalt = cleanAll.filter(r => r.status === 'faltante').reduce((a, r) => a - r.diff, 0);
        const piezasParc = cleanAll.filter(r => r.status === 'parcial').reduce((a, r) => a - r.diff, 0);
        const piezasSobr = cleanAll.filter(r => r.status === 'sobrante').reduce((a, r) => a + r.diff, 0);
        const cobertura = totTeo > 0 ? (totFis / totTeo) * 100 : 0;
        const cobColor = cobertura >= 100 ? '#10b981' : cobertura >= 70 ? '#f59e0b' : '#ef4444';
        const count = (s: ReportStatus) => cleanAll.filter(r => r.status === s).length;
        const modsEscaneados = new Set(cleanAll.filter(r => r.fis > 0).map(r => r.mod)).size;
        const modsTotal = new Set(cleanAll.map(r => r.mod)).size;

        const notas: string[] = [];
        if (cfg.soloEscaneados) notas.push('Solo modelos con al menos un escaneo');
        if (cfg.aplicarFiltros && hasActiveFilters) notas.push('Con la búsqueda / filtros de talla y color de pantalla');

        const extraTh = cfg.extraCol === 'obs' ? '<th style="width:22%">Observaciones</th>' : cfg.extraCol === 'check' ? '<th class="c" style="width:38px">✓</th>' : '';
        const extraTd = cfg.extraCol === 'obs' ? '<td class="obs"></td>' : cfg.extraCol === 'check' ? '<td class="c box">☐</td>' : '';
        const extraN = cfg.extraCol === 'none' ? 0 : 1;

        const secs: string[] = [];
        const section = (title: string, badge: string, body: string, badgeCls = '') =>
            secs.push(`<section${cfg.saltoPagina && secs.length > 0 ? ' class="newpage"' : ''}><h2>${esc(title)} <span class="badge ${badgeCls}">${esc(badge)}</span></h2>${body}</section>`);

        // Resumen general
        if (cfg.sections.resumen) {
            const kpi = (val: string, lbl: string, color = '#0f172a', sub = '') =>
                `<div class="kpi"><div class="val" style="color:${color}">${val}</div><div class="lbl">${lbl}</div>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`;
            section('Resumen general', 'Todo el folio', `
<div class="kpis">
  ${kpi(`${Math.round(cobertura)}%`, 'Cobertura', cobColor)}
  ${kpi(fmt(totTeo), 'Teórico')}
  ${kpi(fmt(totFis), 'Físico', '#0284c7')}
  ${kpi(fmt(totFis - totTeo), 'Diferencia', totFis - totTeo < 0 ? '#dc2626' : '#16a34a')}
  ${kpi(fmt(scans.length), 'Escaneos')}
</div>
<table class="mini">
  <thead><tr><th>Estado</th><th class="c">SKUs</th><th class="c">Piezas</th></tr></thead>
  <tbody>
    <tr><td><span class="dot" style="background:#ef4444"></span>Faltantes (sin escaneo)</td><td class="c">${fmt(count('faltante'))}</td><td class="c neg">-${fmt(piezasFalt)}</td></tr>
    <tr><td><span class="dot" style="background:#f97316"></span>Parciales</td><td class="c">${fmt(count('parcial'))}</td><td class="c neg">-${fmt(piezasParc)}</td></tr>
    <tr><td><span class="dot" style="background:#10b981"></span>Sobrantes</td><td class="c">${fmt(count('sobrante'))}</td><td class="c pos">+${fmt(piezasSobr)}</td></tr>
    <tr><td><span class="dot" style="background:#94a3b8"></span>OK</td><td class="c">${fmt(count('ok'))}</td><td class="c">—</td></tr>
    <tr class="tot"><td>Modelos escaneados</td><td class="c" colspan="2">${fmt(modsEscaneados)} de ${fmt(modsTotal)}</td></tr>
  </tbody>
</table>`);
        }

        // Escaneos por área
        if (cfg.sections.areas) {
            const max = Math.max(1, ...areas.map(a => a.piezas));
            const tot = areas.reduce((a, x) => a + x.piezas, 0);
            section('Escaneos por área', `${areas.length} área(s)`, areas.length === 0 ? '<p class="empty">Sin escaneos</p>' : `
<table>
  <thead><tr><th>Área</th><th style="width:30%"></th><th class="c">Piezas</th><th class="c">% físico</th><th class="c">SKUs</th><th class="c">Modelos</th><th>Operadores</th><th class="c">Periodo</th></tr></thead>
  <tbody>
    ${areas.map(a => `<tr>
      <td class="b">${esc(a.area)}</td>
      <td><div class="bar"><div style="width:${(a.piezas / max) * 100}%"></div></div></td>
      <td class="c b">${fmt(a.piezas)}</td>
      <td class="c">${tot ? Math.round((a.piezas / tot) * 100) : 0}%</td>
      <td class="c">${fmt(a.vkeys.size)}</td>
      <td class="c">${fmt(a.mods.size)}</td>
      <td class="sm">${esc([...a.users].join(', '))}</td>
      <td class="c sm">${fmtTime(a.first)}<br/>${fmtTime(a.last)}</td>
    </tr>`).join('')}
    <tr class="tot"><td>TOTAL</td><td></td><td class="c">${fmt(tot)}</td><td class="c">100%</td><td colspan="4"></td></tr>
  </tbody>
</table>`);
        }

        // Escaneos por operador
        if (cfg.sections.operadores) {
            section('Escaneos por operador', `${operadores.length} operador(es)`, operadores.length === 0 ? '<p class="empty">Sin escaneos</p>' : `
<table>
  <thead><tr><th>Operador</th><th class="c">Piezas</th><th>Áreas</th><th class="c">Inicio</th><th class="c">Último</th><th class="c">Tiempo</th><th class="c">Pzas/hora</th></tr></thead>
  <tbody>
    ${operadores.map(o => {
        const dur = o.last - o.first;
        const rate = dur > 60000 ? Math.round(o.piezas / (dur / 3600000)) : null;
        return `<tr>
      <td class="b">${esc(o.user)}</td>
      <td class="c b">${fmt(o.piezas)}</td>
      <td class="sm">${esc([...o.areas.entries()].sort((a, b) => b[1] - a[1]).map(([a, c]) => `${a}: ${c}`).join(' · '))}</td>
      <td class="c sm">${fmtTime(o.first)}</td>
      <td class="c sm">${fmtTime(o.last)}</td>
      <td class="c sm">${fmtDur(dur)}</td>
      <td class="c">${rate === null ? '—' : fmt(rate)}</td>
    </tr>`; }).join('')}
  </tbody>
</table>`);
        }

        // Resumen por modelo
        if (cfg.sections.modelos) {
            const t = modelos.reduce((a, m) => ({ teo: a.teo + m.teo, fis: a.fis + m.fis }), { teo: 0, fis: 0 });
            section('Resumen por modelo', `${fmt(modelos.length)} modelo(s)`, modelos.length === 0 ? '<p class="empty">Sin modelos</p>' : `
<table>
  <thead><tr><th>Modelo</th><th class="c">SKUs</th><th class="c">Teórico</th><th class="c">Físico</th><th class="c">Dif.</th><th class="c">Cobertura</th><th class="c">Falt.</th><th class="c">Parc.</th><th class="c">Sobr.</th><th class="c">OK</th>${extraTh}</tr></thead>
  <tbody>
    ${modelos.map(m => {
        const d = m.fis - m.teo;
        return `<tr>
      <td class="b">${esc(m.mod)}</td><td class="c">${m.skus}</td><td class="c">${fmt(m.teo)}</td><td class="c fis">${fmt(m.fis)}</td>
      <td class="c ${diffCls(d)}">${signed(d)}</td>
      <td class="c">${m.teo ? Math.round((m.fis / m.teo) * 100) + '%' : '—'}</td>
      <td class="c">${m.falt || ''}</td><td class="c">${m.parc || ''}</td><td class="c">${m.sobr || ''}</td><td class="c">${m.ok || ''}</td>${extraTd}
    </tr>`; }).join('')}
    <tr class="tot"><td>TOTAL</td><td></td><td class="c">${fmt(t.teo)}</td><td class="c">${fmt(t.fis)}</td><td class="c ${diffCls(t.fis - t.teo)}">${signed(t.fis - t.teo)}</td><td colspan="${5 + extraN}"></td></tr>
  </tbody>
</table>`);
        }

        // Tablas de detalle por estado
        const detail = (key: ReportStatus, title: string, badgeCls: string, withAreas: boolean) => {
            if (!cfg.sections[key]) return;
            const list = sortRows(byStatus[key]);
            const tTeo = list.reduce((a, r) => a + r.teo, 0);
            const tFis = list.reduce((a, r) => a + r.fis, 0);
            section(title, `${fmt(list.length)} SKU(s) · ${signed(tFis - tTeo)} pzas`, list.length === 0 ? '<p class="empty">Sin artículos en esta sección</p>' : `
<table>
  <thead><tr><th>Modelo</th><th>Color</th><th class="c">Talla</th><th class="c">Teórico</th><th class="c">Físico</th><th class="c">Dif.</th>${withAreas ? '<th>Áreas</th>' : ''}${extraTh}</tr></thead>
  <tbody>
    ${list.map(r => `<tr class="${r.status}">
      <td class="b">${esc(r.mod)}</td><td>${esc(r.color)}</td><td class="c">${esc(formatTallaConCategoria(r.talla, r.vkey))}</td>
      <td class="c">${fmt(r.teo)}</td><td class="c fis">${fmt(r.fis)}</td><td class="c ${diffCls(r.diff)}">${signed(r.diff)}</td>
      ${withAreas ? `<td class="sm">${esc(Object.entries(r.areaMap).map(([a, c]) => `${a}:${c}`).join(' '))}</td>` : ''}${extraTd}
    </tr>`).join('')}
    <tr class="tot"><td colspan="3">TOTAL</td><td class="c">${fmt(tTeo)}</td><td class="c">${fmt(tFis)}</td><td class="c ${diffCls(tFis - tTeo)}">${signed(tFis - tTeo)}</td><td colspan="${(withAreas ? 1 : 0) + extraN}"></td></tr>
  </tbody>
</table>`, badgeCls);
        };
        detail('faltante', 'Faltantes', 'b-red', false);
        detail('parcial', 'Parciales', 'b-orange', true);
        detail('sobrante', 'Sobrantes', 'b-green', true);
        detail('ok', 'OK (sin diferencia)', 'b-slate', true);

        // Ajustes posibles
        if (cfg.sections.ajustes) {
            section('Ajustes posibles', `${ajustesBase.length} ajuste(s) · ${fmt(ajustesBase.reduce((a, x) => a + x.piezas, 0))} pzas`, ajustesBase.length === 0 ? '<p class="empty">Sin ajustes posibles</p>' : `
<p class="note">Sugerencias: un sobrante del mismo modelo podría compensar un faltante en otra talla o color. Verificar físicamente antes de aplicar.</p>
<table>
  <thead><tr><th class="c" style="width:28px">#</th><th>Modelo</th><th>Tipo</th><th>Sobrante (color · talla · cant)</th><th></th><th>Faltante (color · talla · cant)</th><th class="c">Piezas</th><th class="c" style="width:38px">✓</th></tr></thead>
  <tbody>
    ${ajustesBase.map((a, i) => `<tr>
      <td class="c sm">${i + 1}</td><td class="b">${esc(a.mod)}</td><td>${a.tipo === 'talla' ? 'Talla' : 'Color'}</td>
      <td class="pos">${esc(a.sobrante.color)} · T${esc(formatTallaFromVkey(a.sobrante.talla, a.sobrante.vkey))} · +${a.sobrante.exceso}</td>
      <td class="c">→</td>
      <td class="neg">${esc(a.faltante.color)} · T${esc(formatTallaFromVkey(a.faltante.talla, a.faltante.vkey))} · -${a.faltante.falta}</td>
      <td class="c b">${a.piezas}</td><td class="c box">☐</td>
    </tr>`).join('')}
  </tbody>
</table>`, 'b-amber');
        }

        const firmas = cfg.sections.firmas ? `
<div class="firmas">
  ${['Responsable del conteo', 'Auditor', 'Gerente de tienda'].map(l => `<div class="firma"><div class="linea"></div><div>${l}</div><div class="sm">Nombre y firma</div></div>`).join('')}
</div>` : '';

        const incluidas = SECTION_META.filter(s => cfg.sections[s.key] && s.key !== 'firmas').map(s => s.label);

        return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/>
<title>Reporte personalizado — ${esc(folio.name)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #1e293b; padding: 22px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .header { border-bottom: 3px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; gap: 16px; }
  .logo { font-size: 17px; font-weight: 900; color: #0f172a; }
  .hsub { font-size: 9.5px; color: #64748b; margin-top: 3px; }
  .hnote { font-size: 9px; color: #b45309; margin-top: 3px; font-style: italic; }
  section { margin-bottom: 18px; }
  section.newpage { break-before: page; page-break-before: always; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #0f172a; border-left: 4px solid #0ea5e9; padding-left: 8px; margin-bottom: 8px; break-after: avoid; page-break-after: avoid; }
  .badge { font-size: 8.5px; font-weight: bold; padding: 2px 8px; border-radius: 10px; background: #e2e8f0; color: #334155; margin-left: 6px; letter-spacing: 0; text-transform: none; vertical-align: middle; }
  .b-red { background: #fee2e2; color: #b91c1c; } .b-orange { background: #ffedd5; color: #c2410c; }
  .b-green { background: #dcfce7; color: #15803d; } .b-slate { background: #f1f5f9; color: #475569; } .b-amber { background: #fef3c7; color: #b45309; }
  .kpis { display: flex; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 7px 14px; text-align: center; min-width: 90px; }
  .kpi .val { font-size: 17px; font-weight: bold; } .kpi .lbl { font-size: 8.5px; color: #64748b; text-transform: uppercase; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; }
  table.mini { width: auto; min-width: 50%; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { background: #0f172a; color: #fff; padding: 5px 7px; text-align: left; font-size: 9px; font-weight: bold; }
  td { padding: 4px 7px; border-bottom: 1px solid #eef2f7; vertical-align: middle; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  tr.faltante td { background: #fef2f2 !important; } tr.parcial td { background: #fff7ed !important; } tr.sobrante td { background: #f0fdf4 !important; }
  tr.tot td { font-weight: bold; background: #f1f5f9 !important; border-top: 2px solid #cbd5e1; }
  .c { text-align: center; } .b { font-weight: bold; } .sm { font-size: 8.5px; color: #64748b; }
  .fis { color: #0284c7; font-weight: bold; }
  .neg { color: #dc2626; font-weight: bold; } .pos { color: #16a34a; font-weight: bold; } .zero { color: #94a3b8; }
  .obs { border-bottom: 1px dashed #cbd5e1 !important; }
  .box { font-size: 13px; color: #94a3b8; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
  .bar { background: #f1f5f9; border-radius: 6px; height: 9px; overflow: hidden; } .bar > div { background: #38bdf8; height: 9px; border-radius: 6px; }
  .empty { color: #94a3b8; font-style: italic; padding: 6px 0; } .note { font-size: 9px; color: #92400e; margin-bottom: 6px; }
  .firmas { display: flex; gap: 28px; margin-top: 46px; break-inside: avoid; page-break-inside: avoid; }
  .firma { flex: 1; text-align: center; font-size: 9.5px; } .firma .linea { border-top: 1px solid #0f172a; margin-bottom: 4px; }
  .footer { margin-top: 18px; font-size: 8.5px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 6px; }
  @page { size: A4 portrait; margin: 1.2cm 1.3cm; }
  @media print { body { padding: 0; } }
</style></head>
<body>
<div class="header">
  <div>
    <div class="logo">Conteo Cíclico Pro · Reporte personalizado</div>
    <div class="hsub">${esc(folio.name)} &nbsp;·&nbsp; ${esc(folio.almacen)}${folio.temporada ? ' &nbsp;·&nbsp; ' + esc(folio.temporada) : ''}${folio.state === 'closed' ? ' &nbsp;·&nbsp; CERRADO' : ''}</div>
    <div class="hsub">Incluye: ${esc(incluidas.join(', ') || '—')}</div>
    ${notas.length ? `<div class="hnote">${esc(notas.join(' · '))}</div>` : ''}
  </div>
  <div style="text-align:right">
    <div class="hsub">${now.toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</div>
    <div class="hsub">${fmt(scans.length)} escaneo(s)</div>
  </div>
</div>
${secs.join('\n')}
${firmas}
<div class="footer">Conteo Cíclico Pro &nbsp;·&nbsp; ${esc(folio.name)} &nbsp;·&nbsp; Generado el ${now.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</div>
</body></html>`;
    };

    const handlePrint = () => {
        if (!anySelected) { addToast('Selecciona al menos una sección', 'warning'); return; }
        saveConfig(cfg);
        const win = window.open('', '_blank');
        if (!win) { addToast('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.', 'error'); return; }
        win.document.write(buildHtml());
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 400);
        onClose();
    };

    const applyPreset = (c: Config) => setCfg({ ...c, sections: { ...c.sections } });

    // ─── UI ─────────────────────────────────────────────────────────────────
    const Check = ({ k }: { k: SectionKey }) => {
        const meta = SECTION_META.find(s => s.key === k)!;
        const on = cfg.sections[k];
        const n = rowCount[k];
        const showCount = k !== 'resumen' && k !== 'firmas';
        return (
            <label className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${on ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <input type="checkbox" checked={on} onChange={() => toggleSection(k)} className="w-4 h-4 accent-sky-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{meta.label}</p>
                    <p className="text-[11px] text-slate-400 truncate">{meta.desc}</p>
                </div>
                {showCount && (
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${n > WARN_ROWS ? 'bg-red-100 text-red-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'}`}>
                        {fmt(n)}
                    </span>
                )}
            </label>
        );
    };

    const Toggle = ({ on, onChange, label, desc, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string; disabled?: boolean }) => (
        <label className={`flex items-center gap-3 py-1.5 ${disabled ? 'opacity-40' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={on} disabled={disabled} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-sky-500" />
            <div>
                <p className="text-sm text-slate-700 dark:text-slate-200">{label}</p>
                {desc && <p className="text-[11px] text-slate-400">{desc}</p>}
            </div>
        </label>
    );

    const Seg = <T extends string>({ value, options, onChange }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void }) => (
        <div className="flex gap-1">
            {options.map(o => (
                <button key={o.v} type="button" onClick={() => onChange(o.v)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${value === o.v ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                    {o.l}
                </button>
            ))}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center sm:justify-center" onClick={onClose}>
            <div className="w-full sm:max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border-t dark:border-slate-700 max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b dark:border-slate-700">
                    <div>
                        <p className="font-semibold text-slate-800 dark:text-white">Reporte personalizado</p>
                        <p className="text-[11px] text-slate-400">Elige qué secciones imprimir</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 text-2xl leading-none">×</button>
                </div>

                <div className="overflow-y-auto px-5 py-4 space-y-5">
                    {/* Plantillas */}
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">Plantillas rápidas</p>
                        <div className="grid grid-cols-3 gap-2">
                            {PRESETS.map(p => (
                                <button key={p.id} type="button" onClick={() => applyPreset(p.config)} title={p.desc}
                                    className="text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors">
                                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{p.label}</p>
                                    <p className="text-[10px] text-slate-400 leading-tight mt-0.5">{p.desc}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Secciones */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[11px] font-bold text-slate-500 uppercase">Resumen</p>
                            <button type="button" onClick={() => update({ sections: allOff() })} className="text-[11px] text-sky-500">Quitar todo</button>
                        </div>
                        <div className="space-y-1.5">{SECTION_META.filter(s => s.group === 'resumen').map(s => <Check key={s.key} k={s.key} />)}</div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">Detalle por SKU</p>
                        <div className="space-y-1.5">{SECTION_META.filter(s => s.group === 'detalle').map(s => <Check key={s.key} k={s.key} />)}</div>
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase mb-2">Extras</p>
                        <div className="space-y-1.5">{SECTION_META.filter(s => s.group === 'extra').map(s => <Check key={s.key} k={s.key} />)}</div>
                    </div>

                    {/* Opciones */}
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-3 space-y-2">
                        <p className="text-[11px] font-bold text-slate-500 uppercase">Opciones</p>
                        <Toggle on={cfg.soloEscaneados} onChange={v => update({ soloEscaneados: v })}
                            label="Solo modelos con al menos un escaneo"
                            desc="Muestra todas las tallas y colores de los modelos que sí se contaron" />
                        <Toggle on={cfg.aplicarFiltros && hasActiveFilters} disabled={!hasActiveFilters} onChange={v => update({ aplicarFiltros: v })}
                            label="Aplicar búsqueda y filtros de pantalla"
                            desc={hasActiveFilters ? 'Usa la búsqueda y los filtros de talla/color activos' : 'No hay búsqueda ni filtros activos'} />
                        <Toggle on={cfg.saltoPagina} onChange={v => update({ saltoPagina: v })} label="Cada sección en hoja nueva" />
                        <div className="pt-1">
                            <p className="text-xs text-slate-500 mb-1">Columna extra en tablas</p>
                            <Seg value={cfg.extraCol} onChange={v => update({ extraCol: v })}
                                options={[{ v: 'obs', l: 'Observaciones' }, { v: 'check', l: 'Casilla ☐' }, { v: 'none', l: 'Ninguna' }]} />
                        </div>
                        <div className="pt-1">
                            <p className="text-xs text-slate-500 mb-1">Ordenar por</p>
                            <Seg value={cfg.orden} onChange={v => update({ orden: v })}
                                options={[{ v: 'diff', l: 'Mayor diferencia' }, { v: 'mod', l: 'Modelo' }]} />
                        </div>
                    </div>

                    {tooBig && (
                        <div className="flex gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5">
                            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700 dark:text-red-300">
                                Saldrían unas <strong>{fmt(pagesEst)} hojas</strong> ({fmt(totalRows)} filas). {[
                                    !cfg.soloEscaneados && 'Activa "Solo modelos con al menos un escaneo"',
                                    !cfg.sections.modelos && 'usa "Resumen por modelo" en lugar del detalle por SKU',
                                    cfg.soloEscaneados && cfg.sections.modelos && 'Quita alguna sección de detalle',
                                ].filter(Boolean).join(' o ').replace(/^./, c => c.toUpperCase())} para reducirlo.
                            </p>
                        </div>
                    )}
                </div>

                <div className="border-t dark:border-slate-700 px-5 py-3 pb-6 sm:pb-3 flex items-center gap-3">
                    <div className="flex-1 text-xs text-slate-500 dark:text-slate-400">
                        {anySelected ? <>≈ <strong className="text-slate-700 dark:text-slate-200">{fmt(pagesEst)}</strong> hoja(s) · {fmt(totalRows)} fila(s)</> : 'Ninguna sección seleccionada'}
                    </div>
                    <button type="button" onClick={handlePrint} disabled={!anySelected}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 dark:bg-sky-600 text-white text-sm font-semibold disabled:opacity-40 hover:bg-slate-700 transition-colors">
                        <Printer size={16} /> Imprimir
                    </button>
                </div>
            </div>
        </div>
    );
};
