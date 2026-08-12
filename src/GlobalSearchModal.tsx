import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X } from './icons.tsx';
import type { Folio, Scan, Catalog } from './types.ts';

export const GlobalSearchModal = ({ folio, scans, catalog, onClose }: {
    folio: Folio | null; scans: Scan[]; catalog: Catalog; onClose: () => void;
}) => {
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setTimeout(() => inputRef.current?.focus(), 80); }, []);

    const result = useMemo(() => {
        const q = query.trim().toUpperCase();
        if (!q || !folio) return null;

        let vkey: string | null = null;
        let matchedCode = '';
        const barcodeMatch = catalog.byBarcode[q];
        if (barcodeMatch) { vkey = barcodeMatch.vkey; matchedCode = q; }

        if (!vkey) {
            const byVariantMatch = Object.entries(catalog.byVariant).find(([k]) => {
                const parts = k.split('|');
                return parts.some(p => p.toUpperCase().includes(q));
            });
            if (byVariantMatch) vkey = byVariantMatch[0];
        }

        if (!vkey) return { found: false as const, query: q };

        const item = catalog.byVariant[vkey];
        const teorico = folio.theoreticalMap?.[vkey] ?? 0;

        const matchingScans = scans.filter(s => s.vkey === vkey || s.code === matchedCode);

        const byUser: Record<string, { count: number; area: string; lastTs: number }> = {};
        for (const s of matchingScans) {
            if (!byUser[s.user]) byUser[s.user] = { count: 0, area: s.area, lastTs: s.ts };
            byUser[s.user].count++;
            if (s.ts > byUser[s.user].lastTs) { byUser[s.user].lastTs = s.ts; byUser[s.user].area = s.area; }
        }

        const totalEscaneado = matchingScans.length;
        const diferencia = totalEscaneado - teorico;

        return { found: true as const, vkey, item, teorico, totalEscaneado, diferencia, byUser };
    }, [query, folio, scans, catalog]);

    return (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-start justify-center p-4 pt-16" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-700">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0">
                            <Search size={16} className="text-sky-500" />
                        </div>
                        <input
                            ref={inputRef}
                            className="flex-1 text-sm font-mono bg-transparent border-none outline-none text-slate-800 dark:text-white placeholder-slate-400"
                            placeholder="Código de barras o modelo..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                        />
                        <button onClick={onClose} className="text-slate-400 p-1"><X size={18} /></button>
                    </div>
                </div>

                <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {!folio && (
                        <p className="text-center text-slate-400 text-sm py-4">Abre un inventario primero</p>
                    )}
                    {folio && !query.trim() && (
                        <p className="text-center text-slate-400 text-sm py-4">Escanea o escribe un código</p>
                    )}
                    {result && !result.found && (
                        <div className="text-center py-4">
                            <p className="text-slate-500 text-sm">No se encontró <span className="font-mono font-bold text-slate-700 dark:text-white">{result.query}</span></p>
                            <p className="text-xs text-slate-400 mt-1">en el inventario teórico</p>
                        </div>
                    )}
                    {result?.found && (
                        <>
                            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-1">SKU identificado</p>
                                <p className="font-bold text-slate-800 dark:text-white text-sm">
                                    {result.item?.mod} · {result.item?.color} · {result.item?.talla}
                                </p>
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5 break-all">{result.vkey}</p>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-3 text-center">
                                    <p className="text-[10px] text-slate-400 uppercase font-bold">Teórico</p>
                                    <p className="text-2xl font-black text-slate-700 dark:text-white">{result.teorico}</p>
                                </div>
                                <div className="bg-sky-50 dark:bg-sky-900/30 rounded-xl p-3 text-center">
                                    <p className="text-[10px] text-sky-500 uppercase font-bold">Escaneado</p>
                                    <p className="text-2xl font-black text-sky-600">{result.totalEscaneado}</p>
                                </div>
                                <div className={`rounded-xl p-3 text-center ${result.diferencia === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : result.diferencia > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                                    <p className={`text-[10px] uppercase font-bold ${result.diferencia === 0 ? 'text-emerald-500' : result.diferencia > 0 ? 'text-amber-500' : 'text-red-500'}`}>Diferencia</p>
                                    <p className={`text-2xl font-black ${result.diferencia === 0 ? 'text-emerald-600' : result.diferencia > 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                        {result.diferencia > 0 ? '+' : ''}{result.diferencia}
                                    </p>
                                </div>
                            </div>

                            {Object.keys(result.byUser).length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Registrado por</p>
                                    <div className="space-y-1.5">
                                        {Object.entries(result.byUser)
                                            .sort((a, b) => b[1].count - a[1].count)
                                            .map(([user, info]) => (
                                                <div key={user} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-xl px-3 py-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-700 dark:text-white">{user}</p>
                                                        <p className="text-[10px] text-slate-400">{info.area} · {new Date(info.lastTs).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</p>
                                                    </div>
                                                    <span className="text-lg font-black text-sky-600">{info.count}</span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            )}
                            {result.totalEscaneado === 0 && (
                                <p className="text-center text-slate-400 text-xs py-1">Aún no se ha escaneado este código</p>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
