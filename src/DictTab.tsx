import { useState, useMemo } from 'react';
import { canonical } from './utils.ts';
import { useConfirm } from './hooks.tsx';
import { Search, Plus, Check, X, Edit2, Trash2 } from './icons.tsx';
import type { ColorMap, ToastType } from './types.ts';

export const DictTab = ({ colors, onUpdate, addToast }: { colors: ColorMap; onUpdate: (m: ColorMap) => void; addToast: (m: string, t?: ToastType) => void }) => {
    const [search, setSearch] = useState('');
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [editing, setEditing] = useState<string | null>(null);
    const [editCode, setEditCode] = useState('');
    const { confirm: askConfirm, modal: confirmModal } = useConfirm();

    const handleDeleteColor = async (name: string) => {
        const ok = await askConfirm(`El color "${name}" será eliminado del diccionario.`, '¿Eliminar color?');
        if (!ok) return;
        const c = { ...colors }; delete c[name]; onUpdate(c);
    };

    const COLOR_SWATCHES: { [k: string]: string } = {
        'NEGRO': '#1a1a1a', 'BLANCO': '#f8f8f8', 'ROJO': '#dc2626', 'AZUL': '#2563eb',
        'VERDE': '#16a34a', 'AMARILLO': '#eab308', 'NARANJA': '#ea580c', 'ROSA': '#ec4899',
        'MORADO': '#9333ea', 'GRIS': '#6b7280', 'CAFE': '#92400e', 'MARINO': '#1e3a5f',
        'BEIGE': '#d2b48c', 'MIEL': '#d4a017', 'CAMEL': '#c19a6b', 'CORAL': '#ff7f6e',
        'MENTA': '#98d8c8', 'LILA': '#c084fc', 'FIUSHA': '#f0047f', 'TURQUESA': '#0e7490',
    };
    const getSwatch = (name: string) => { for (const [k, v] of Object.entries(COLOR_SWATCHES)) { if (name.toUpperCase().startsWith(k)) return v; } return null; };

    const filtered = useMemo(() => {
        const q = search.trim().toUpperCase();
        return Object.entries(colors).filter(([n, c]) => !q || n.includes(q) || c.includes(q));
    }, [colors, search]);

    const handleAdd = () => {
        const n = canonical(newName); const c = newCode.trim().padStart(3, '0').slice(-3);
        if (!n || !c) { addToast('Completa nombre y código', 'warning'); return; }
        onUpdate({ ...colors, [n]: c }); setNewName(''); setNewCode('');
        addToast(`Color "${n}" agregado`, 'success');
    };

    return (
        <div className="space-y-4">
            <div className="relative"><Search size={14} className="absolute left-3 top-3 text-slate-400" /><input className="w-full border rounded-xl pl-8 pr-4 py-2.5 text-sm" placeholder="Buscar color..." value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div className="bg-white rounded-xl border p-4 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Agregar color</p>
                <div className="flex gap-2">
                    <input className="flex-1 border rounded-lg p-2 text-sm" placeholder="Nombre" value={newName} onChange={e => setNewName(e.target.value.toUpperCase())} />
                    <input className="w-20 border rounded-lg p-2 text-sm font-mono" placeholder="000" maxLength={3} value={newCode} onChange={e => setNewCode(e.target.value.replace(/\D/g, ''))} />
                    <button onClick={handleAdd} className="bg-sky-500 text-white px-4 rounded-lg"><Plus size={16} /></button>
                </div>
            </div>
            <p className="text-xs text-slate-400">{filtered.length} colores</p>
            <div className="space-y-1">
                {filtered.map(([name, code]) => (
                    <div key={name} className="bg-white rounded-xl border shadow-sm px-4 py-2.5 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full border border-slate-200 flex-shrink-0" style={{ backgroundColor: getSwatch(name) || `hsl(${parseInt(code) * 1.3 % 360}, 60%, 60%)` }} />
                        <span className="flex-1 text-sm font-medium text-slate-700">{name}</span>
                        {editing === name ? (
                            <div className="flex gap-1">
                                <input className="w-16 border rounded px-2 py-1 text-xs font-mono" value={editCode} onChange={e => setEditCode(e.target.value.replace(/\D/g, '').slice(0, 3))} />
                                <button onClick={() => { onUpdate({ ...colors, [name]: editCode.padStart(3, '0').slice(-3) }); setEditing(null); addToast('Actualizado', 'success'); }} className="text-emerald-500"><Check size={16} /></button>
                                <button onClick={() => setEditing(null)} className="text-slate-400"><X size={16} /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">{code}</span>
                                <button onClick={() => { setEditing(name); setEditCode(code); }} className="text-slate-400"><Edit2 size={14} /></button>
                                <button onClick={() => handleDeleteColor(name)} className="text-red-400"><Trash2 size={14} /></button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {confirmModal}
        </div>
    );
};
