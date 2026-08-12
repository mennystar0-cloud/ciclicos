import { useState } from 'react';
import { loadUIPrefs, saveUIPrefs, type FontSize } from './uiUtils.ts';

export const SettingsPanel = ({ onClose }: { onClose: () => void }) => {
    const prefs = loadUIPrefs();
    const [dark, setDark] = useState(prefs.dark);
    const [font, setFont] = useState<FontSize>(prefs.font);
    const handleDark = (v: boolean) => { setDark(v); saveUIPrefs(v, font); };
    const handleFont = (v: FontSize) => { setFont(v); saveUIPrefs(dark, v); };
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end" onClick={onClose}>
            <div className="w-full bg-white dark:bg-slate-900 rounded-t-3xl p-6 space-y-5" onClick={e => e.stopPropagation()}>
                <div className="flex justify-center -mt-2"><div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" /></div>
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Apariencia</h2>
                    <button onClick={onClose} className="text-slate-400 text-2xl">x</button>
                </div>
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{dark ? '🌙' : '☀️'}</span>
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-white text-sm">Modo Oscuro</p>
                            <p className="text-xs text-slate-400">Ideal para bodegas con poca luz</p>
                        </div>
                    </div>
                    <button onClick={() => handleDark(!dark)} className={`relative w-12 h-6 rounded-full transition-colors ${dark ? 'bg-sky-500' : 'bg-slate-300'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${dark ? 'left-6' : 'left-0.5'}`} />
                    </button>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 space-y-3">
                    <p className="font-semibold text-slate-800 dark:text-white text-sm">Tamano de fuente</p>
                    <div className="grid grid-cols-4 gap-2">
                        {(['sm','md','lg','xl'] as FontSize[]).map((v,i) => {
                            const labels = ['Pequeno','Normal','Grande','Extra'];
                            const sizes  = ['text-xs','text-sm','text-base','text-lg'];
                            return (
                                <button key={v} onClick={() => handleFont(v)}
                                    className={`rounded-xl py-3 flex flex-col items-center gap-1 transition-all ${font===v ? 'bg-sky-500 text-white' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border dark:border-slate-600'}`}>
                                    <span className={`font-bold ${sizes[i]}`}>Aa</span>
                                    <span className="text-[10px] opacity-80">{labels[i]}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="h-2" />
            </div>
        </div>
    );
};
