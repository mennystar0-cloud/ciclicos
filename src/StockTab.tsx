import React, { useState } from 'react';
import { fbGetFolio, fbUpdateFolio } from './firebase.ts';
import {
    cleanModel, canonical, keyOf, detectCategoryBySize,
} from './utils.ts';
import {
    detectSistemaByTalla, normalizeTallaRopa, ropaTallaToCode,
    sizeSystemByModel, tallaVariantByModel, formatTallaConCategoria,
} from './ropaUtils.ts';
import { Check, Boxes } from './icons.tsx';
import type { Folio, Catalog, ColorMap, StockMap, ToastType } from './types.ts';

const Stepper = ({ steps, current }: { steps: string[]; current: number }) => (
    <div className="flex items-center mb-4 overflow-x-auto">
        {steps.map((s, i) => (
            <React.Fragment key={i}>
                <div className={`flex flex-col items-center flex-shrink-0 ${i <= current ? 'text-sky-600' : 'text-slate-300'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${i < current ? 'bg-sky-500 border-sky-500 text-white' : i === current ? 'border-sky-500 text-sky-600' : 'border-slate-200 text-slate-300'}`}>
                        {i < current ? <Check size={14} /> : i + 1}
                    </div>
                    <span className="text-[10px] font-medium mt-1 whitespace-nowrap">{s}</span>
                </div>
                {i < steps.length - 1 && <div className={`h-0.5 flex-1 mx-1 ${i < current ? 'bg-sky-400' : 'bg-slate-200'}`} />}
            </React.Fragment>
        ))}
    </div>
);

