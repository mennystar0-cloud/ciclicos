import { useState, useEffect, useCallback } from 'react';
import { fbGetAllFolios, fbCreateFolio, fbDeleteFolio, fbUpdateFolio } from './firebase.ts';
import { formatDate } from './utils.ts';
import { useConfirm } from './hooks.tsx';
import { Plus, ArrowRight, Lock, Unlock, MessageSquare, Trash2, ClipboardList } from './icons.tsx';
import type { Folio, ColorMap, Catalog, ToastType } from './types.ts';

export const FolioTab = ({ onJoin, onCreate, addToast, colors, catalog, sucursalId }: {
    onJoin: (id: string) => void; onCreate: (id: string) => void;
    addToast: (m: string, t?: ToastType) => void;
    colors: ColorMap; catalog: Catalog; sucursalId?: string;
}) => {
    const [folios, setFolios] = useState<Folio[]>([]);
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const [almacen, setAlmacen] = useState('');
    const [temporada, setTemporada] = useState('');
    const [savedWarehouses, setSavedWarehouses] = useState<string[]>([]);
    const [notes, setNotes] = useState<{ [id: string]: string }>({});
    const [expandedNote, setExpandedNote] = useState<string | null>(null);
    const [closingFolio, setClosingFolio] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { confirm: askConfirm, modal: confirmModal } = useConfirm();

    const load = useCallback(async () => {
        setLoading(true);
        const all = await fbGetAllFolios(sucursalId);
        setFolios((all as Folio[]).sort((a, b) => b.createdAt - a.createdAt));
        const wh = JSON.parse(localStorage.getItem('conteo:warehouses') || '[]');
        setSavedWarehouses(wh);
        const n = JSON.parse(localStorage.getItem('conteo:notes') || '{}');
        setNotes(n);
        setLoading(false);
    }, [sucursalId]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!almacen.trim()) { addToast('Escribe el almacen', 'warning'); return; }
        const existing = folios.find(f => f.state === 'open');
        if (existing) { addToast('Ya hay un inventario abierto: ' + existing.name, 'warning'); return; }
        const fecha = new Date().toLocaleDateString('es-MX', { day:'2-digit', month:'2-digit', year:'2-digit' }).replace(/\//g,'-');
        const autoName = [almacen.trim().toUpperCase(), temporada.trim() || '', fecha].filter(Boolean).join(' · ');
        const id = 'F-' + Date.now().toString(36).toUpperCase();
        const f: Folio = {
            id, name: autoName, almacen: almacen.trim(),
            temporada: temporada.trim(), state: 'open',
            theoreticalMap: {}, existenciasMap: {}, areaCounters: {}, createdAt: Date.now(),
            sucursalId,
        };
        await fbCreateFolio(f);
        if (almacen.trim() && !savedWarehouses.includes(almacen.trim())) {
            const updated = [almacen.trim(), ...savedWarehouses].slice(0, 8);
            setSavedWarehouses(updated);
            localStorage.setItem('conteo:warehouses', JSON.stringify(updated));
        }
        setCreating(false); setName(''); setAlmacen(''); setTemporada('');
        addToast(`Inventario "${f.name}" creado`, 'success');
        await load();
        onCreate(id);
    };

    const handleClose = async (fid: string) => { setClosingFolio(fid); };

    const confirmClose = async (fid: string) => {
        const all = await fbGetAllFolios(sucursalId);
        const f = all.find((x: any) => x.id === fid) as Folio;
        if (!f) return;
        await fbUpdateFolio({ ...f, state: 'closed', sucursalId });
        setClosingFolio(null);
        addToast('Inventario cerrado', 'info');
        await load();
    };

    const handleReopen = async (fid: string) => {
        const all = await fbGetAllFolios(sucursalId);
        const f = all.find((x: any) => x.id === fid) as Folio;
        if (!f) return;
        await fbUpdateFolio({ ...f, state: 'open', sucursalId });
        addToast('Inventario reabierto', 'success');
        await load();
    };

    const handleDelete = async (fid: string) => {
        const ok = await askConfirm('Se eliminarán todos los escaneos del inventario. Esta acción no se puede deshacer.', '¿Eliminar inventario?');
        if (!ok) return;
        await fbDeleteFolio(fid, sucursalId);
        addToast('Inventario eliminado', 'warning');
        await load();
    };

    const saveNote = (fid: string, text: string) => {
        const updated = { ...notes, [fid]: text };
        setNotes(updated);
        localStorage.setItem('conteo:notes', JSON.stringify(updated));
    };

    if (loading) return <div className="text-center py-12 text-slate-400"><div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" /><p>Cargando...</p></div>;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">Inventarios</h2>
                <button onClick={() => setCreating(true)} className="flex items-center gap-1 bg-sky-500 text-white px-3 py-2 rounded-lg text-sm font-semibold">
                    <Plus size={16} /> Nuevo
                </button>
            </div>

            {creating && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-sky-200 dark:border-sky-900 p-4 shadow-sm space-y-3">
                    <p className="font-semibold text-slate-700 dark:text-white">Nuevo Inventario</p>
                    <div className="bg-sky-50 dark:bg-sky-900/20 rounded-lg p-2 text-xs text-sky-600 dark:text-sky-300">
                        El nombre se genera automáticamente: ALMACEN · TEMPORADA · FECHA
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Almacén *</label>
                        <input className="w-full border dark:border-slate-600 rounded-lg p-2 text-sm mt-1 dark:bg-slate-700 dark:text-white" placeholder="Ej: Caballero, Dama, Bodega..." value={almacen} onChange={e => setAlmacen(e.target.value)} autoFocus />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Temporada</label>
                        <input className="w-full border dark:border-slate-600 rounded-lg p-2 text-sm mt-1 dark:bg-slate-700 dark:text-white" placeholder="Ej: PV2025, OI2025 (opcional)" value={temporada} onChange={e => setTemporada(e.target.value)} />
                    </div>
                    {almacen.trim() && (
                        <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-2 text-xs text-slate-500 dark:text-slate-300">
                            Nombre: <strong>{[almacen.trim().toUpperCase(), temporada.trim() || '', new Date().toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}).replace(/\//g,'-')].filter(Boolean).join(' · ')}</strong>
                        </div>
                    )}
                    {folios.find(f => f.state === 'open') && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 text-xs text-red-600 dark:text-red-400">
                            ⚠️ Ya hay un inventario abierto: <strong>{folios.find(f => f.state === 'open')?.name}</strong>. Ciérralo antes de crear uno nuevo.
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={handleCreate} disabled={!!folios.find(f => f.state === 'open')} className="flex-1 bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-semibold">Crear</button>
                        <button onClick={() => { setCreating(false); setAlmacen(''); setTemporada(''); }} className="flex-1 bg-slate-100 dark:bg-slate-700 dark:text-white text-slate-700 rounded-lg py-2 text-sm">Cancelar</button>
                    </div>
                </div>
            )}

            {folios.length === 0 && !creating && (
                <div className="text-center py-12 text-slate-400">
                    <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>No hay inventarios. Crea uno para comenzar.</p>
                </div>
            )}

            {folios.map(f => (
                <div key={f.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${f.state === 'open' ? 'border-emerald-200' : 'border-slate-200 opacity-75'}`}>
                    <div className="p-4">
                        <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${f.state === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {f.state === 'open' ? 'Abierto' : 'Cerrado'}
                                    </span>
                                    <span className="font-bold text-slate-800 text-sm truncate">{f.name}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{f.almacen} {f.temporada && `· ${f.temporada}`}</p>
                                <p className="text-xs text-slate-400">{formatDate(f.createdAt)}</p>
                            </div>
                        </div>
                        {expandedNote === f.id ? (
                            <div className="mt-3">
                                <textarea className="w-full border rounded-lg p-2 text-xs resize-none" rows={3} placeholder="Observaciones..." value={notes[f.id] || ''} onChange={e => saveNote(f.id, e.target.value)} />
                                <button onClick={() => setExpandedNote(null)} className="text-xs text-sky-500 mt-1">Guardar</button>
                            </div>
                        ) : notes[f.id] && <p className="text-xs text-slate-500 italic mt-2 bg-amber-50 p-2 rounded-lg">{notes[f.id]}</p>}
                    </div>
                    <div className="border-t bg-slate-50 px-4 py-2 flex gap-2 flex-wrap">
                        {f.state === 'open' && (
                            <>
                                <button onClick={() => onJoin(f.id)} className="flex items-center gap-1 text-xs bg-sky-500 text-white px-3 py-1.5 rounded-lg font-semibold"><ArrowRight size={12} /> Abrir</button>
                                <button onClick={() => handleClose(f.id)} className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg"><Lock size={12} /> Cerrar</button>
                            </>
                        )}
                        {f.state === 'closed' && (
                            <button onClick={() => handleReopen(f.id)} className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg"><Unlock size={12} /> Reabrir</button>
                        )}
                        <button onClick={() => setExpandedNote(expandedNote === f.id ? null : f.id)} className="flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg"><MessageSquare size={12} /> Nota</button>
                        <button onClick={() => handleDelete(f.id)} className="text-red-400 px-2 py-1.5 ml-auto"><Trash2 size={12} /></button>
                    </div>
                    {closingFolio === f.id && (
                        <div className="border-t bg-amber-50 p-4 text-sm">
                            <p className="font-semibold text-amber-800 mb-1">¿Cerrar inventario?</p>
                            <p className="text-amber-600 text-xs mb-3">Los datos se conservan pero no aceptará más escaneos.</p>
                            <div className="flex gap-2">
                                <button onClick={() => confirmClose(f.id)} className="flex-1 bg-amber-500 text-white rounded-lg py-1.5 text-sm font-semibold">Confirmar</button>
                                <button onClick={() => setClosingFolio(null)} className="flex-1 bg-white border rounded-lg py-1.5 text-sm">Cancelar</button>
                            </div>
                        </div>
                    )}
                </div>
            ))}
            {confirmModal}
        </div>
    );
};
