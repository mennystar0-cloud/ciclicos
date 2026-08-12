import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fbAddScan, fbAddSessionScan, fbCreateScanSession, fbDeleteScan, fbDeleteSession, fbSubscribeToSession, fbSubscribeToSessionItems, fbUpdateSessionLastSeen, fbUndoSessionItem } from './firebase.ts';
import { tryDecodeStructuredBarcode, formatDate } from './utils.ts';
import { decodeRopaBarcode, formatTallaFromVkey } from './ropaUtils.ts';
import { Camera, CameraOff, Check, Download, MapPin, PlayCircle, QrCode, RefreshCw, Users, VolumeX, Volume2, Zap, X, AlertTriangle } from './icons.tsx';
import type { Folio, Catalog, ColorMap, Scan, ToastType, ScanSession, SessionItem } from './types.ts';
import type { AppSession } from './session.ts';
export const ScannerSessionTab = ({ colors, catalog, folio, addToast, appSession, sucursalId }: {
    colors: ColorMap; catalog: Catalog;
    folio: Folio | null;
    addToast: (m: string, t?: ToastType) => void;
    appSession?: AppSession | null;
    sucursalId?: string;
}) => {
    const [phase, setPhase] = useState<'menu' | 'scanning'>('menu');
    const [currentSession, setCurrentSession] = useState<ScanSession | null>(null);
    const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
    const [newArea, setNewArea] = useState('');
    const [newOperator, setNewOperator] = useState(() => appSession?.nombre || localStorage.getItem('conteo:user') || '');
    const [conflictSession, setConflictSession] = useState<ScanSession | null>(null);
    const [showConflict, setShowConflict] = useState(false);
    const [modoRopa, setModoRopa] = useState(false);
    const modoRopaRef = useRef(false); // ref para acceso síncrono en handleScan
    const deviceId = React.useMemo(() => {
        let id = localStorage.getItem('conteo:deviceId');
        if (!id) { id = crypto.randomUUID(); localStorage.setItem('conteo:deviceId', id); }
        return id;
    }, []);
    const [barcode, setBarcode] = useState('');
    const [flash, setFlash] = useState<'ok' | 'err' | null>(null);
    const [lastScan, setLastScan] = useState<any>(null);
    const [streak, setStreak] = useState(0);
    const [soundOn, setSoundOn] = useState(true);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [cameraOn, setCameraOn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [savedSessions, setSavedSessions] = useState<ScanSession[]>([]);
    const { confirm: askConfirm, modal: confirmModal } = useConfirm();
    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanLoopRef = useRef<number | null>(null);

    // Load saved sessions for this device
    useEffect(() => {
        const savedId = localStorage.getItem('conteo:sessionId');
        if (savedId) {
            const unsub = fbSubscribeToSession(savedId, (s) => {
                if (s) setCurrentSession(s as ScanSession);
            }, sucursalId ?? undefined);
            const unsubItems = fbSubscribeToSessionItems(savedId, (items) => {
                setSessionItems(items as SessionItem[]);
            }, sucursalId ?? undefined);
            setPhase('scanning');
            return () => { unsub(); unsubItems(); };
        }
    }, [sucursalId]);

    // Advertencia al cerrar/recargar con sesión activa
    useEffect(() => {
        if (phase !== 'scanning' || !currentSession) return;
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [phase, currentSession]);

    // Heartbeat: actualiza lastSeen cada 30 segundos para presencia en tiempo real
    useEffect(() => {
        if (!currentSession) return;
        const updateLastSeen = () => fbUpdateSessionLastSeen(currentSession.id, sucursalId).catch(() => {});
        updateLastSeen();
        const interval = setInterval(updateLastSeen, 30000);
        return () => clearInterval(interval);
    }, [currentSession?.id, sucursalId]);

    const playBeep = useCallback((ok: boolean) => {
        if (!soundOn) return;
        try {
            if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
            const ctx = audioCtxRef.current;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = ok ? 880 : 330;
            osc.type = ok ? 'sine' : 'square';
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.start(); osc.stop(ctx.currentTime + 0.2);
        } catch {}
    }, [soundOn]);

    const doStartSession = async (area: string, operator: string, opId?: string): Promise<string> => {
        setLoading(true);
        const prevId = localStorage.getItem('conteo:sessionId');
        if (prevId) { await fbDeleteSession(prevId, sucursalId).catch(() => {}); }
        const id = 'SS-' + Date.now().toString(36).toUpperCase();
        const session: ScanSession = {
            id, area: area.toUpperCase(), operator,
            operadorId: opId ?? appSession?.operadorId,
            deviceId,
            sucursalId: sucursalId ?? appSession?.sucursalId,
            createdAt: Date.now(), count: 0,
            lastSeen: Date.now(),
        };
        await fbCreateScanSession(session);
        localStorage.setItem('conteo:sessionId', id);
        localStorage.setItem('conteo:user', operator);
        setCurrentSession(session);
        setSessionItems([]);
        setStreak(0);
        setLoading(false);
        setPhase('scanning');
        addToast('Sesion iniciada en ' + session.area, 'success');
        return id;
    };

    const startNewSession = async () => {
        if (!newArea.trim()) { addToast('Escribe el area a escanear', 'warning'); return; }
        const operatorName = appSession?.nombre || newOperator.trim() || 'Scanner';
        try {
            const newId = await doStartSession(newArea.trim(), operatorName, appSession?.operadorId);
            fbSubscribeToSession(newId, (s) => { if (s) setCurrentSession(s as ScanSession); }, sucursalId ?? undefined);
            fbSubscribeToSessionItems(newId, (items) => setSessionItems(items as SessionItem[]), sucursalId ?? undefined);
            setTimeout(() => inputRef.current?.focus(), 300);
        } catch (err) {
            setLoading(false);
            addToast('Error al iniciar sesion. Intenta de nuevo.', 'error');
            console.error('startNewSession error:', err);
        }
    };

    const handleScan = useCallback(async (code: string) => {
        if (!currentSession) return;
        const clean = code.trim();
        if (!clean) return;
        setBarcode('');

        let recognized = false;
        let mod = '', color = '', talla = '', vkey = '';

        // Try catalog
        let item = catalog.byBarcode[clean];
        if (!item) {
            const decoded = modoRopaRef.current
                ? decodeRopaBarcode(clean, colors)
                : tryDecodeStructuredBarcode(clean, colors);
            if (decoded) item = { mod: decoded.mod, color: decoded.color, talla: decoded.talla, vkey: decoded.vkey, category: decoded.category };
        }
        if (item) { recognized = true; mod = item.mod; color = item.color; talla = item.talla; vkey = item.vkey; }

        const scanItem: SessionItem = {
            id: crypto.randomUUID(),
            sessionId: currentSession.id,
            code: clean, ts: Date.now(),
            recognized, mod, color, talla, vkey
        };

        await fbAddSessionScan(currentSession.id, scanItem, sucursalId ?? undefined);

        // Actualizar existenciasMap del folio activo para que el Reporte cuadre
        if (recognized && folio && folio.state === 'open') {
            const scan: Scan = {
                id: scanItem.id,
                folioId: folio.id,
                code: clean,
                vkey: scanItem.vkey,
                mod: scanItem.mod,
                color: scanItem.color,
                talla: scanItem.talla,
                area: currentSession.area,
                pos: '0',
                user: currentSession.operator,
                ts: scanItem.ts,
                category: item?.category,
                sucursalId: sucursalId ?? undefined,
            };
            await fbAddScan(scan);
        }

        setFlash(recognized ? 'ok' : 'err');
        if (recognized) {
            setStreak(s => s + 1);
            playBeep(true);
            if (navigator.vibrate) navigator.vibrate(30);
        } else {
            setStreak(0);
            playBeep(false);
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
        }
        setLastScan({ ...scanItem });
        setTimeout(() => { setFlash(null); inputRef.current?.focus(); }, 600);
    }, [currentSession, catalog, colors, playBeep]);

    const handleUndo = async () => {
        if (!currentSession || sessionItems.length === 0) { addToast('Nada que deshacer', 'info'); return; }
        const last = sessionItems[0];
        try {
            await fbUndoSessionItem(currentSession.id, last.id, sucursalId);
            if (last.recognized && last.vkey && folio) {
                await fbDeleteScan(last.id, folio.id, last.vkey);
            }
            setStreak(s => Math.max(0, s - 1));
            addToast('Último escaneo deshecho', 'info');
        } catch { addToast('Error al deshacer', 'error'); }
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) videoRef.current.srcObject = stream;
            if ('BarcodeDetector' in window) {
                const detector = new (window as any).BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a'] });
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
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        if (scanLoopRef.current) cancelAnimationFrame(scanLoopRef.current);
        setCameraOn(false);
    };

    const exportCSV = () => {
        const header = 'Código,Modelo,Color,Talla,Reconocido,Fecha\n';
        const rows = sessionItems.map(s =>
            `${s.code},${s.mod || ''},${s.color || ''},${s.talla || ''},${s.recognized ? 'Sí' : 'No'},${formatDate(s.ts)}`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `escaneo-${currentSession?.area}-${currentSession?.operator}-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        addToast('CSV exportado', 'success');
    };

    const confirmNewSession = async () => {
        const ok = await askConfirm(
            'Los escaneos actuales quedarán guardados en el historial.',
            '¿Iniciar nuevo escaneo?',
            'Nuevo escaneo'
        );
        if (!ok) return;
        localStorage.removeItem('conteo:sessionId');
        setCurrentSession(null);
        setSessionItems([]);
        setPhase('menu');
        setNewArea('');
        setStreak(0);
        stopCamera();
    };

    // ── MENU PHASE ──
    if (phase === 'menu') return (
        <div className="space-y-6">
            {/* Sin inventario abierto */}
            {!folio || folio.state !== 'open' ? (
                <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 space-y-6">
                    {/* Ícono animado */}
                    <div className="relative">
                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-200 dark:shadow-sky-900">
                            <QrCode size={52} className="text-white opacity-90" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center shadow">
                            <span className="text-lg">⏳</span>
                        </div>
                    </div>

                    {/* Saludo personalizado */}
                    <div className="space-y-1">
                        <p className="text-slate-400 dark:text-slate-500 text-sm font-medium uppercase tracking-wider">Bienvenido</p>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white">
                            {appSession?.nombre ? `¡Hola, ${appSession.nombre.split(' ')[0]}!` : '¡Hola!'}
                        </h2>
                        {appSession?.sucursalNombre && (
                            <p className="text-slate-500 dark:text-slate-400 text-sm">{appSession.sucursalNombre}</p>
                        )}
                    </div>

                    {/* Estado */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5 max-w-xs w-full space-y-2">
                        <p className="font-bold text-amber-800 dark:text-amber-300 text-base">Esperando inventario</p>
                        <p className="text-amber-700 dark:text-amber-400 text-sm leading-relaxed">
                            El administrador aún no ha abierto un inventario. En cuanto lo haga, esta pantalla se actualizará automáticamente.
                        </p>
                    </div>

                    {/* Indicador de auto-verificación */}
                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-xs">
                        <div className="w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse" />
                        Verificando cada 30 segundos...
                    </div>
                </div>
            ) : (
            <>
            <div className="bg-gradient-to-br from-sky-500 to-sky-700 rounded-2xl p-6 text-white text-center">
                <QrCode size={40} className="mx-auto mb-2 opacity-90" />
                <h2 className="text-xl font-bold">Nuevo Escaneo</h2>
                <p className="text-sky-200 text-sm mt-1">{folio.name}</p>
            </div>

            <div className="bg-white rounded-xl border p-5 shadow-sm space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                        <MapPin size={12} /> Área a escanear *
                    </label>
                    <input
                        className="w-full border-2 border-sky-200 rounded-xl p-3 text-base focus:outline-none focus:border-sky-400 font-medium"
                        placeholder="Ej: ÁREA-A, BODEGA, PISO 2..."
                        value={newArea}
                        onChange={e => setNewArea(e.target.value.toUpperCase())}
                    />
                    <div className="flex flex-wrap gap-1 mt-2">
                        {['ÁREA-A','ÁREA-B','ÁREA-C','BODEGA','PISO 1','PISO 2'].map(a => (
                            <button key={a} onClick={() => setNewArea(a)} className="text-xs bg-sky-50 text-sky-600 border border-sky-200 px-2 py-1 rounded-full">{a}</button>
                        ))}
                    </div>
                </div>
                {/* Operador tomado del login — no se muestra campo */}
                {appSession?.nombre && (
                    <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-4 py-3">
                        <Users size={14} className="text-sky-500" />
                        <span className="text-sm font-semibold text-sky-700">{appSession.nombre}</span>
                    </div>
                )}
                <button
                    onClick={startNewSession}
                    disabled={loading}
                    className="w-full bg-sky-500 text-white rounded-xl py-4 font-bold text-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <PlayCircle size={22} /> {loading ? 'Iniciando...' : 'Iniciar Escaneo'}
                </button>
            </div>
            </>
            )}
        </div>
    );

    // ── SCANNING PHASE ──
    // Modal conflicto de sesion
    const ConflictModal = () => (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
                <div className="text-center">
                    <div className="text-4xl mb-2">⚠️</div>
                    <h3 className="font-black text-slate-800 dark:text-white text-lg">Sesion activa detectada</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                        <strong>{conflictSession?.operator}</strong> ya tiene una sesion activa en otro dispositivo
                        en el area <strong>{conflictSession?.area}</strong> con <strong>{conflictSession?.count ?? 0}</strong> escaneos.
                    </p>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-300">
                    Si continuas aqui, el otro dispositivo perdera la sesion activa. Los escaneos realizados quedaran guardados en el historial.
                </div>
                <div className="space-y-2">
                    <button
                        onClick={async () => {
                            setShowConflict(false);
                            const cId = await doStartSession(
                                newArea.trim() || conflictSession?.area || '',
                                appSession?.nombre || newOperator.trim(),
                                appSession?.operadorId
                            );
                            fbSubscribeToSession(cId, (s) => { if (s) setCurrentSession(s as ScanSession); }, sucursalId ?? undefined);
                            fbSubscribeToSessionItems(cId, (items) => setSessionItems(items as SessionItem[]), sucursalId ?? undefined);
                            setTimeout(() => inputRef.current?.focus(), 300);
                        }}
                        className="w-full bg-sky-500 hover:bg-sky-400 text-white py-3 rounded-xl font-bold active:scale-95"
                    >
                        Continuar en este dispositivo
                    </button>
                    <button
                        onClick={() => { setShowConflict(false); setConflictSession(null); }}
                        className="w-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white py-3 rounded-xl font-medium active:scale-95"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className={`space-y-4 ${flash === 'ok' ? 'bg-emerald-50 dark:bg-emerald-950/20' : flash === 'err' ? 'bg-red-50 dark:bg-red-950/20' : ''} rounded-xl transition-colors duration-300`}>
            {/* Session header — contador grande */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 shadow-sm overflow-hidden">
                {/* Fila superior: área + botones */}
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse flex-shrink-0" />
                        <span className="font-bold text-slate-800 dark:text-white truncate">{currentSession?.area}</span>
                        {modoRopa && <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-full font-bold flex-shrink-0">👕 ROPA</span>}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                        <button
                            onClick={() => setModoRopa(m => { modoRopaRef.current = !m; return !m; })}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all ${modoRopa ? 'bg-purple-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 border dark:border-slate-600'}`}
                            title={modoRopa ? 'Modo Ropa ACTIVO' : 'Activar Modo Ropa'}
                        >👕</button>
                        <button onClick={exportCSV} className="text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 rounded-lg font-semibold">
                            <Download size={13} />
                        </button>
                        <button onClick={confirmNewSession} className="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 rounded-lg font-semibold">
                            <RefreshCw size={13} />
                        </button>
                    </div>
                </div>

                {/* Contador principal */}
                <div className="px-4 pb-4 flex items-end justify-between">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">{currentSession?.operator}</p>
                        <div className="flex items-baseline gap-3">
                            <span key={sessionItems.length} className="text-6xl font-black text-slate-800 dark:text-white tabular-nums" style={{ animation: 'countPop 0.2s ease-out' }}>
                                {sessionItems.length}
                            </span>
                            <div className="space-y-0.5 pb-1">
                                <p className="text-xs text-slate-400">escaneos</p>
                                <p className="text-xs text-emerald-600 font-semibold">{sessionItems.filter(s => s.recognized).length} reconocidos</p>
                                {sessionItems.filter(s => !s.recognized).length > 0 && (
                                    <p className="text-xs text-red-500 font-semibold">{sessionItems.filter(s => !s.recognized).length} no reconocidos</p>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Racha */}
                    {streak > 0 && (
                        <div className="flex flex-col items-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
                            <Zap size={16} className="text-amber-500" />
                            <span className="text-xl font-black text-amber-600">{streak}</span>
                            <span className="text-[9px] text-amber-500 font-bold uppercase">racha</span>
                        </div>
                    )}
                </div>
            </div>

            {showConflict && <ConflictModal />}
            {confirmModal}
            {/* Input */}
            <div className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
                <div className="flex gap-2">
                    <input
                        ref={inputRef}
                        type="text"
                        inputMode="numeric"
                        className="flex-1 border-2 border-sky-300 rounded-xl p-3 text-lg font-mono focus:outline-none focus:border-sky-500"
                        placeholder="Escanear código..."
                        value={barcode}
                        onChange={e => setBarcode(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleScan(barcode); }}
                        autoFocus
                    />
                    <button onClick={() => cameraOn ? stopCamera() : startCamera()} className={`px-4 rounded-xl border-2 ${cameraOn ? 'border-red-300 text-red-500' : 'border-slate-200 text-slate-500'}`}>
                        {cameraOn ? <CameraOff size={22} /> : <Camera size={22} />}
                    </button>
                </div>
                {cameraOn && <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-xl aspect-video object-cover bg-black" />}
                <div className="flex gap-2">
                    <button onClick={() => handleScan(barcode)} className="flex-1 bg-sky-500 hover:bg-sky-600 text-white rounded-xl py-3 font-bold text-lg active:scale-95 transition-transform">
                        ESCANEAR
                    </button>
                    <button onClick={handleUndo} className="px-4 bg-slate-100 text-slate-600 rounded-xl border"><Undo2 size={18} /></button>
                    <button onClick={() => setSoundOn(s => !s)} className="px-4 bg-slate-100 text-slate-600 rounded-xl border">
                        {soundOn ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </button>
                </div>
            </div>

            {/* Last scan */}
            {lastScan && (
                <div className={`rounded-xl p-4 border ${lastScan.recognized ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    {lastScan.recognized ? (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="text-white" size={20} /></div>
                            <div>
                                <p className="font-bold text-emerald-800">{lastScan.mod}</p>
                                <p className="text-sm text-emerald-600">{lastScan.color} · Talla {formatTallaFromVkey(lastScan.talla, lastScan.vkey)}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center"><X className="text-white" size={20} /></div>
                            <div>
                                <p className="font-bold text-red-800">No reconocido — guardado</p>
                                <p className="text-sm text-red-600 font-mono">{lastScan.code}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Recent scans list — últimos 5 con conteo por SKU */}
            {sessionItems.length > 0 && (() => {
                const vkeyCounts: Record<string, number> = {};
                for (const s of sessionItems) { vkeyCounts[s.vkey || s.code] = (vkeyCounts[s.vkey || s.code] || 0) + 1; }
                const last5 = [...sessionItems].reverse().slice(0, 5);
                return (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Últimos escaneos</p>
                            <p className="text-xs text-slate-400">{sessionItems.length} total en sesión</p>
                        </div>
                        {last5.map((s, i) => {
                            const key = s.vkey || s.code;
                            const count = vkeyCounts[key] || 1;
                            const isRecent = i === 0;
                            const isHighCount = count >= 4;
                            return (
                                <div key={s.id} className={`rounded-xl border px-4 py-3 flex justify-between items-center shadow-sm transition-all
                                    ${!s.recognized ? 'bg-red-50 border-red-200' :
                                      isHighCount ? 'bg-amber-50 border-amber-200' :
                                      isRecent ? 'bg-emerald-50 border-emerald-200' :
                                      'bg-white border-slate-100'}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-black
                                            ${!s.recognized ? 'bg-red-400' : isHighCount ? 'bg-amber-400' : 'bg-emerald-400'}`}>
                                            {i + 1}
                                        </div>
                                        <div className="min-w-0">
                                            {s.recognized ? (
                                                <p className="text-sm font-bold text-slate-800 truncate">{s.mod} · {s.color} · {formatTallaFromVkey(s.talla, s.vkey)}</p>
                                            ) : (
                                                <p className="text-sm font-mono font-bold text-red-600 truncate">{s.code}</p>
                                            )}
                                            <p className="text-[10px] text-slate-400">{formatDate(s.ts)}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end flex-shrink-0 ml-2">
                                        <span className={`text-xs font-black px-2 py-0.5 rounded-full
                                            ${isHighCount ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                            ×{count}
                                        </span>
                                        {isHighCount && <span className="text-[9px] text-amber-500 font-bold mt-0.5">repetido</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                );
            })()}
        </div>
    );
};

