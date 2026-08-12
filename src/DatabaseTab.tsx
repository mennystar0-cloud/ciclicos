import { useState } from 'react';
import { fbGetFullDump, fbRestoreFullDump } from './firebase.ts';
import { Wifi, ShieldCheck, Download, Upload } from './icons.tsx';
import type { ToastType } from './types.ts';

export const DatabaseTab = ({ addToast, sucursalId }: { addToast: (m: string, t?: ToastType) => void; sucursalId?: string | null }) => {
    const [lastBackup, setLastBackup] = useState<string | null>(() => localStorage.getItem('conteo:lastBackup'));

    const handleExport = async () => {
        const dump = await fbGetFullDump(sucursalId);
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `conteo-backup-${new Date().toISOString().split('T')[0]}.json`; a.click();
        const now = new Date().toLocaleString('es-MX');
        setLastBackup(now); localStorage.setItem('conteo:lastBackup', now);
        addToast('Backup exportado', 'success');
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        try {
            const dump = JSON.parse(await file.text());
            await fbRestoreFullDump(dump);
            addToast('Backup restaurado', 'success');
        } catch { addToast('Error al importar', 'error'); }
    };

    return (
        <div className="space-y-4">
            <h2 className="font-bold text-slate-800 text-lg">Base de Datos</h2>
            <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-3 flex items-center gap-2 text-sm text-emerald-700">
                <Wifi size={16} /> Conectado a Firebase Firestore — sincronización en tiempo real
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
                <p className="font-semibold text-slate-700 text-sm">Respaldo</p>
                {lastBackup && <div className="bg-emerald-50 rounded-lg px-3 py-2 text-xs text-emerald-700 flex items-center gap-2"><ShieldCheck size={14} /> Último respaldo: {lastBackup}</div>}
                <button onClick={handleExport} className="w-full flex items-center justify-center gap-2 bg-sky-500 text-white rounded-xl py-3 font-semibold"><Download size={18} /> Exportar Backup (.json)</button>
                <label className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl py-3 text-slate-500 cursor-pointer hover:border-sky-300 hover:text-sky-500">
                    <Upload size={18} /> Restaurar Backup
                    <input type="file" accept=".json" className="hidden" onChange={handleImport} />
                </label>
            </div>
        </div>
    );
};
