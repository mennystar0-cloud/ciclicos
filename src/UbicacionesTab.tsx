import { useState, useMemo } from 'react';
import { formatTallaConCategoria } from './ropaUtils.ts';
import { Search, MapPin } from './icons.tsx';
import type { Folio, Scan, ToastType } from './types.ts';

export const UbicacionesTab = ({ scans }: {
    sucursalId?: string; folio: Folio | null;
    scans: Scan[]; addToast: (m: string, t?: ToastType) => void;
}) => {
    const [consultaMod, setConsultaMod] = useState('');
    const [consultaArea, setConsultaArea] = useState('');

    const normMod = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    const consultaScans = useMemo(() => {
        const q = normMod(consultaMod.trim());
        if (!q) return [];
        return [...scans]
            .filter(s => normMod(s.mod ?? '').includes(q))
            .sort((a, b) => a.ts - b.ts);
    }, [scans, consultaMod]);

    const consultaFiltered = useMemo(() => {
        if (!consultaArea) return consultaScans;
        return consultaScans.filter(s => s.area === consultaArea);
    }, [consultaScans, consultaArea]);

    const consultaPorArea = useMemo(() => {
        const map: Record<string, number> = {};
        consultaScans.forEach(s => { map[s.area] = (map[s.area] ?? 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]);
    }, [consultaScans]);

    const scanGlobalNum = useMemo(() => {
        const sorted = [...scans].sort((a, b) => a.ts - b.ts);
        const map: Record<string, number> = {};
        sorted.forEach((s, i) => { map[s.id] = i + 1; });
        return map;
    }, [scans]);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Ubicaciones por modelo</h2>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{scans.length} escaneos en folio activo</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600 flex items-center gap-2">
                    <Search size={14} className="text-slate-400" />
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Consulta por modelo</span>
                </div>
                <div className="p-3 space-y-3">
                    <div className="relative">
                        <input
                            className="w-full pl-3 pr-8 py-2.5 text-sm bg-slate-50 dark:bg-slate-700 border dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-400 dark:text-white placeholder-slate-400"
                            placeholder="Número de modelo…"
                            value={consultaMod}
                            onChange={e => { setConsultaMod(e.target.value); setConsultaArea(''); }}
                        />
                        {consultaMod && (
                            <button onClick={() => { setConsultaMod(''); setConsultaArea(''); }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg leading-none">×</button>
                        )}
                    </div>

                    {!consultaMod.trim() && scans.length === 0 && (
                        <div className="text-center py-6 text-slate-400">
                            <MapPin size={28} className="mx-auto mb-2 opacity-30" />
                            <p className="text-sm font-medium">No hay escaneos en el folio activo</p>
                            <p className="text-xs mt-1">Abre un folio y escanea artículos para poder consultarlos aquí</p>
                        </div>
                    )}
                    {!consultaMod.trim() && scans.length > 0 && (
                        <div className="text-center py-5 text-slate-400">
                            <p className="text-sm">Escribe un número de modelo para ver en qué posición y área se escaneó cada pieza</p>
                            <p className="text-xs mt-1 text-slate-300">{scans.length} escaneos disponibles</p>
                        </div>
                    )}
                    {consultaMod.trim() && consultaScans.length === 0 && (
                        <p className="text-center text-sm text-slate-400 py-4">Sin escaneos para "{consultaMod.trim()}"</p>
                    )}

                    {consultaScans.length > 0 && (
                        <>
                            <div className="grid grid-cols-3 gap-2">
                                <div className="bg-sky-50 dark:bg-sky-900/20 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-sky-600">{consultaScans.length}</p>
                                    <p className="text-[10px] text-sky-500 uppercase font-semibold">escaneos</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-slate-700 dark:text-white">{consultaPorArea.length}</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-semibold">{consultaPorArea.length === 1 ? 'área' : 'áreas'}</p>
                                </div>
                                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-slate-500 dark:text-slate-400">{scans.length}</p>
                                    <p className="text-[10px] text-slate-400 uppercase font-semibold">en folio</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                <button onClick={() => setConsultaArea('')}
                                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${consultaArea === '' ? 'bg-slate-700 text-white' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300'}`}>
                                    Todas
                                </button>
                                {consultaPorArea.map(([area, cnt]) => (
                                    <button key={area} onClick={() => setConsultaArea(consultaArea === area ? '' : area)}
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors flex items-center gap-1 ${consultaArea === area ? 'bg-sky-500 text-white' : 'bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'}`}>
                                        <span>{area}</span>
                                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${consultaArea === area ? 'bg-sky-400 text-white' : 'bg-sky-100 dark:bg-sky-800 text-sky-600'}`}>{cnt}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="rounded-xl border dark:border-slate-600 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-700 border-b dark:border-slate-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-slate-400 font-semibold w-14">Ubic.</th>
                                            <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-300 font-semibold">Modelo</th>
                                            <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-300 font-semibold">Área</th>
                                            <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-300 font-semibold">Color · Talla</th>
                                            <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-300 font-semibold">Hora</th>
                                            <th className="px-3 py-2 text-left text-slate-500 dark:text-slate-300 font-semibold">Operador</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-slate-700">
                                        {consultaFiltered.map((s) => (
                                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                                <td className="px-3 py-2.5 font-black text-sky-600 text-center text-sm">{scanGlobalNum[s.id] ?? '—'}</td>
                                                <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white">{s.mod}</td>
                                                <td className="px-3 py-2.5">
                                                    <span className="inline-flex items-center gap-1 bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 px-2 py-0.5 rounded-full font-semibold text-xs">
                                                        📍 {s.area}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{s.color} · {formatTallaConCategoria(s.talla, s.vkey)}</td>
                                                <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap">{new Date(s.ts).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
                                                <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 truncate max-w-[80px]">{s.user}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
