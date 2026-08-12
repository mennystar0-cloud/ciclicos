import { useState, useMemo } from 'react';
import { splitKey } from './utils.ts';
import { formatTallaConCategoria } from './ropaUtils.ts';
import { Search } from './icons.tsx';
import type { Folio, Scan } from './types.ts';

export const QueryTab = ({ folio, scans }: { folio: Folio | null; scans: Scan[] }) => {
    const [query, setQuery] = useState('');
    const results = useMemo(() => {
        if (!folio || !query.trim()) return [];
        const q = query.trim().toUpperCase();
        const allKeys = new Set([...Object.keys(folio.theoreticalMap || {}), ...Object.keys(folio.existenciasMap || {})]);
        return Array.from(allKeys).map(vkey => {
            const parts = splitKey(vkey);
            if (!parts.mod.includes(q) && !parts.color.includes(q) && !parts.talla.includes(q)) return null;
            const teo = folio.theoreticalMap[vkey] || 0;
            const fis = folio.existenciasMap[vkey] || 0;
            const areaMap: { [a: string]: number } = {};
            scans.filter(s => s.vkey === vkey).forEach(s => { areaMap[s.area] = (areaMap[s.area] || 0) + 1; });
            return { vkey, teo, fis, diff: fis - teo, areaMap, ...parts };
        }).filter(Boolean) as any[];
    }, [folio, query, scans]);

    if (!folio) return <div className="text-center py-12 text-slate-400"><Search className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>Abre un inventario primero</p></div>;

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input className="w-full border-2 border-sky-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-sky-400" placeholder="Buscar modelo, color o talla..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            {results.map(r => (
                <div key={r.vkey} className="bg-white rounded-xl border shadow-sm p-4">
                    <div className="flex justify-between items-start">
                        <div><p className="font-bold text-slate-800">{r.mod}</p><p className="text-sm text-slate-500">{r.color} · Talla {formatTallaConCategoria(r.talla, r.vkey)}</p></div>
                        <div className="text-right"><p className="text-xs text-slate-400">Teo / Fís</p><p className="text-lg font-bold">{r.teo} / <span className={r.fis >= r.teo ? 'text-emerald-600' : 'text-red-500'}>{r.fis}</span></p></div>
                    </div>
                    {Object.keys(r.areaMap).length > 0 && (
                        <div className="mt-2 pt-2 border-t flex flex-wrap gap-2">
                            {Object.entries(r.areaMap).map(([a, c]) => <span key={a} className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">{a}: {c as number}</span>)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};
