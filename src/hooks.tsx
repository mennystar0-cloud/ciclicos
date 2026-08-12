import { useState } from 'react';
import { AlertTriangle } from './icons.tsx';

export const useConfirm = () => {
    const [state, setState] = useState<{ title: string; msg: string; confirmLabel?: string; resolve: (v: boolean) => void } | null>(null);

    const confirm = (msg: string, title = '¿Confirmar?', confirmLabel = 'Eliminar'): Promise<boolean> =>
        new Promise(resolve => setState({ msg, title, confirmLabel, resolve }));

    const close = (val: boolean) => { state?.resolve(val); setState(null); };

    const modal = state ? (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end sm:items-center justify-center p-4" onClick={() => close(false)}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={18} className="text-red-500" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800 dark:text-white">{state.title}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{state.msg}</p>
                    </div>
                </div>
                <div className="flex gap-2 pt-1">
                    <button onClick={() => close(false)}
                        className="flex-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white py-2.5 rounded-xl font-medium text-sm active:scale-95">
                        Cancelar
                    </button>
                    <button onClick={() => close(true)}
                        className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl font-bold text-sm active:scale-95">
                        {state.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    ) : null;

    return { confirm, modal };
};
