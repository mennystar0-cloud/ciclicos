import React, { useState, useEffect } from 'react';
import { fbDeleteSession, fbGetAllFolios, fbGetScans, fbGetSessionItems, fbAddScan } from './firebase.ts';
import { tryDecodeStructuredBarcode, formatDate } from './utils.ts';
import { decodeRopaBarcode } from './ropaUtils.ts';
import { ChevronUp, Download, Eye, RefreshCw, Upload, Users, Wifi } from './icons.tsx';
import { CoverageRing } from './CoverageRing.tsx';
import { useConfirm } from './hooks.tsx';
import type { Folio, Scan, ColorMap, Catalog, ToastType, ScanSession, SessionItem } from './types.ts';
export const SessionsAdminTab = ({ addToast, sucursalId, folio, scans, colors, catalog, sessions }: {
    addToast: (m: string, t?: ToastType) => void;
    sucursalId?: string;
    folio: Folio | null;
    scans: Scan[];
    colors: ColorMap;
    catalog: Catalog;
    sessions: ScanSession[];
}) => {
    const [expanded, setExpanded] = useState<string | null>(null);
    const [items, setItems] = useState<{ [id: string]: SessionItem[] }>({});
    const [loadingItems, setLoadingItems] = useState<string | null>(null);
    const [syncing, setSyncing] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [now, setNow] = useState(Date.now());
    const importRef = React.useRef<HTMLInputElement>(null);
    const { confirm: askConfirm, modal: confirmModal } = useConfirm();

    // Actualizar "now" cada 30s para que los indicadores activo/inactivo se refresquen
    useEffect(() => {
        const iv = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(iv);
    }, []);

    // Nota: Las sesiones se muestran desde la colección scanSessions (flujo ScannerSessionTab)
    // El ScanTab principal registra scans directo en el folio — ver pestaña Reporte para cruce completo

    const loadItems = async (sessionId: string) => {
        if (items[sessionId]) { setExpanded(expanded === sessionId ? null : sessionId); return; }
        setLoadingItems(sessionId);
        const data = await fbGetSessionItems(sessionId, sucursalId);
        setItems(prev => ({ ...prev, [sessionId]: data as SessionItem[] }));
        setLoadingItems(null);
        setExpanded(sessionId);
    };

    const exportSession = async (session: ScanSession) => {
        let data = items[session.id];
        if (!data) { data = await fbGetSessionItems(session.id, sucursalId) as SessionItem[]; }
        const exportData = {
            version: 1,
            area: session.area,
            operator: session.operator,
            exportedAt: Date.now(),
            items: data.map(item => ({ id: item.id, code: item.code, ts: item.ts })),
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sesion-${session.area}-${session.operator}.json`;
        a.click();
        URL.revokeObjectURL(url);
        addToast(`${data.length} escaneos exportados`, 'success');
    };

    const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setImporting(true);
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            if (!data.items || !Array.isArray(data.items)) {
                addToast('Archivo inválido — debe ser un JSON exportado de sesión', 'error');
                return;
            }
            const folios = await fbGetAllFolios(sucursalId) as Folio[];
            const openFolio = folios.find(f => f.state === 'open');
            if (!openFolio) { addToast('No hay inventario abierto para importar', 'warning'); return; }

            const existingScans = await fbGetScans(openFolio.id, sucursalId) as Scan[];
            const existingIds = new Set(existingScans.map(s => s.id));

            let applied = 0, skipped = 0, unrecognized = 0;
            for (const item of data.items) {
                if (existingIds.has(item.id)) { skipped++; continue; }
                const code = String(item.code || '');
                let decoded: { mod: string; color: string; talla: string; vkey: string } | null = null;
                const ropaDecoded = decodeRopaBarcode(code, colors);
                if (ropaDecoded) {
                    decoded = { mod: ropaDecoded.mod, color: ropaDecoded.color, talla: ropaDecoded.talla, vkey: ropaDecoded.vkey };
                } else {
                    const calzadoDecoded = tryDecodeStructuredBarcode(code, colors);
                    if (calzadoDecoded) decoded = { mod: calzadoDecoded.mod, color: calzadoDecoded.color, talla: calzadoDecoded.talla, vkey: calzadoDecoded.vkey };
                }
                if (!decoded) {
                    const cat = catalog.byBarcode[code];
                    if (cat) decoded = { mod: cat.mod, color: cat.color, talla: cat.talla, vkey: cat.vkey };
                }
                if (!decoded) { unrecognized++; continue; }
                const scan: Scan = {
                    id: item.id, folioId: openFolio.id, code,
                    vkey: decoded.vkey, mod: decoded.mod, color: decoded.color, talla: decoded.talla,
                    area: data.area || 'Importado', pos: '0',
                    user: data.operator || 'Importado', ts: item.ts || Date.now(),
                    sucursalId: sucursalId ?? undefined,
                };
                await fbAddScan(scan);
                applied++;
            }
            addToast(`✓ ${applied} importados · ${skipped} ya existían · ${unrecognized} no reconocidos`, 'success');
        } catch (err: any) {
            addToast(`Error al importar: ${err?.message || 'archivo inválido'}`, 'error');
        } finally {
            setImporting(false);
        }
    };

    const deleteSession = async (sessionId: string) => {
        const ok = await askConfirm('Esta acción no se puede deshacer.', '¿Eliminar sesión?');
        if (!ok) return;
        await fbDeleteSession(sessionId, sucursalId);
        addToast('Sesión eliminada', 'info');
    };

    const syncSession = async (session: ScanSession) => {
        setSyncing(session.id);
        try {
            // Obtener folio activo
            const folios = await fbGetAllFolios(sucursalId) as Folio[];
            const folio = folios.find(f => f.state === 'open');
            if (!folio) { addToast('No hay inventario abierto para sincronizar', 'warning'); setSyncing(null); return; }

            // Obtener todos los items de la sesión
            const sessionItems = await fbGetSessionItems(session.id) as SessionItem[];
            const recognized = sessionItems.filter(i => i.recognized && i.vkey);

            if (recognized.length === 0) { addToast('Sin items reconocidos para sincronizar', 'info'); setSyncing(null); return; }

            // Obtener scans ya registrados en el folio para evitar duplicados
            const existingScans = await fbGetScans(folio.id, sucursalId) as Scan[];
            const existingIds = new Set(existingScans.map(s => s.id));

            // Aplicar solo los que no están ya en el folio
            let applied = 0;
            for (const item of recognized) {
                if (existingIds.has(item.id)) continue;
                const scan: Scan = {
                    id: item.id,
                    folioId: folio.id,
                    code: item.code,
                    vkey: item.vkey,
                    mod: item.mod,
                    color: item.color,
                    talla: item.talla,
                    area: session.area,
                    pos: '0',
                    user: session.operator,
                    ts: item.ts,
                    sucursalId: sucursalId ?? undefined,
                };
                await fbAddScan(scan);
                applied++;
            }

            addToast(`✓ ${applied} escaneos sincronizados al reporte (${recognized.length - applied} ya existían)`, 'success');
        } catch (err: any) {
            addToast(`Error al sincronizar: ${err?.message || 'revisa la consola'}`, 'error');
            console.error(err);
        } finally {
            setSyncing(null);
        }
    };

    const INACTIVE_THRESHOLD = 2 * 60 * 1000; // 2 minutos
    const activeSessions = sessions.filter(s =>
        !s.lastSeen || (now - s.lastSeen) < INACTIVE_THRESHOLD
    );
    const inactiveSessions = sessions.filter(s =>
        s.lastSeen && (now - s.lastSeen) >= INACTIVE_THRESHOLD
    );

    // ── Métricas de progreso ──────────────────────────────────────────────────
    const totalTeorico   = folio ? Object.values(folio.theoreticalMap).reduce((a, b) => a + b, 0) : 0;
    const totalEscaneado = folio ? Object.values(folio.existenciasMap).reduce((a, b) => a + b, 0)  : 0;
    const coveragePct    = totalTeorico > 0 ? (totalEscaneado / totalTeorico) * 100 : 0;

    // Áreas del folio (acumulado histórico desde areaCounters)
    const areaEntries = folio
        ? Object.entries(folio.areaCounters).sort((a, b) => b[1] - a[1])
        : [];
    const maxAreaCount = areaEntries.length > 0 ? areaEntries[0][1] : 1;

    // Sesiones activas agrupadas por área para mostrar quién está escaneando dónde
    const sessionsByArea: Record<string, ScanSession[]> = {};
    activeSessions.forEach(s => {
        if (!sessionsByArea[s.area]) sessionsByArea[s.area] = [];
        sessionsByArea[s.area].push(s);
    });

    // Áreas con sesión activa que aún no tienen registro en areaCounters
    const extraAreas = activeSessions
        .map(s => s.area)
        .filter(a => !folio?.areaCounters[a]);
    const uniqueExtraAreas = [...new Set(extraAreas)];

    return (
        <div className="space-y-4">

            {/* ── DASHBOARD DE PROGRESO ─────────────────────────────────────── */}
            {folio && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                        <h3 className="font-bold text-slate-700 dark:text-white text-sm flex items-center gap-2">
                            <BarChart3 size={15} className="text-sky-500" /> Progreso del Inventario
                        </h3>
                        {folio.state === 'open'
                            ? <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold uppercase">Abierto</span>
                            : <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">Cerrado</span>
                        }
                    </div>

                    {/* Cobertura general */}
                    <div className="px-4 pb-4 flex items-center gap-5">
                        <CoverageRing pct={coveragePct} size={88} />
                        <div className="flex-1 space-y-1">
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Teórico</span>
                                <span className="font-bold text-slate-700 dark:text-white">{totalTeorico.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Escaneado</span>
                                <span className="font-bold text-sky-600">{totalEscaneado.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                <span>Diferencia</span>
                                <span className={`font-bold ${totalEscaneado - totalTeorico >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                    {totalEscaneado - totalTeorico >= 0 ? '+' : ''}{(totalEscaneado - totalTeorico).toLocaleString()}
                                </span>
                            </div>
                            {activeSessions.length > 0 && (
                                <div className="flex items-center gap-1 pt-1">
                                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                        {activeSessions.length} escáner{activeSessions.length > 1 ? 'es' : ''} activo{activeSessions.length > 1 ? 's' : ''}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Progreso por área */}
                    {(areaEntries.length > 0 || uniqueExtraAreas.length > 0) && (
                        <div className="border-t dark:border-slate-700 px-4 py-3 space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Áreas</p>
                            {[...areaEntries, ...uniqueExtraAreas.map(a => [a, 0] as [string, number])].map(([area, count]) => {
                                const activeHere = sessionsByArea[area as string] || [];
                                const barPct = maxAreaCount > 0 ? ((count as number) / maxAreaCount) * 100 : 0;
                                return (
                                    <div key={area as string}>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{area as string}</span>
                                                {activeHere.map(s => (
                                                    <span key={s.id} className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 shrink-0">
                                                        <div className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                                                        {s.operator.split(' ')[0]}
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 ml-2 shrink-0">{(count as number).toLocaleString()}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{
                                                    width: `${barPct}%`,
                                                    background: activeHere.length > 0
                                                        ? 'linear-gradient(90deg, #10b981, #34d399)'
                                                        : 'linear-gradient(90deg, #38bdf8, #0ea5e9)',
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── SESIONES ACTIVAS ──────────────────────────────────────────── */}
            <div className="flex items-center gap-2">
                <Wifi size={16} className="text-emerald-500" />
                <h2 className="font-bold text-slate-800 dark:text-white">Sesiones de Escáner</h2>
                <div className="ml-auto flex items-center gap-2">
                    {activeSessions.length > 0 && (
                        <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                            {activeSessions.length} activa(s)
                        </span>
                    )}
                    <button
                        onClick={() => importRef.current?.click()}
                        disabled={importing}
                        className="flex items-center gap-1 text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border border-violet-200 dark:border-violet-700 px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                    >
                        <Upload size={12} /> {importing ? 'Importando…' : 'Importar JSON'}
                    </button>
                    <input ref={importRef} type="file" accept=".json" className="hidden" onChange={handleImportFile} />
                </div>
            </div>

            {activeSessions.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p className="font-medium">Sin sesiones activas</p>
                    <p className="text-sm mt-1">Cuando un scanner inicie un escaneo aparecerá aquí</p>
                </div>
            )}

            {activeSessions.map(session => (
                <div key={session.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                    <span className="font-bold text-slate-800">{session.area}</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                                    <Users size={12} /> {session.operator}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {typeof session.createdAt === 'number' ? formatDate(session.createdAt) : 'Activo'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-sky-600">{session.count || 0}</p>
                                <p className="text-xs text-slate-400">escaneos</p>
                            </div>
                        </div>
                    </div>
                    <div className="border-t bg-slate-50 px-4 py-2 flex gap-2">
                        <button onClick={() => loadItems(session.id)} className="flex items-center gap-1 text-xs bg-white border px-3 py-1.5 rounded-lg text-slate-600">
                            {loadingItems === session.id ? '...' : expanded === session.id ? <><ChevronUp size={12} /> Ocultar</> : <><Eye size={12} /> Ver items</>}
                        </button>
                        <button onClick={() => exportSession(session)} className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold">
                            <Download size={12} /> JSON
                        </button>
                        <button
                            onClick={() => syncSession(session)}
                            disabled={syncing === session.id}
                            className="flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                        >
                            {syncing === session.id ? '...' : <><RefreshCw size={12} /> Sincronizar</>}
                        </button>
                        <button onClick={() => deleteSession(session.id)} className="text-red-400 px-2 py-1.5 ml-auto"><Trash2 size={14} /></button>
                    </div>
                    {expanded === session.id && items[session.id] && (
                        <div className="border-t max-h-60 overflow-y-auto">
                            {items[session.id].map(item => (
                                <div key={item.id} className={`px-4 py-2 border-b last:border-0 flex justify-between text-xs ${!item.recognized ? 'bg-red-50' : ''}`}>
                                    <span className={item.recognized ? 'text-slate-700' : 'text-red-600 font-mono'}>
                                        {item.recognized ? `${item.mod} · ${item.color} · ${formatTallaFromVkey(item.talla, item.vkey)}` : item.code}
                                    </span>
                                    <span className="text-slate-400">{formatDate(item.ts)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
            {confirmModal}
        </div>
    );
};

