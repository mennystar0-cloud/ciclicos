import { useState, useEffect, useCallback, useRef } from 'react';
import { fbAddScan, fbDeleteScan } from './firebase.ts';
import { tryDecodeStructuredBarcode } from './utils.ts';
import { formatTallaFromVkey } from './ropaUtils.ts';
import { QrCode, Zap, Camera, CameraOff, Undo2, Check, X, Volume2, VolumeX, Plus } from './icons.tsx';
import { CoverageRing } from './CoverageRing.tsx';
import type { Folio, Catalog, ColorMap, Scan, Role, ToastType } from './types.ts';

export const ScanTab = ({ folio, catalog, colors, scans, role, addToast }: {
    folio: Folio | null; catalog: Catalog; colors: ColorMap;
    scans: Scan[]; role: Role; addToast: (m: string, t?: ToastType) => void;
}) => {
    const [barcode, setBarcode] = useState('');
    const [area, setArea] = useState('');
    const [customAreas, setCustomAreas] = useState<string[]>([]);
    const [newArea, setNewArea] = useState('');
    const [user, setUser] = useState(() => localStorage.getItem('conteo:user') || 'Scanner');
    const [flash, setFlash] = useState<'ok' | 'err' | null>(null);
    const [lastScan, setLastScan] = useState<any>(null);
    const [streak, setStreak] = useState(0);
    const [velocity, setVelocity] = useState(0);
    const [soundOn, setSoundOn] = useState(true);
    const [cameraOn, setCameraOn] = useState(false);
    const [scanTimes, setScanTimes] = useState<number[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanLoopRef = useRef<number | null>(null);

    useEffect(() => {
        const saved = JSON.parse(localStorage.getItem('conteo:customAreas') || '[]');
        setCustomAreas(saved);
        const lastArea = localStorage.getItem('conteo:lastArea') || '';
        if (lastArea && saved.includes(lastArea)) setArea(lastArea);
        else if (saved.length > 0) setArea(saved[0]);
    }, []);

    useEffect(() => {
        const now = Date.now();
        const recent = scanTimes.filter(t => now - t < 60000);
        setVelocity(recent.length);
    }, [scanTimes]);

    useEffect(() => { inputRef.current?.focus(); }, [area, folio]);

    const playBeep = useCallback((ok: boolean) => {
        if (!soundOn) return;
        try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = ok ? 880 : 330;
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.start(); osc.stop(ctx.currentTime + 0.2);
        } catch {}
    }, [soundOn]);

    const handleScan = useCallback(async (code: string) => {
        if (!folio || folio.state !== 'open') { addToast('No hay inventario activo', 'warning'); return; }
        if (!area.trim()) { addToast('Selecciona o registra un área primero', 'warning'); return; }
        const clean = code.trim();
        if (!clean) return;
        setBarcode('');

        let item = catalog.byBarcode[clean];
        if (!item) {
            const decoded = tryDecodeStructuredBarcode(clean, colors);
            if (decoded) item = { mod: decoded.mod, color: decoded.color, talla: decoded.talla, vkey: decoded.vkey, category: decoded.category };
        }

        if (!item) {
            setFlash('err'); setStreak(0); playBeep(false);
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            addToast(`Código no reconocido: ${clean}`, 'error');
            setLastScan({ code: clean, ok: false });
            setTimeout(() => setFlash(null), 800);
            return;
        }

        const scan: Scan = {
            id: crypto.randomUUID(), folioId: folio.id, code: clean,
            vkey: item.vkey, mod: item.mod, color: item.color, talla: item.talla,
            area, pos: '0', user, ts: Date.now(), category: item.category
        };

        await fbAddScan(scan);
        setFlash('ok'); setStreak(s => s + 1);
        setScanTimes(prev => [...prev.filter(t => Date.now() - t < 60000), Date.now()]);
        playBeep(true);
        if (navigator.vibrate) navigator.vibrate(30);
        setLastScan({ ...item, ok: true });
        setTimeout(() => { setFlash(null); inputRef.current?.focus(); }, 600);
    }, [folio, catalog, colors, area, user, addToast, playBeep]);

    const handleUndo = async () => {
        const myScans = scans.filter(s => s.area === area).sort((a, b) => b.ts - a.ts);
        if (!myScans[0] || !folio) { addToast('Nada que deshacer', 'info'); return; }
        const s = myScans[0];
        await fbDeleteScan(s.id, folio.id, s.vkey, s.area, s.pos);
        setStreak(s => Math.max(0, s - 1));
        addToast('Último escaneo deshecho', 'info');
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            if ('BarcodeDetector' in window) {
                const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128'] });
                const loop = async () => {
                    if (videoRef.current) {
                        const codes = await detector.detect(videoRef.current).catch(() => []);
                        if (codes.length > 0) await handleScan(codes[0].rawValue);
                    }
                    scanLoopRef.current = requestAnimationFrame(loop);
                };
                loop();
            }
            setCameraOn(true);
        } catch { addToast('No se pudo acceder a la cámara', 'error'); }
    };

    const stopCamera = () => {
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
        if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
        setCameraOn(false);
    };

    const addCustomArea = () => {
        const a = newArea.trim().toUpperCase();
        if (!a) return;
        const updated = [...customAreas, a];
        setCustomAreas(updated);
        localStorage.setItem('conteo:customAreas', JSON.stringify(updated));
        setArea(prev => prev === '' ? a : prev);
        if (!area) setArea(a);
        setNewArea('');
    };

    const coveragePct = folio ? (() => {
        const total = Object.values(folio.theoreticalMap || {}).reduce((a, b) => a + b, 0);
        const scanned = Object.values(folio.existenciasMap || {}).reduce((a, b) => a + b, 0);
        return total > 0 ? (scanned / total) * 100 : 0;
    })() : 0;

    if (!folio) return <div className="text-center py-12 text-slate-400"><QrCode className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>No hay inventario activo</p></div>;

    const allAreas = customAreas;

    return (
        <div className={`space-y-4 transition-colors duration-300 ${flash === 'ok' ? 'bg-emerald-50' : flash === 'err' ? 'bg-red-50' : ''} rounded-xl`}>
            <div className="grid grid-cols-4 gap-2">
                <div className="bg-white rounded-xl p-3 text-center shadow-sm border"><p className="text-xl font-bold text-slate-800">{scans.length}</p><p className="text-[10px] text-slate-400">Total</p></div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm border"><p className="text-xl font-bold text-sky-600">{scans.filter(s => s.area === area).length}</p><p className="text-[10px] text-slate-400">En área</p></div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm border"><p className="text-xl font-bold text-amber-500">{streak}</p><p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5"><Zap size={10} />Racha</p></div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm border"><p className="text-xl font-bold text-purple-600">{velocity}</p><p className="text-[10px] text-slate-400">/min</p></div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border flex items-center gap-4">
                <CoverageRing pct={coveragePct} />
                <div className="flex-1">
                    <p className="font-semibold text-slate-700 text-sm">{folio.name}</p>
                    <div className="flex gap-4 mt-1">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Teórico</p>
                            <p className="text-lg font-bold text-slate-700">{Object.values(folio.theoreticalMap || {}).reduce((a,b)=>a+b,0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Escaneado</p>
                            <p className="text-lg font-bold text-sky-600">{Object.values(folio.existenciasMap || {}).reduce((a,b)=>a+b,0).toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wide">Pendiente</p>
                            <p className="text-lg font-bold text-amber-500">{Math.max(0, Object.values(folio.theoreticalMap || {}).reduce((a,b)=>a+b,0) - Object.values(folio.existenciasMap || {}).reduce((a,b)=>a+b,0)).toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div>
                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Área actual</p>
                <div className="flex flex-wrap gap-2">
                    {allAreas.map(a => (
                        <button key={a} onClick={() => { setArea(a); localStorage.setItem('conteo:lastArea', a); }} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${area === a ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'}`}>{a}</button>
                    ))}
                    <div className="flex gap-1">
                        <input className="border rounded-full px-3 py-1.5 text-sm w-28" placeholder="Nueva área" value={newArea} onChange={e => setNewArea(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && addCustomArea()} />
                        <button onClick={addCustomArea} className="bg-slate-100 rounded-full px-2 border"><Plus size={14} /></button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
                <div className="flex gap-2">
                    <input ref={inputRef} type="text" inputMode="numeric" className="flex-1 border-2 border-sky-300 rounded-xl p-3 text-lg font-mono focus:outline-none focus:border-sky-500" placeholder="Escanear código..." value={barcode} onChange={e => setBarcode(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleScan(barcode); }} />
                    <button onClick={() => cameraOn ? stopCamera() : startCamera()} className={`px-4 rounded-xl border-2 ${cameraOn ? 'border-red-300 text-red-500' : 'border-slate-200 text-slate-500'}`}>
                        {cameraOn ? <CameraOff size={22} /> : <Camera size={22} />}
                    </button>
                </div>
                {cameraOn && <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl aspect-video object-cover bg-black" />}
                <div className="flex gap-2">
                    <button onClick={() => handleScan(barcode)} className="flex-1 bg-sky-500 text-white rounded-xl py-3 font-bold text-lg active:scale-95 transition-transform">ESCANEAR</button>
                    <button onClick={handleUndo} className="px-4 bg-slate-100 text-slate-600 rounded-xl border"><Undo2 size={18} /></button>
                    <button onClick={() => setSoundOn(s => !s)} className="px-4 bg-slate-100 text-slate-600 rounded-xl border">{soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
                </div>
            </div>

            {lastScan && (
                <div className={`rounded-xl p-4 border ${lastScan.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${lastScan.ok ? 'bg-emerald-500' : 'bg-red-500'}`}>
                            {lastScan.ok ? <Check className="text-white" size={20} /> : <X className="text-white" size={20} />}
                        </div>
                        <div>
                            <p className={`font-bold ${lastScan.ok ? 'text-emerald-800' : 'text-red-800'}`}>{lastScan.ok ? `${lastScan.mod} · ${lastScan.color}` : 'No reconocido'}</p>
                            <p className={`text-sm ${lastScan.ok ? 'text-emerald-600' : 'text-red-600 font-mono'}`}>{lastScan.ok ? `Talla ${formatTallaFromVkey(lastScan.talla, lastScan.vkey)}` : lastScan.code}</p>
                        </div>
                    </div>
                </div>
            )}

            <div>
                <label className="text-xs text-slate-500 font-semibold uppercase">Operador</label>
                <input className="w-full border rounded-lg p-2 text-sm mt-1" value={user} onChange={e => { setUser(e.target.value); localStorage.setItem('conteo:user', e.target.value); }} />
            </div>
        </div>
    );
};