export const StockTab = ({ folioId, catalog, colors, onUpdate, addToast, sucursalId }: {
    folioId: string | null; catalog: Catalog; colors: ColorMap;
    onUpdate: () => void; addToast: (m: string, t?: ToastType) => void;
    sucursalId?: string;
}) => {
    const [rawText, setRawText] = useState('');
    const [preview, setPreview] = useState<any[]>([]);
    const [mode, setMode] = useState<'replace' | 'add'>('add');
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const parseRaw = () => {
        const lines = rawText.trim().split('\n').filter(l => l.trim());
        const parsed: any[] = [];

        const tallasNumPorModelo: Record<string, number[]> = {};
        for (const line of lines) {
            const trimmed = line.trim();
            const commaIdx = trimmed.indexOf(',');
            if (commaIdx === -1) continue;
            const mod = trimmed.substring(0, commaIdx).trim();
            const rest = trimmed.substring(commaIdx + 1).trim().split(/\s+/);
            if (rest.length < 3) continue;
            const talla = rest[rest.length - 2];
            const n = parseInt(talla.replace(/[^0-9]/g, ''));
            if (!isNaN(n) && /^\d+$/.test(talla)) {
                const mk = mod.replace(/[^A-Z0-9]/gi, '').toUpperCase();
                if (!tallasNumPorModelo[mk]) tallasNumPorModelo[mk] = [];
                tallasNumPorModelo[mk].push(n);
            }
        }

        const JDAMA = new Set([30,50,70,90,110,130,150,170]);
        const calzadoModelos = new Set<string>();
        for (const [mk, tallasArr] of Object.entries(tallasNumPorModelo)) {
            const unicas = [...new Set(tallasArr)];
            const n = unicas.length;
            const todasJeansDama = unicas.every(t => JDAMA.has(t));
            const todasJeansCab  = unicas.every(t => t >= 300 && t % 20 === 0);
            if (n >= 3 && todasJeansDama) continue;
            if (n >= 2 && todasJeansCab)  continue;
            calzadoModelos.add(mk);
        }
        const calzadoInfantilModelos = calzadoModelos;

        for (const line of lines) {
            const trimmed = line.trim();
            let modRaw = '';
            let rest = '';

            const commaIdx = trimmed.indexOf(',');
            if (commaIdx !== -1) {
                modRaw = trimmed.substring(0, commaIdx).trim();
                rest = trimmed.substring(commaIdx + 1).trim();
            } else {
                const firstSpace = trimmed.search(/\s/);
                if (firstSpace === -1) continue;
                modRaw = trimmed.substring(0, firstSpace).trim();
                rest = trimmed.substring(firstSpace).trim();
            }

            const parts = rest.split(/\s+/);
            if (parts.length < 3) continue;
            const qty = parseInt(parts[parts.length - 1]);
            const tallaRaw = parts[parts.length - 2];
            const colorRaw = parts.slice(0, parts.length - 2).join(' ');
            if (isNaN(qty) || !modRaw || !colorRaw || !tallaRaw) continue;
            const uTalla = tallaRaw.toUpperCase().trim();
            const isUni = uTalla === 'UNI' || uTalla === 'UNITALLA';

            const nTalla = parseInt(uTalla.replace(/[^0-9]/g, ''));
            const isMeses    = /^\d{1,2}M$/.test(uTalla);
            const isBrasier  = /^\d{2}[ABCD]$/.test(uTalla) && parseInt(uTalla) >= 28;
            const isAnos     = /^(0[2-9]|1[02])A$/i.test(uTalla);
            const nBase = (nTalla >= 30 && nTalla <= 170 && nTalla % 10 === 0)
                ? nTalla / 10
                : nTalla > 50 ? nTalla / 10 : nTalla;
            const isJeansCab = !isUni && !isBrasier && !isAnos && !isMeses &&
                               !isNaN(nTalla) && nTalla >= 300 && nTalla <= 500 &&
                               nTalla % 20 === 0;
            const modKey0 = cleanModel(modRaw);
            const isCalzadoModelo = calzadoModelos.has(modKey0);
            const isJeansCabFinal = isJeansCab && !isCalzadoModelo;
            const isJeansDama= !isUni && !isBrasier && !isAnos && !isMeses && !isJeansCabFinal &&
                               !isNaN(nBase) && nBase >= 3 && nBase <= 17 && nBase % 2 === 1 &&
                               /^\d+$/.test(uTalla) &&
                               !isCalzadoModelo;
            const isLetrasDama = !isUni && !isBrasier && !isAnos && !isMeses && !isJeansCab && !isJeansDama &&
                ['CH','M','G','XG','EXG','XCH','CHI','MED','GDE','XXG','CHM','GEX','3EG'].some(x => uTalla === x || uTalla.startsWith(x));
            const isRopaTalla = isLetrasDama || isJeansDama || isJeansCabFinal || isMeses || isBrasier || isAnos;

            let tallaNorm: string;
            let catFinal: 'calzado' | 'ropa';
            let ropaCode = '000';

            if (isUni) {
                const modKey = cleanModel(modRaw);
                const sistemaExistente = sizeSystemByModel[modKey];
                if (sistemaExistente) {
                    catFinal = 'ropa'; tallaNorm = 'UNI'; ropaCode = '990';
                } else {
                    tallaNorm = '100'; catFinal = 'calzado';
                }
            } else if (isRopaTalla) {
                catFinal = 'ropa';
                const modKey = modKey0;
                const sistema = detectSistemaByTalla(tallaRaw, modKey);
                tallaNorm = normalizeTallaRopa(tallaRaw, sistema);
                ropaCode  = ropaTallaToCode(tallaNorm, sistema);
                const uTallaVar = tallaRaw.toUpperCase().trim();
                if (sistema === 'dama') {
                    if (!tallaVariantByModel[modKey]) tallaVariantByModel[modKey] = {};
                    if (uTallaVar === 'CHM' || uTallaVar === 'CHI')  tallaVariantByModel[modKey]['CH']  = uTallaVar;
                    if (uTallaVar === 'GEX' || uTallaVar === 'GDE')  tallaVariantByModel[modKey]['G']   = uTallaVar;
                    if (uTallaVar === 'MED')                          tallaVariantByModel[modKey]['M']   = 'MED';
                }
            } else {
                tallaNorm = tallaRaw;
                catFinal  = detectCategoryBySize(tallaRaw);
            }

            const vkey = catFinal === 'ropa'
                ? (ropaCode !== '000'
                    ? ('R|' + cleanModel(modRaw) + '|' + canonical(colorRaw) + '|' + ropaCode)
                    : keyOf(modRaw, colorRaw, tallaNorm, 'ropa'))
                : keyOf(modRaw, colorRaw, tallaNorm, catFinal);
            parsed.push({ mod: cleanModel(modRaw), color: canonical(colorRaw), talla: tallaNorm, qty, vkey, cat: catFinal });
        }
        const ropaModelKeys = new Set(parsed.filter(p => p.cat === 'ropa').map(p => p.mod));
        const finalParsed = parsed.map(p => {
            if (p.cat === 'calzado' && p.talla === '100') {
                if (ropaModelKeys.has(p.mod)) {
                    const ropaVkey = 'R|' + p.mod + '|' + p.color + '|990';
                    return { ...p, cat: 'ropa' as const, talla: 'UNI', vkey: ropaVkey };
                }
            }
            return p;
        });
        setPreview(finalParsed); setStep(1);
    };

    const handleConfirm = async () => {
        if (!folioId) { addToast('Selecciona un inventario primero', 'warning'); return; }
        setLoading(true);
        try {
            const theoretical: StockMap = {};
            for (const item of preview) {
                if (mode === 'replace') theoretical[item.vkey] = item.qty;
                else theoretical[item.vkey] = (theoretical[item.vkey] || 0) + item.qty;
            }

            const folio = await fbGetFolio(folioId, sucursalId) as Folio | null;
            if (!folio) {
                addToast('No se encontró el inventario en Firebase', 'error');
                setLoading(false);
                return;
            }

            let mergedMap: StockMap;
            if (mode === 'replace') {
                mergedMap = theoretical;
            } else {
                mergedMap = { ...(folio.theoreticalMap || {}) };
                for (const [vkey, qty] of Object.entries(theoretical)) {
                    mergedMap[vkey] = (mergedMap[vkey] || 0) + qty;
                }
            }

            for (const [mod, variants] of Object.entries(tallaVariantByModel)) {
                for (const [base, variant] of Object.entries(variants)) {
                    if (base !== variant) mergedMap[`R|${mod}|__VAR__|${base}:${variant}`] = 0;
                }
            }

            const sistemas = new Map<string, string>();
            for (const [vkey] of Object.entries(mergedMap)) {
                if (!vkey.startsWith('R|')) continue;
                const p = vkey.split('|');
                const mod = p[1]; const sys = sizeSystemByModel[mod];
                if (mod && sys) sistemas.set(mod, sys);
            }
            for (const [mod, sys] of sistemas) {
                mergedMap[`R|${mod}|__SYS__|${sys}`] = 0;
            }

            await fbUpdateFolio({ ...folio, theoreticalMap: mergedMap, sucursalId });

            onUpdate();
            addToast(`✓ ${preview.length} variantes cargadas correctamente`, 'success');
            setRawText(''); setPreview([]); setStep(0);
        } catch (err: any) {
            console.error('Error al cargar teórico:', err);
            addToast(`Error al guardar: ${err?.message || 'revisa la consola'}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!folioId) return <div className="text-center py-12 text-slate-400"><Boxes className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>Abre un inventario primero</p></div>;

    return (
        <div className="space-y-4">
            <Stepper steps={['Pegar Datos', 'Validar', 'Confirmar']} current={step} />
            {step === 0 && (
                <>
                    <div className="bg-sky-50 rounded-xl p-3 text-xs text-sky-700 border border-sky-100">
                        <p className="font-semibold mb-1">Formato:</p>
                        <pre className="text-sky-600">MODELO COLOR TALLA CANTIDAD{'\n'}NIKEAIR NEGRO 27 10</pre>
                    </div>
                    <textarea className="w-full border rounded-xl p-3 text-sm font-mono resize-none" rows={10} placeholder="Pega el inventario teórico aquí..." value={rawText} onChange={e => setRawText(e.target.value)} />
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={mode === 'add'} onChange={() => setMode('add')} /> Agregar</label>
                        <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Reemplazar</label>
                    </div>
                    <button onClick={parseRaw} disabled={!rawText.trim()} className="w-full bg-sky-500 text-white rounded-xl py-3 font-semibold disabled:opacity-40">Validar →</button>
                </>
            )}
            {step === 1 && (
                <>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">✓ {preview.length} variantes identificadas</div>
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                        {preview.map((p, i) => (
                            <div key={i} className="flex justify-between text-xs bg-white border rounded-lg px-3 py-2">
                                <span className="font-mono">{p.mod} · {p.color} · {formatTallaConCategoria(p.talla, p.vkey)}</span>
                                <span className="font-bold text-slate-700">{p.qty} pzas</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleConfirm} disabled={loading} className="flex-1 bg-emerald-500 text-white rounded-xl py-3 font-semibold disabled:opacity-50">{loading ? 'Cargando...' : 'Cargar Teórico'}</button>
                        <button onClick={() => { setStep(0); setPreview([]); }} className="flex-1 bg-slate-100 text-slate-700 rounded-xl py-3">Volver</button>
                    </div>
                </>
            )}
        </div>
    );
};
