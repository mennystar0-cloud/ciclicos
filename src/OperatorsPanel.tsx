import { useState, useEffect } from 'react';
import { fbGetOperadores, fbSaveOperador, fbDeleteOperador, hashPassword } from './firebase.ts';
import { useConfirm } from './hooks.tsx';
import type { ToastType } from './types.ts';

export const PinKeyboard = ({ onSubmit, loading, error }: { onSubmit: (pin: string) => void; loading: boolean; error: string }) => {
    const [pin, setPin] = useState('');
    const tap = (d: string) => { if (d === 'DEL') { setPin(p => p.slice(0,-1)); return; } if (pin.length >= 8) return; setPin(p => p+d); };
    return (
        <div className="space-y-4">
            <div className="flex justify-center gap-3">
                {Array.from({ length: Math.max(4, pin.length) }).map((_,i) => (
                    <div key={i} className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center transition-all ${i < pin.length ? 'bg-sky-500 border-sky-500' : 'bg-white/10 border-white/30'}`}>
                        {i < pin.length && <div className="w-3 h-3 rounded-full bg-white" />}
                    </div>
                ))}
            </div>
            {error && <p className="text-center text-red-400 text-sm">{error}</p>}
            <div className="grid grid-cols-3 gap-2">
                {['1','2','3','4','5','6','7','8','9','','0','DEL'].map((d,i) => (
                    <button key={i} onClick={() => d && tap(d)} disabled={!d}
                        className={`h-14 rounded-xl font-bold text-xl active:scale-95 ${d==='DEL' ? 'bg-red-500/20 text-red-300 text-sm' : d ? 'bg-white/15 text-white hover:bg-white/25' : 'opacity-0 pointer-events-none'}`}>
                        {d === 'DEL' ? '⌫' : d}
                    </button>
                ))}
            </div>
            <button onClick={() => onSubmit(pin)} disabled={pin.length < 4 || loading}
                className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white py-3 rounded-xl font-bold text-lg active:scale-95">
                {loading ? 'Verificando...' : 'Entrar'}
            </button>
        </div>
    );
};

export const OperatorsPanel = ({ sucursalId, onClose, addToast }: { sucursalId: string; onClose: () => void; addToast: (m: string, t?: ToastType) => void }) => {
    const [ops, setOps]         = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editOp, setEditOp]   = useState<any>(null);
    const [nombre, setNombre]   = useState('');
    const [pin, setPin]         = useState('');
    const [rol, setRol]         = useState<'scanner'>('scanner');
    const { confirm: askConfirm, modal: confirmModal } = useConfirm();

    const reload = async () => { setLoading(true); const list = await fbGetOperadores(sucursalId); setOps(list); setLoading(false); };
    useEffect(() => { reload(); }, [sucursalId]);

    const openNew  = () => { setEditOp(null); setNombre(''); setPin(''); setRol('scanner'); setShowForm(true); };
    const openEdit = (op: any) => { setEditOp(op); setNombre(op.nombre); setPin(''); setRol(op.rol); setShowForm(true); };

    const handleSave = async () => {
        if (!nombre.trim()) { addToast('Nombre requerido', 'warning'); return; }
        if (!editOp && pin.length < 4) { addToast('PIN minimo 4 digitos', 'warning'); return; }
        const hashed = pin ? await hashPassword(pin) : (editOp?.pin ?? '');
        const op = {
            id: editOp?.id ?? crypto.randomUUID(),
            nombre: nombre.trim(), pin: hashed, rol, activo: true,
            sucursalId, creadoAt: editOp?.creadoAt ?? Date.now(),
        };
        await fbSaveOperador(sucursalId, op);
        await reload(); setShowForm(false);
        addToast((editOp ? 'Actualizado: ' : 'Creado: ') + nombre.trim(), 'success');
    };

    const handleToggle = async (op: any) => {
        await fbSaveOperador(sucursalId, { ...op, activo: !op.activo });
        await reload();
        addToast(op.nombre + (op.activo ? ' desactivado' : ' activado'), 'info');
    };

    const handleDelete = async (op: any) => {
        const ok = await askConfirm(`Se eliminará permanentemente a ${op.nombre}.`, '¿Eliminar operador?');
        if (!ok) return;
        await fbDeleteOperador(sucursalId, op.id);
        await reload();
        addToast(op.nombre + ' eliminado', 'warning');
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
            <div className="w-full max-h-[90vh] bg-white dark:bg-slate-900 rounded-t-3xl overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-center pt-3"><div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" /></div>
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Operadores</h2>
                        <div className="flex gap-2">
                            <button onClick={openNew} className="bg-sky-500 text-white px-3 py-1.5 rounded-xl text-sm font-bold">+ Nuevo</button>
                            <button onClick={onClose} className="text-slate-400 text-2xl px-2">x</button>
                        </div>
                    </div>
                    {showForm && (
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-3 border dark:border-slate-700">
                            <p className="font-bold text-sm text-slate-700 dark:text-white">{editOp ? 'Editar' : 'Nuevo'} operador</p>
                            <input className="w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white" placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} maxLength={40} />
                            <input className="w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-white dark:bg-slate-700 dark:text-white tracking-widest" type="password" inputMode="numeric" placeholder={editOp ? 'PIN nuevo (vacio = no cambiar)' : 'PIN 4-8 digitos'} value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g,'').slice(0,8))} />
                            <div className="w-full border dark:border-slate-600 rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 dark:text-slate-400 text-slate-500">
                                Rol: Escaner
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleSave} className="flex-1 bg-sky-500 text-white rounded-xl py-2 text-sm font-bold">Guardar</button>
                                <button onClick={() => setShowForm(false)} className="flex-1 bg-slate-200 dark:bg-slate-700 dark:text-white rounded-xl py-2 text-sm">Cancelar</button>
                            </div>
                        </div>
                    )}
                    {loading ? <p className="text-center text-slate-400 py-8">Cargando...</p> : (
                        <div className="space-y-2">
                            {ops.length === 0 && <p className="text-center text-slate-400 py-8 text-sm">Sin operadores. Crea el primero para poder escanear.</p>}
                            {ops.map(op => (
                                <div key={op.id} className={`bg-white dark:bg-slate-800 rounded-2xl p-4 border dark:border-slate-700 flex items-center gap-3${!op.activo ? ' opacity-50' : ''}`}>
                                    <div className="w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center flex-shrink-0">
                                        <span className="text-sky-700 dark:text-sky-300 font-bold text-sm">{op.nombre.slice(0,2).toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-slate-800 dark:text-white text-sm truncate">{op.nombre}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-100 text-sky-700">Escaner</span>
                                            {op.ultimoLogin && <span className="text-[10px] text-slate-400">Ultimo: {new Date(op.ultimoLogin).toLocaleDateString('es-MX')}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button onClick={() => openEdit(op)} className="p-2 text-slate-400 hover:text-sky-600 rounded-lg">✏️</button>
                                        <button onClick={() => handleToggle(op)} className="p-2 text-slate-400 hover:text-amber-600 rounded-lg">{op.activo ? '🚫' : '✅'}</button>
                                        <button onClick={() => handleDelete(op)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg">🗑️</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
                        🔐 PINs cifrados (SHA-256). Sesion de escaner: 8 horas · Admin: sin limite.
                    </div>
                    <div className="h-4" />
                </div>
            </div>
            {confirmModal}
        </div>
    );
};
