import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    fbCreateFolio, fbGetAllFolios, fbGetLastOpenFolio, fbSubscribeToFolio,
    fbUpdateFolio, fbDeleteFolio, fbAddScan, fbDeleteScan, fbGetScans,
    fbSubscribeToScans, fbSaveSettings, fbLoadSettings, fbGetFullDump,
    fbRestoreFullDump, fbCreateScanSession, fbAddSessionScan,
    fbSubscribeToSession, fbSubscribeToSessionItems, fbSubscribeToAllSessions,
    fbDeleteSession, fbGetSessionItems
} from './firebase.ts';
import type { Role, Tab, Folio, Catalog, ColorMap, Scan, StockMap } from './types.ts';
import {
    tryDecodeStructuredBarcode, formatDate, keyOf, splitKey, getSizeCode,
    canonical, cleanModel, detectCategoryBySize, generateBarcode
} from './utils.ts';

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 20, className = '', strokeWidth = 2 }: { d: string | string[]; size?: number; className?: string; strokeWidth?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
        {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
);
const QrCode = (p: any) => <Icon {...p} d={['M3 3h6v6H3z','M15 3h6v6h-6z','M3 15h6v6H3z','M15 15h2v2h-2z','M19 15v2','M17 19h4','M19 19v2']} />;
const FileText = (p: any) => <Icon {...p} d={['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6','M16 13H8','M16 17H8','M10 9H8']} />;
const BarChart3 = (p: any) => <Icon {...p} d="M3 3v18h18M18 9l-5 5-4-4-3 3" />;
const LogOut = (p: any) => <Icon {...p} d={['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4','M16 17l5-5-5-5','M21 12H9']} />;
const Search = (p: any) => <Icon {...p} d={['M21 21l-4.35-4.35','M11 19A8 8 0 1 0 11 3a8 8 0 0 0 0 16z']} />;
const History = (p: any) => <Icon {...p} d={['M3 3v5h5','M3.05 13A9 9 0 1 0 6 5.3L3 8']} />;
const Database = (p: any) => <Icon {...p} d={['M12 2C6.48 2 2 3.79 2 6v12c0 2.21 4.48 4 10 4s10-1.79 10-4V6c0-2.21-4.48-4-10-4z','M2 6c0 2.21 4.48 4 10 4s10-1.79 10-4','M2 12c0 2.21 4.48 4 10 4s10-1.79 10-4']} />;
const Palette = (p: any) => <Icon {...p} d="M12 2a10 10 0 1 0 0 20c1.7 0 3-.4 4-1a2 2 0 0 0 0-3.5C15.5 17 15 16.3 15 15.5a2.5 2.5 0 0 1 2.5-2.5H20a2 2 0 0 0 2-2 10 10 0 0 0-10-9z" />;
const Boxes = (p: any) => <Icon {...p} d={['M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42z','M7 16.5l-4.74-2.85','M7 16.5l5-3','M7 16.5V21','M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3z','M17 16.5l-5-3','M17 16.5l4.74-2.85','M17 16.5V21','M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8z','M12 8l-4.74 2.85','M12 8l4.74 2.85','M12 13.5V8']} />;
const Plus = (p: any) => <Icon {...p} d="M12 5v14M5 12h14" />;
const Trash2 = (p: any) => <Icon {...p} d={['M3 6h18','M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6','M10 11v6','M14 11v6','M9 6V4h6v2']} />;
const Download = (p: any) => <Icon {...p} d={['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M7 10l5 5 5-5','M12 15V3']} />;
const Upload = (p: any) => <Icon {...p} d={['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M17 8l-5-5-5 5','M12 3v12']} />;
const Edit2 = (p: any) => <Icon {...p} d={['M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z']} />;
const Check = (p: any) => <Icon {...p} d="M20 6L9 17l-5-5" />;
const Camera = (p: any) => <Icon {...p} d={['M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z','M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z']} />;
const CameraOff = (p: any) => <Icon {...p} d={['M1 1l22 22','M21 21H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3m3-3h6l2 3h4a2 2 0 0 1 2 2v9.34','M8 8a4 4 0 0 0 5.66 5.66']} />;
const Undo2 = (p: any) => <Icon {...p} d={['M9 14 4 9l5-5','M4 9h10.5a5.5 5.5 0 0 1 0 11H11']} />;
const X = (p: any) => <Icon {...p} d="M18 6L6 18M6 6l12 12" />;
const MapPin = (p: any) => <Icon {...p} d={['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z','M12 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z']} />;
const Package = (p: any) => <Icon {...p} d={['M16.5 9.4l-9-5.19M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z','M3.27 6.96L12 12.01l8.73-5.05','M12 22.08V12']} />;
const ChevronDown = (p: any) => <Icon {...p} d="M6 9l6 6 6-6" />;
const ChevronUp = (p: any) => <Icon {...p} d="M18 15l-6-6-6 6" />;
const BookOpen = (p: any) => <Icon {...p} d={['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z','M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z']} />;
const Zap = (p: any) => <Icon {...p} d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />;
const Timer = (p: any) => <Icon {...p} d={['M12 22a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M12 6v6l4 2','M9.5 2h5','M12 2v3']} />;
const Eye = (p: any) => <Icon {...p} d={['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z','M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z']} />;
const MessageSquare = (p: any) => <Icon {...p} d={['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z']} />;
const Volume2 = (p: any) => <Icon {...p} d={['M11 5L6 9H2v6h4l5 4V5z','M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07']} />;
const VolumeX = (p: any) => <Icon {...p} d={['M11 5L6 9H2v6h4l5 4V5z','M23 9l-6 6','M17 9l6 6']} />;
const AlertTriangle = (p: any) => <Icon {...p} d={['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z','M12 9v4','M12 17h.01']} />;
const ShieldCheck = (p: any) => <Icon {...p} d={['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z','M9 12l2 2 4-4']} />;
const ClipboardList = (p: any) => <Icon {...p} d={['M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2','M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2','M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2','M9 12h6','M9 16h4']} />;
const Lock = (p: any) => <Icon {...p} d={['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z','M17 11V7a5 5 0 0 0-10 0v4']} />;
const Unlock = (p: any) => <Icon {...p} d={['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z','M17 11V7a5 5 0 0 0-9.9-1']} />;
const Sparkles = (p: any) => <Icon {...p} d={['M12 3l1.88 5.76 5.62.82-4.08 3.95.97 5.6L12 16.5l-5.39 2.63.97-5.6L3.5 9.58l5.62-.82z']} />;
const Users = (p: any) => <Icon {...p} d={['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M23 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75']} />;
const PlayCircle = (p: any) => <Icon {...p} d={['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z','M10 8l6 4-6 4V8z']} />;
const RefreshCw = (p: any) => <Icon {...p} d={['M23 4v6h-6','M1 20v-6h6','M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15']} />;
const Wifi = (p: any) => <Icon {...p} d={['M5 12.55a11 11 0 0 1 14.08 0','M1.42 9a16 16 0 0 1 21.16 0','M8.53 16.11a6 6 0 0 1 6.95 0','M12 20h.01']} />;
const ArrowRight = (p: any) => <Icon {...p} d={['M5 12h14','M12 5l7 7-7 7']} />;

// ─── TYPES ───────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: string; msg: string; type: ToastType; }
interface ScanSession {
    id: string;
    area: string;
    operator: string;
    createdAt: any;
    count: number;
}
interface SessionItem {
    id: string;
    sessionId: string;
    code: string;
    ts: number;
    mod?: string;
    color?: string;
    talla?: string;
    vkey?: string;
    recognized: boolean;
}

// ─── DEFAULT COLORS ──────────────────────────────────────────────────────────
const DEFAULT_COLORS: ColorMap = {
    'IVORY': '980', 'ORO': '090', 'MIEL': '071', 'MULTICOLOR': '861', 'NEGRO': '078',
    'CAMEL': '060', 'VINO': '105', 'AZUL': '349', 'ROJO': '095', 'MOSTAZA': '075',
    'HUESO': '166', 'MAGENTA': '352', 'BLANCO': '033', 'FIUSHA': '063', 'VERDE': '101',
    'CHOCOLATE': '329', 'MEZCLILLA': '371', 'CAFE': '006', 'AMARILLO': '319',
    'VERDE MILITAR': '103', 'OLIVO': '568', 'PLATA': '093', 'MARINO': '210',
    'MAQUILLAJE': '297', 'AZUL MARINO': '149', 'ROSA': '359', 'ORO ROSADO': '757',
    'TINTO': '327', 'GRIS': '067', 'AZUL REY': '012', 'CORAL': '397', 'MENTA': '663',
    'NUDE': '726', 'OCRE': '787', 'LILA': '172', 'ARENA': '009', 'BEIGE': '031',
    'TRANSPARENTE': '644', 'METALICO': '965', 'SALMON': '890', 'SHEDRON': '207',
    'DURAZNO': '620', 'LADRILLO': '116', 'TABACO': '134', 'ESTAMPADO': '204',
    'AQUA': '350', 'NARANJA': '076', 'TOPO': '368', 'TAUPE': '995', 'VERDE JADE': '211',
    'BUGAMBILIA': '875', 'LIMA': '815', 'VERDE ESMERALDA': '313', 'TEAL': '916',
    'MANGO': '129', 'ANIMAL PRINT': '576', 'LIMON': '661', 'VERDE NEON': '781',
    'NARANJA NEON': '677', 'VERDE BOSQUE': '483', 'CANELA': '324', 'VERDE OLIVO': '700',
    'FRESA': '001', 'FUCSIA': '493', 'PERLA': '092', 'VIOLETA': '454', 'BRONCE': '045',
    'MAUVE': '545', 'MORADO': '072', 'TURQUESA': '316', 'DORADO': '133',
    'LAVANDA': '335', 'CIRUELA': '411', 'MANDARINA': '343', 'TERRACOTA': '445',
    'AMBAR': '919', 'GUINDA': '323', 'MARSALA': '391', 'COBRE': '263',
};

// ─── TOAST SYSTEM ────────────────────────────────────────────────────────────
const ToastContainer = ({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: string) => void }) => (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
        {toasts.map(t => (
            <div key={t.id} className={`flex items-start gap-2 p-3 rounded-xl shadow-lg text-white text-sm pointer-events-auto ${
                t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-red-500' :
                t.type === 'warning' ? 'bg-amber-500' : 'bg-sky-500'}`}>
                <span className="flex-1">{t.msg}</span>
                <button onClick={() => onRemove(t.id)}><X size={14} /></button>
            </div>
        ))}
    </div>
);

// ─── CONFETTI ─────────────────────────────────────────────────────────────────
const Confetti = ({ active }: { active: boolean }) => {
    if (!active) return null;
    return <>{Array.from({ length: 50 }, (_, i) => (
        <div key={i} className="fixed pointer-events-none z-[200] w-3 h-3 rounded-sm" style={{
            left: `${Math.random() * 100}vw`, top: '-20px',
            background: ['#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#ec4899'][i % 6],
            animation: `confetti ${0.8 + Math.random() * 1.2}s ${Math.random() * 0.5}s linear forwards`,
            transform: `rotate(${Math.random() * 360}deg)`
        }} />
    ))}</>;
};

// ─── STEPPER ─────────────────────────────────────────────────────────────────
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

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<{ children: React.ReactNode; tab: string }, { error: Error | null }> {
    state = { error: null };
    static getDerivedStateFromError(e: Error) { return { error: e }; }
    render() {
        if (this.state.error) return (
            <div className="p-6 bg-red-50 rounded-xl border border-red-200 text-center">
                <AlertTriangle className="w-10 h-10 mx-auto text-red-400 mb-2" />
                <p className="font-bold text-red-700">Error en {this.props.tab}</p>
                <p className="text-sm text-red-500 mt-1">{(this.state.error as Error).message}</p>
                <button onClick={() => this.setState({ error: null })} className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg text-sm">Reintentar</button>
            </div>
        );
        return this.props.children;
    }
}

// ─── COVERAGE RING ────────────────────────────────────────────────────────────
const CoverageRing = ({ pct, size = 80 }: { pct: number; size?: number }) => {
    const r = (size / 2) - 8;
    const circ = 2 * Math.PI * r;
    const dash = (Math.min(pct, 100) / 100) * circ;
    const color = pct >= 100 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444';
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6"
                strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                transform={`rotate(-90 ${size/2} ${size/2})`} />
            <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle" fill={color} fontSize="13" fontWeight="bold">
                {Math.round(pct)}%
            </text>
        </svg>
    );
};

// ─── SCANNER SESSION TAB ──────────────────────────────────────────────────────
const ScannerSessionTab = ({ colors, catalog, addToast }: {
    colors: ColorMap; catalog: Catalog;
    addToast: (m: string, t?: ToastType) => void;
}) => {
    const [phase, setPhase] = useState<'menu' | 'scanning'>('menu');
    const [currentSession, setCurrentSession] = useState<ScanSession | null>(null);
    const [sessionItems, setSessionItems] = useState<SessionItem[]>([]);
    const [newArea, setNewArea] = useState('');
    const [newOperator, setNewOperator] = useState(() => localStorage.getItem('conteo:user') || '');
    const [barcode, setBarcode] = useState('');
    const [flash, setFlash] = useState<'ok' | 'err' | null>(null);
    const [lastScan, setLastScan] = useState<any>(null);
    const [streak, setStreak] = useState(0);
    const [soundOn, setSoundOn] = useState(true);
    const [cameraOn, setCameraOn] = useState(false);
    const [loading, setLoading] = useState(false);
    const [savedSessions, setSavedSessions] = useState<ScanSession[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanLoopRef = useRef<number | null>(null);

    // Load saved sessions for this device
    useEffect(() => {
        const savedId = localStorage.getItem('conteo:sessionId');
        if (savedId) {
            // subscribe to existing session
            const unsub = fbSubscribeToSession(savedId, (s) => {
                if (s) setCurrentSession(s as ScanSession);
            });
            const unsubItems = fbSubscribeToSessionItems(savedId, (items) => {
                setSessionItems(items as SessionItem[]);
            });
            setPhase('scanning');
            return () => { unsub(); unsubItems(); };
        }
    }, []);

    const playBeep = useCallback((ok: boolean) => {
        if (!soundOn) return;
        try {
            const ctx = new AudioContext();
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

    const startNewSession = async () => {
        if (!newArea.trim()) { addToast('Escribe el área a escanear', 'warning'); return; }
        if (!newOperator.trim()) { addToast('Escribe tu nombre', 'warning'); return; }
        setLoading(true);
        // Delete previous session if exists
        const prevId = localStorage.getItem('conteo:sessionId');
        if (prevId) {
            await fbDeleteSession(prevId).catch(() => {});
        }
        const id = 'SS-' + Date.now().toString(36).toUpperCase();
        const session: ScanSession = {
            id, area: newArea.trim().toUpperCase(),
            operator: newOperator.trim(),
            createdAt: Date.now(), count: 0
        };
        await fbCreateScanSession(session);
        localStorage.setItem('conteo:sessionId', id);
        localStorage.setItem('conteo:user', newOperator.trim());
        setCurrentSession(session);
        setSessionItems([]);
        setStreak(0);
        setLoading(false);
        setPhase('scanning');
        addToast(`Sesión iniciada en ${session.area}`, 'success');

        // subscribe
        fbSubscribeToSession(id, (s) => { if (s) setCurrentSession(s as ScanSession); });
        fbSubscribeToSessionItems(id, (items) => setSessionItems(items as SessionItem[]));

        setTimeout(() => inputRef.current?.focus(), 300);
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
            const decoded = tryDecodeStructuredBarcode(clean, colors);
            if (decoded) item = { mod: decoded.mod, color: decoded.color, talla: decoded.talla, vkey: decoded.vkey, category: decoded.category };
        }
        if (item) { recognized = true; mod = item.mod; color = item.color; talla = item.talla; vkey = item.vkey; }

        const scanItem: SessionItem = {
            id: crypto.randomUUID(),
            sessionId: currentSession.id,
            code: clean, ts: Date.now(),
            recognized, mod, color, talla, vkey
        };

        await fbAddSessionScan(currentSession.id, scanItem);
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
        // delete last item from subcollection
        const last = sessionItems[0];
        try {
            const { getFirestore, doc, deleteDoc } = await import('firebase/firestore');
            const { db } = await import('./firebase.ts');
            await deleteDoc(doc(db, 'scanSessions', currentSession.id, 'items', last.id));
            // update count
            const { setDoc, getDoc } = await import('firebase/firestore');
            const ref = doc(db, 'scanSessions', currentSession.id);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                await setDoc(ref, { ...snap.data(), count: Math.max(0, (snap.data().count || 1) - 1) });
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

    const confirmNewSession = () => {
        if (!confirm('¿Iniciar nuevo escaneo? Se borrarán los escaneos actuales.')) return;
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
            <div className="bg-gradient-to-br from-sky-500 to-sky-700 rounded-2xl p-6 text-white text-center">
                <QrCode size={40} className="mx-auto mb-2 opacity-90" />
                <h2 className="text-xl font-bold">Nuevo Escaneo</h2>
                <p className="text-sky-200 text-sm mt-1">Escaneo independiente — se sincroniza en tiempo real con el Admin</p>
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
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
                        <Users size={12} /> Operador *
                    </label>
                    <input
                        className="w-full border-2 border-sky-200 rounded-xl p-3 text-base focus:outline-none focus:border-sky-400"
                        placeholder="Tu nombre"
                        value={newOperator}
                        onChange={e => setNewOperator(e.target.value)}
                    />
                </div>
                <button
                    onClick={startNewSession}
                    disabled={loading}
                    className="w-full bg-sky-500 text-white rounded-xl py-4 font-bold text-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                >
                    <PlayCircle size={22} /> {loading ? 'Iniciando...' : 'Iniciar Escaneo'}
                </button>
            </div>
        </div>
    );

    // ── SCANNING PHASE ──
    return (
        <div className={`space-y-4 ${flash === 'ok' ? 'bg-emerald-50' : flash === 'err' ? 'bg-red-50' : ''} rounded-xl transition-colors duration-300`}>
            {/* Session header */}
            <div className="bg-white rounded-xl border p-4 shadow-sm flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="font-bold text-slate-800">{currentSession?.area}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{currentSession?.operator} · <span className="font-bold text-sky-600">{sessionItems.length}</span> escaneos</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={exportCSV} className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold">
                        <Download size={14} /> CSV
                    </button>
                    <button onClick={confirmNewSession} className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-lg font-semibold">
                        <RefreshCw size={14} /> Nuevo
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-xl p-3 text-center shadow-sm border">
                    <p className="text-2xl font-bold text-slate-800">{sessionItems.length}</p>
                    <p className="text-[10px] text-slate-400">Total</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm border">
                    <p className="text-2xl font-bold text-emerald-600">{sessionItems.filter(s => s.recognized).length}</p>
                    <p className="text-[10px] text-slate-400">Reconocidos</p>
                </div>
                <div className="bg-white rounded-xl p-3 text-center shadow-sm border">
                    <p className="text-2xl font-bold text-amber-500">{streak}</p>
                    <p className="text-[10px] text-slate-400 flex items-center justify-center gap-0.5"><Zap size={10} />Racha</p>
                </div>
            </div>

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
                                <p className="text-sm text-emerald-600">{lastScan.color} · Talla {lastScan.talla}</p>
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

            {/* Recent scans list */}
            {sessionItems.length > 0 && (
                <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Últimos escaneos</p>
                    {sessionItems.slice(0, 15).map(s => (
                        <div key={s.id} className={`bg-white rounded-xl border px-4 py-2.5 flex justify-between items-center shadow-sm ${!s.recognized ? 'border-red-100 bg-red-50' : ''}`}>
                            <div>
                                {s.recognized ? (
                                    <p className="text-sm font-semibold text-slate-700">{s.mod} · {s.color} · T{s.talla}</p>
                                ) : (
                                    <p className="text-sm font-mono text-red-600">{s.code}</p>
                                )}
                                <p className="text-xs text-slate-400">{formatDate(s.ts)}</p>
                            </div>
                            <div className={`w-2.5 h-2.5 rounded-full ${s.recognized ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── SESSIONS ADMIN TAB ───────────────────────────────────────────────────────
const SessionsAdminTab = ({ addToast }: { addToast: (m: string, t?: ToastType) => void }) => {
    const [sessions, setSessions] = useState<ScanSession[]>([]);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [items, setItems] = useState<{ [id: string]: SessionItem[] }>({});
    const [loadingItems, setLoadingItems] = useState<string | null>(null);

    useEffect(() => {
        const unsub = fbSubscribeToAllSessions((s) => setSessions(s as ScanSession[]));
        return () => unsub();
    }, []);

    const loadItems = async (sessionId: string) => {
        if (items[sessionId]) { setExpanded(expanded === sessionId ? null : sessionId); return; }
        setLoadingItems(sessionId);
        const data = await fbGetSessionItems(sessionId);
        setItems(prev => ({ ...prev, [sessionId]: data as SessionItem[] }));
        setLoadingItems(null);
        setExpanded(sessionId);
    };

    const exportSession = async (session: ScanSession) => {
        let data = items[session.id];
        if (!data) { data = await fbGetSessionItems(session.id) as SessionItem[]; }
        const header = 'Código,Modelo,Color,Talla,Reconocido,Fecha\n';
        const rows = data.map(s =>
            `${s.code},${s.mod || ''},${s.color || ''},${s.talla || ''},${s.recognized ? 'Sí' : 'No'},${formatDate(s.ts)}`
        ).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sesion-${session.area}-${session.operator}.csv`;
        a.click();
        addToast('CSV exportado', 'success');
    };

    const deleteSession = async (sessionId: string) => {
        if (!confirm('¿Eliminar esta sesión?')) return;
        await fbDeleteSession(sessionId);
        addToast('Sesión eliminada', 'info');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Wifi size={16} className="text-emerald-500" />
                <h2 className="font-bold text-slate-800">Sesiones de Escáner</h2>
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold ml-auto">En tiempo real</span>
            </div>

            {sessions.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                    <p>Sin sesiones activas</p>
                    <p className="text-sm">Cuando un scanner inicie un escaneo aparecerá aquí</p>
                </div>
            )}

            {sessions.map(session => (
                <div key={session.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="p-4">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                                    <span className="font-bold text-slate-800">{session.area}</span>
                                </div>
                                <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                                    <Users size={12} /> {session.operator}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {typeof session.createdAt === 'number' ? formatDate(session.createdAt) : 'Activo'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-sky-600">{session.count || 0}</p>
                                <p className="text-xs text-slate-400">escaneos</p>
                            </div>
                        </div>
                    </div>
                    <div className="border-t bg-slate-50 px-4 py-2 flex gap-2">
                        <button onClick={() => loadItems(session.id)} className="flex items-center gap-1 text-xs bg-white border px-3 py-1.5 rounded-lg text-slate-600">
                            {loadingItems === session.id ? '...' : expanded === session.id ? <><ChevronUp size={12} /> Ocultar</> : <><Eye size={12} /> Ver items</>}
                        </button>
                        <button onClick={() => exportSession(session)} className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg font-semibold">
                            <Download size={12} /> CSV
                        </button>
                        <button onClick={() => deleteSession(session.id)} className="text-red-400 px-2 py-1.5 ml-auto"><Trash2 size={14} /></button>
                    </div>
                    {expanded === session.id && items[session.id] && (
                        <div className="border-t max-h-60 overflow-y-auto">
                            {items[session.id].map(item => (
                                <div key={item.id} className={`px-4 py-2 border-b last:border-0 flex justify-between text-xs ${!item.recognized ? 'bg-red-50' : ''}`}>
                                    <span className={item.recognized ? 'text-slate-700' : 'text-red-600 font-mono'}>
                                        {item.recognized ? `${item.mod} · ${item.color} · T${item.talla}` : item.code}
                                    </span>
                                    <span className="text-slate-400">{formatDate(item.ts)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ─── FOLIO TAB ────────────────────────────────────────────────────────────────
const FolioTab = ({ onJoin, onCreate, addToast, colors, catalog }: {
    onJoin: (id: string) => void; onCreate: (id: string) => void;
    addToast: (m: string, t?: ToastType) => void;
    colors: ColorMap; catalog: Catalog;
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

    const load = useCallback(async () => {
        setLoading(true);
        const all = await fbGetAllFolios();
        setFolios((all as Folio[]).sort((a, b) => b.createdAt - a.createdAt));
        const wh = JSON.parse(localStorage.getItem('conteo:warehouses') || '[]');
        setSavedWarehouses(wh);
        const n = JSON.parse(localStorage.getItem('conteo:notes') || '{}');
        setNotes(n);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        if (!name.trim()) { addToast('Escribe un nombre', 'warning'); return; }
        const id = 'F-' + Date.now().toString(36).toUpperCase();
        const f: Folio = {
            id, name: name.trim(), almacen: almacen.trim() || 'Tienda',
            temporada: temporada.trim(), state: 'open',
            theoreticalMap: {}, existenciasMap: {}, areaCounters: {}, createdAt: Date.now()
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
        const all = await fbGetAllFolios();
        const f = all.find((x: any) => x.id === fid) as Folio;
        if (!f) return;
        await fbUpdateFolio({ ...f, state: 'closed' });
        setClosingFolio(null);
        addToast('Inventario cerrado', 'info');
        await load();
    };

    const handleReopen = async (fid: string) => {
        const all = await fbGetAllFolios();
        const f = all.find((x: any) => x.id === fid) as Folio;
        if (!f) return;
        await fbUpdateFolio({ ...f, state: 'open' });
        addToast('Inventario reabierto', 'success');
        await load();
    };

    const handleDelete = async (fid: string) => {
        if (!confirm('¿Eliminar este inventario y todos sus escaneos?')) return;
        await fbDeleteFolio(fid);
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
                <div className="bg-white rounded-xl border border-sky-200 p-4 shadow-sm space-y-3">
                    <p className="font-semibold text-slate-700">Nuevo Inventario</p>
                    <input className="w-full border rounded-lg p-2 text-sm" placeholder="Nombre *" value={name} onChange={e => setName(e.target.value)} />
                    <div>
                        <input className="w-full border rounded-lg p-2 text-sm" placeholder="Almacén / Tienda" value={almacen} onChange={e => setAlmacen(e.target.value)} />
                        {savedWarehouses.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                                {savedWarehouses.map(w => (
                                    <button key={w} onClick={() => setAlmacen(w)} className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600">{w}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    <input className="w-full border rounded-lg p-2 text-sm" placeholder="Temporada (opcional)" value={temporada} onChange={e => setTemporada(e.target.value)} />
                    <div className="flex gap-2">
                        <button onClick={handleCreate} className="flex-1 bg-sky-500 text-white rounded-lg py-2 text-sm font-semibold">Crear</button>
                        <button onClick={() => setCreating(false)} className="flex-1 bg-slate-100 text-slate-700 rounded-lg py-2 text-sm">Cancelar</button>
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
        </div>
    );
};

// ─── STOCK TAB ────────────────────────────────────────────────────────────────
const StockTab = ({ folioId, catalog, colors, onUpdate, addToast }: {
    folioId: string | null; catalog: Catalog; colors: ColorMap;
    onUpdate: (c: Catalog) => void; addToast: (m: string, t?: ToastType) => void;
}) => {
    const [rawText, setRawText] = useState('');
    const [preview, setPreview] = useState<any[]>([]);
    const [mode, setMode] = useState<'replace' | 'add'>('add');
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);

    const parseRaw = () => {
        const lines = rawText.trim().split('\n').filter(l => l.trim());
        const parsed: any[] = [];
        for (const line of lines) {
            const trimmed = line.trim();
            let modRaw = '';
            let rest = '';

            // Soporta formato con coma: "041-66,MARINO  250  8"
            const commaIdx = trimmed.indexOf(',');
            if (commaIdx !== -1) {
                modRaw = trimmed.substring(0, commaIdx).trim();
                rest = trimmed.substring(commaIdx + 1).trim();
            } else {
                // Formato clásico con espacios: "04166 MARINO 250 8"
                const firstSpace = trimmed.search(/\s/);
                if (firstSpace === -1) continue;
                modRaw = trimmed.substring(0, firstSpace).trim();
                rest = trimmed.substring(firstSpace).trim();
            }

            // "rest" = "COLOR TALLA QTY"
            const parts = rest.split(/\s+/);
            if (parts.length < 3) continue;
            const qty = parseInt(parts[parts.length - 1]);
            const tallaRaw = parts[parts.length - 2];
            const colorRaw = parts.slice(0, parts.length - 2).join(' ');
            if (isNaN(qty) || !modRaw || !colorRaw || !tallaRaw) continue;
            const cat = detectCategoryBySize(tallaRaw);
            const vkey = keyOf(modRaw, colorRaw, tallaRaw, cat);
            parsed.push({ mod: cleanModel(modRaw), color: canonical(colorRaw), talla: tallaRaw, qty, vkey, cat });
        }
        setPreview(parsed); setStep(1);
    };

    const handleConfirm = async () => {
        if (!folioId) { addToast('Selecciona un inventario primero', 'warning'); return; }
        setLoading(true);
        const theoretical: StockMap = {};
        const newCatalog = { byBarcode: { ...catalog.byBarcode }, byVariant: { ...catalog.byVariant } };
        for (const item of preview) {
            if (mode === 'replace') theoretical[item.vkey] = item.qty;
            else theoretical[item.vkey] = (theoretical[item.vkey] || 0) + item.qty;
            newCatalog.byVariant[item.vkey] = { mod: item.mod, color: item.color, talla: item.talla, vkey: item.vkey, category: item.cat };
            const bc = generateBarcode(item.mod, item.color, item.talla, colors);
            newCatalog.byBarcode[bc] = newCatalog.byVariant[item.vkey];
        }
        // Get folio from Firebase and update
        const all = await fbGetAllFolios();
        const folio = all.find((f: any) => f.id === folioId) as Folio;
        if (folio) {
            let mergedMap: StockMap;
            if (mode === 'replace') {
                mergedMap = theoretical;
            } else {
                // CORRECCIÓN: sumar cantidades pieza por pieza, no sobreescribir con spread
                mergedMap = { ...(folio.theoreticalMap || {}) };
                for (const [vkey, qty] of Object.entries(theoretical)) {
                    mergedMap[vkey] = (mergedMap[vkey] || 0) + qty;
                }
            }
            await fbUpdateFolio({ ...folio, theoreticalMap: mergedMap });
        }
        await fbSaveSettings('catalog', newCatalog);
        onUpdate(newCatalog);
        setLoading(false);
        addToast(`${preview.length} variantes cargadas`, 'success');
        setRawText(''); setPreview([]); setStep(0);
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
                                <span className="font-mono">{p.mod} · {p.color} · {p.talla}</span>
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

// ─── SCAN TAB (Inventario Cíclico) ────────────────────────────────────────────
const ScanTab = ({ folio, catalog, colors, scans, role, addToast }: {
    folio: Folio | null; catalog: Catalog; colors: ColorMap;
    scans: Scan[]; role: Role; addToast: (m: string, t?: ToastType) => void;
}) => {
    const [barcode, setBarcode] = useState('');
    const [area, setArea] = useState('ÁREA-A');
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
        setArea(a); setNewArea('');
    };

    const coveragePct = folio ? (() => {
        const total = Object.values(folio.theoreticalMap || {}).reduce((a, b) => a + b, 0);
        const scanned = Object.values(folio.existenciasMap || {}).reduce((a, b) => a + b, 0);
        return total > 0 ? (scanned / total) * 100 : 0;
    })() : 0;

    if (!folio) return <div className="text-center py-12 text-slate-400"><QrCode className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>No hay inventario activo</p></div>;

    const allAreas = ['ÁREA-A', 'ÁREA-B', 'ÁREA-C', 'ÁREA-D', 'BODEGA', ...customAreas];

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
                <div><p className="font-semibold text-slate-700 text-sm">Cobertura</p><p className="text-xs text-slate-500">{folio.name}</p></div>
            </div>

            <div>
                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Área actual</p>
                <div className="flex flex-wrap gap-2">
                    {allAreas.map(a => (
                        <button key={a} onClick={() => setArea(a)} className={`px-3 py-1.5 rounded-full text-sm font-medium border ${area === a ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-slate-600 border-slate-200'}`}>{a}</button>
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
                            <p className={`text-sm ${lastScan.ok ? 'text-emerald-600' : 'text-red-600 font-mono'}`}>{lastScan.ok ? `Talla ${lastScan.talla}` : lastScan.code}</p>
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

// ─── PRINT STYLES ─────────────────────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
    body * { visibility: hidden !important; }
    #print-report, #print-report * { visibility: visible !important; }
    #print-report { position: fixed; top: 0; left: 0; width: 100%; padding: 24px; background: white; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    th { background: #1e293b !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr.faltante td { background: #fef2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr.sobrante td { background: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .summary-box { border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; display: inline-block; margin-right: 8px; }
    @page { margin: 1.5cm; size: A4 portrait; }
}
`;

// ─── REPORT TAB ───────────────────────────────────────────────────────────────
const ReportTab = ({ folio, scans, onTabChange, addToast }: {
    folio: Folio | null; scans: Scan[];
    onTabChange: (t: Tab) => void; addToast: (m: string, t?: ToastType) => void;
}) => {
    const [filter, setFilter] = useState<'all' | 'faltante' | 'sobrante' | 'ok'>('all');
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [printMode, setPrintMode] = useState<'completo' | 'simplificado'>('completo');

    const report = useMemo(() => {
        if (!folio) return { rows: [], totalItems: 0, scannedItems: 0, missingItems: 0, sobranteItems: 0 };
        const allKeys = new Set([...Object.keys(folio.theoreticalMap || {}), ...Object.keys(folio.existenciasMap || {})]);
        const rows = Array.from(allKeys).map(vkey => {
            const teo = folio.theoreticalMap[vkey] || 0;
            const fis = folio.existenciasMap[vkey] || 0;
            const diff = fis - teo;
            const parts = splitKey(vkey);
            const areaMap: { [a: string]: number } = {};
            scans.filter(s => s.vkey === vkey).forEach(s => { areaMap[s.area] = (areaMap[s.area] || 0) + 1; });
            const status: 'ok' | 'faltante' | 'sobrante' = diff < 0 ? 'faltante' : diff > 0 ? 'sobrante' : 'ok';
            return { vkey, teo, fis, diff, status, areaMap, ...parts };
        });
        return {
            rows,
            totalItems: rows.reduce((a, r) => a + r.teo, 0),
            scannedItems: rows.reduce((a, r) => a + r.fis, 0),
            missingItems: rows.filter(r => r.status === 'faltante').reduce((a, r) => a + Math.abs(r.diff), 0),
            sobranteItems: rows.filter(r => r.status === 'sobrante').reduce((a, r) => a + r.diff, 0),
        };
    }, [folio, scans]);

    const top5 = useMemo(() => report.rows.filter(r => r.status === 'faltante').sort((a, b) => a.diff - b.diff).slice(0, 5), [report.rows]);
    const areaChart = useMemo(() => {
        const map: { [a: string]: number } = {};
        scans.forEach(s => { map[s.area] = (map[s.area] || 0) + 1; });
        return Object.entries(map).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count);
    }, [scans]);
    const filtered = useMemo(() => report.rows.filter(r => filter === 'all' || r.status === filter), [report.rows, filter]);
    const coveragePct = report.totalItems > 0 ? (report.scannedItems / report.totalItems) * 100 : 0;

    const exportCSV = () => {
        const header = 'Modelo,Color,Talla,Teórico,Físico,Diferencia,Estado\n';
        const rows = report.rows.map(r => `${r.mod},${r.color},${r.talla},${r.teo},${r.fis},${r.diff},${r.status}`).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `reporte-${folio?.name}.csv`; a.click();
        addToast('CSV exportado', 'success');
    };

    const handlePrint = (mode: 'completo' | 'simplificado') => {
        setPrintMode(mode);
        if (!document.getElementById('print-styles')) {
            const style = document.createElement('style');
            style.id = 'print-styles';
            style.innerHTML = PRINT_STYLES;
            document.head.appendChild(style);
        }
        // Small delay so React renders the correct printMode before printing
        setTimeout(() => window.print(), 80);
    };

    // Simplificado: only rows that have at least 1 scan (fis > 0)
    const simplificadoRows = useMemo(() =>
        report.rows.filter(r => r.fis > 0).sort((a, b) => a.diff - b.diff),
        [report.rows]
    );
    const simplificadoMissing = simplificadoRows.filter(r => r.status === 'faltante').reduce((a, r) => a + Math.abs(r.diff), 0);
    const simplificadoSobrante = simplificadoRows.filter(r => r.status === 'sobrante').reduce((a, r) => a + r.diff, 0);
    const simplificadoOk = simplificadoRows.filter(r => r.status === 'ok').length;

    if (!folio) return <div className="text-center py-12 text-slate-400"><BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>Abre un inventario para ver el reporte</p><button onClick={() => onTabChange('folio')} className="mt-3 text-sm text-sky-500 underline">Ir a Inventarios →</button></div>;

    const printDate = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

    return (
        <div className="space-y-4">
            {/* ── PRINTABLE REPORT (hidden on screen, visible on print) ── */}
            <div id="print-report" style={{ display: 'none' }}>
                {/* Header */}
                <div style={{ borderBottom: '3px solid #0ea5e9', paddingBottom: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                                Reporte {printMode === 'simplificado' ? 'Simplificado' : 'Completo'} — Inventario Cíclico
                            </h1>
                            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{folio.name} · {folio.almacen}{folio.temporada ? ` · ${folio.temporada}` : ''}</p>
                            {printMode === 'simplificado' && (
                                <p style={{ fontSize: 11, color: '#f59e0b', margin: '4px 0 0', fontStyle: 'italic' }}>
                                    Solo modelos escaneados al menos una vez · Modelos sin escaneo excluidos
                                </p>
                            )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Conteo Cíclico Pro v3.1</p>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{printDate}</p>
                        </div>
                    </div>
                </div>

                {/* Summary boxes */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    {printMode === 'completo' ? (
                        <>
                            {[
                                { label: 'Cobertura', value: `${Math.round(coveragePct)}%`, color: coveragePct >= 100 ? '#10b981' : coveragePct >= 70 ? '#f59e0b' : '#ef4444' },
                                { label: 'Teórico', value: String(report.totalItems), color: '#0f172a' },
                                { label: 'Físico', value: String(report.scannedItems), color: '#0ea5e9' },
                                { label: 'Faltantes', value: `-${report.missingItems}`, color: '#ef4444' },
                                { label: 'Sobrantes', value: `+${report.sobranteItems}`, color: '#10b981' },
                                { label: 'SKUs OK', value: String(report.rows.filter(r => r.status === 'ok').length), color: '#10b981' },
                            ].map(item => (
                                <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', minWidth: 80, textAlign: 'center' }}>
                                    <p style={{ fontSize: 18, fontWeight: 'bold', color: item.color, margin: 0 }}>{item.value}</p>
                                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', textTransform: 'uppercase' }}>{item.label}</p>
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            {[
                                { label: 'SKUs escaneados', value: String(simplificadoRows.length), color: '#0ea5e9' },
                                { label: 'Faltantes', value: `-${simplificadoMissing}`, color: '#ef4444' },
                                { label: 'Sobrantes', value: `+${simplificadoSobrante}`, color: '#10b981' },
                                { label: 'Completos', value: String(simplificadoOk), color: '#10b981' },
                                { label: 'Con diferencia', value: String(simplificadoRows.filter(r => r.status !== 'ok').length), color: '#f59e0b' },
                            ].map(item => (
                                <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', minWidth: 80, textAlign: 'center' }}>
                                    <p style={{ fontSize: 18, fontWeight: 'bold', color: item.color, margin: 0 }}>{item.value}</p>
                                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', textTransform: 'uppercase' }}>{item.label}</p>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Area distribution */}
                {areaChart.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Distribución por Área</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {areaChart.map(({ area, count }) => (
                                <div key={area} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11 }}>
                                    <span style={{ fontWeight: 'bold' }}>{area}</span>: {count} escaneos
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Main table */}
                <table>
                    <thead>
                        <tr>
                            {['Modelo', 'Color', 'Talla', 'Teórico', 'Físico', 'Dif.', 'Estado', 'Áreas'].map(h => (
                                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 'bold', background: '#1e293b', color: 'white' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {(printMode === 'completo' ? report.rows.sort((a, b) => a.diff - b.diff) : simplificadoRows).map((r, i) => (
                            <tr key={r.vkey} className={r.status} style={{ background: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                                <td style={{ padding: '5px 8px', fontSize: 10, fontWeight: 'bold', color: '#0f172a' }}>{r.mod}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, color: '#475569' }}>{r.color}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, color: '#475569', textAlign: 'center' }}>{r.talla}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, textAlign: 'center', color: '#0f172a' }}>{r.teo}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, textAlign: 'center', color: '#0ea5e9', fontWeight: 'bold' }}>{r.fis}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, textAlign: 'center', fontWeight: 'bold', color: r.diff < 0 ? '#ef4444' : r.diff > 0 ? '#10b981' : '#94a3b8' }}>
                                    {r.diff > 0 ? '+' : ''}{r.diff}
                                </td>
                                <td style={{ padding: '5px 8px', fontSize: 10 }}>
                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 'bold', background: r.status === 'ok' ? '#d1fae5' : r.status === 'faltante' ? '#fee2e2' : '#fef3c7', color: r.status === 'ok' ? '#065f46' : r.status === 'faltante' ? '#991b1b' : '#92400e' }}>
                                        {r.status.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '5px 8px', fontSize: 9, color: '#94a3b8' }}>
                                    {Object.entries(r.areaMap).map(([a, c]) => `${a}:${c}`).join(' ')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 20, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                    <span>Conteo Cíclico Pro v3.1 · Firebase Sync</span>
                    <span>{printMode === 'simplificado' ? `SKUs escaneados: ${simplificadoRows.length}` : `Total SKUs: ${report.rows.length}`} · Escaneos: {scans.length}</span>
                    <span>{printDate}</span>
                </div>
            </div>

            {/* ── SCREEN UI ── */}
            <div className="grid grid-cols-2 gap-3 no-print">
                <div className="bg-white rounded-xl p-4 shadow-sm border text-center"><CoverageRing pct={coveragePct} size={70} /><p className="text-xs text-slate-500 mt-1">Cobertura</p></div>
                <div className="space-y-2">
                    <div className="bg-white rounded-xl p-3 shadow-sm border flex justify-between items-center"><div><p className="text-xs text-slate-400">Teórico</p><p className="font-bold text-slate-700">{report.totalItems}</p></div><Package size={18} className="text-slate-300" /></div>
                    <div className="bg-white rounded-xl p-3 shadow-sm border flex justify-between items-center"><div><p className="text-xs text-slate-400">Físico</p><p className="font-bold text-sky-600">{report.scannedItems}</p></div><Check size={18} className="text-emerald-300" /></div>
                    <div className="bg-red-50 rounded-xl p-3 border border-red-100 flex justify-between items-center"><div><p className="text-xs text-red-400">Faltantes</p><p className="font-bold text-red-600">{report.missingItems}</p></div><AlertTriangle size={18} className="text-red-300" /></div>
                </div>
            </div>

            {top5.length > 0 && (
                <div className="bg-red-50 rounded-xl p-4 border border-red-200 no-print">
                    <p className="text-xs font-bold text-red-700 uppercase mb-2">Top 5 Faltantes</p>
                    {top5.map(r => <div key={r.vkey} className="flex justify-between text-xs py-1 border-b border-red-100 last:border-0"><span className="text-red-700">{r.mod} · {r.color} · {r.talla}</span><span className="font-bold text-red-600">{r.diff}</span></div>)}
                </div>
            )}

            {areaChart.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border no-print">
                    <p className="text-xs font-bold text-slate-600 uppercase mb-3">Escaneos por Área</p>
                    {areaChart.map(({ area, count }) => (
                        <div key={area} className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-600 w-20 truncate">{area}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-4"><div className="h-4 bg-sky-400 rounded-full" style={{ width: `${(count / areaChart[0].count) * 100}%` }} /></div>
                            <span className="text-xs font-bold text-slate-600 w-8 text-right">{count}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 flex-wrap no-print">
                {(['all', 'faltante', 'sobrante', 'ok'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${filter === f ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                        {f === 'all' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
                        {f !== 'all' && <span className="ml-1">({report.rows.filter(r => r.status === f).length})</span>}
                    </button>
                ))}
            </div>

            {/* Print + CSV buttons */}
            <div className="flex gap-2 no-print">
                <button onClick={() => handlePrint('completo')} className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-white rounded-xl py-3 font-semibold text-sm active:scale-95 transition-transform">
                    🖨️ Completo
                </button>
                <button onClick={() => handlePrint('simplificado')} className="flex-1 flex items-center justify-center gap-2 bg-sky-600 text-white rounded-xl py-3 font-semibold text-sm active:scale-95 transition-transform">
                    📋 Simplificado
                </button>
                <button onClick={exportCSV} className="flex items-center gap-1 border-2 border-slate-200 text-slate-600 rounded-xl px-4 py-3 text-sm font-medium">
                    <Download size={16} />
                </button>
            </div>

            {/* Rows list */}
            <div className="space-y-1 no-print">
                {filtered.map(r => (
                    <div key={r.vkey} className="bg-white rounded-xl border overflow-hidden shadow-sm">
                        <button onClick={() => setExpandedKey(expandedKey === r.vkey ? null : r.vkey)} className="w-full text-left px-4 py-3 flex items-center gap-2">
                            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{r.mod}</p><p className="text-xs text-slate-500">{r.color} · Talla {r.talla}</p></div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-bold text-slate-700">{r.teo}/{r.fis}</span>
                                <span className={`text-sm font-bold w-8 text-right ${r.diff < 0 ? 'text-red-500' : r.diff > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>{r.diff > 0 ? '+' : ''}{r.diff}</span>
                                <div className={`w-2.5 h-2.5 rounded-full ${r.status === 'ok' ? 'bg-emerald-400' : r.status === 'faltante' ? 'bg-red-400' : 'bg-amber-400'}`} />
                                {expandedKey === r.vkey ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                            </div>
                        </button>
                        {expandedKey === r.vkey && Object.keys(r.areaMap).length > 0 && (
                            <div className="border-t bg-slate-50 px-4 py-2">
                                {Object.entries(r.areaMap).map(([a, c]) => <div key={a} className="flex justify-between text-xs text-slate-600 py-0.5"><span>{a}</span><span className="font-bold">{c as number}</span></div>)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── HISTORY TAB ──────────────────────────────────────────────────────────────
const HistoryTab = ({ scans, folioId, folio, onDataChange, addToast }: {
    scans: Scan[]; folioId: string | null; folio: Folio | null;
    onDataChange: () => void; addToast: (m: string, t?: ToastType) => void;
}) => {
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());

    const filtered = useMemo(() => {
        const q = search.trim().toUpperCase();
        return scans.filter(s => !q || s.mod?.includes(q) || s.color?.includes(q) || s.area?.includes(q) || s.code?.includes(q));
    }, [scans, search]);

    const handleDelete = async (s: Scan) => {
        if (!folioId) return;
        await fbDeleteScan(s.id, folioId, s.vkey, s.area, s.pos);
        addToast('Escaneo eliminado', 'info');
    };

    const handleDeleteSelected = async () => {
        if (!folioId || selected.size === 0) return;
        if (!confirm(`¿Eliminar ${selected.size} escaneos?`)) return;
        for (const id of Array.from(selected)) {
            const s = scans.find(x => x.id === id);
            if (s) await fbDeleteScan(s.id, folioId, s.vkey, s.area, s.pos);
        }
        setSelected(new Set());
        addToast(`${selected.size} escaneos eliminados`, 'warning');
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <div className="flex-1 relative">
                    <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                    <input className="w-full border rounded-xl pl-8 pr-4 py-2.5 text-sm" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                {selected.size > 0 && <button onClick={handleDeleteSelected} className="px-3 bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-semibold">Eliminar ({selected.size})</button>}
            </div>
            <p className="text-xs text-slate-400">{filtered.length} escaneos</p>
            <div className="space-y-2">
                {filtered.map(s => (
                    <div key={s.id} className={`bg-white rounded-xl border shadow-sm px-4 py-3 flex items-start gap-3 ${selected.has(s.id) ? 'border-sky-400 bg-sky-50' : ''}`}>
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => {
                            setSelected(prev => { const n = new Set(prev); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n; });
                        }} className="mt-1 w-4 h-4 rounded" />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 text-sm">{s.mod} · {s.color} · T{s.talla}</p>
                            <p className="text-xs text-slate-500">{s.area} · #{s.pos} · {s.user}</p>
                            <p className="text-xs text-slate-400">{formatDate(s.ts)}</p>
                        </div>
                        <button onClick={() => handleDelete(s)} className="text-red-400"><Trash2 size={16} /></button>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── QUERY TAB ────────────────────────────────────────────────────────────────
const QueryTab = ({ folio, scans }: { folio: Folio | null; scans: Scan[] }) => {
    const [query, setQuery] = useState('');
    const results = useMemo(() => {
        if (!folio || !query.trim()) return [];
        const q = query.trim().toUpperCase();
        const allKeys = new Set([...Object.keys(folio.theoreticalMap || {}), ...Object.keys(folio.existenciasMap || {})]);
        return Array.from(allKeys).map(vkey => {
            const parts = splitKey(vkey);
            if (!parts.mod.includes(q) && !parts.color.includes(q) && !parts.talla.includes(q)) return null;
            const teo = folio.theoreticalMap[vkey] || 0;
            const fis = folio.existenciasMap[vkey] || 0;
            const areaMap: { [a: string]: number } = {};
            scans.filter(s => s.vkey === vkey).forEach(s => { areaMap[s.area] = (areaMap[s.area] || 0) + 1; });
            return { vkey, teo, fis, diff: fis - teo, areaMap, ...parts };
        }).filter(Boolean) as any[];
    }, [folio, query, scans]);

    if (!folio) return <div className="text-center py-12 text-slate-400"><Search className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>Abre un inventario primero</p></div>;

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                <input className="w-full border-2 border-sky-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-sky-400" placeholder="Buscar modelo, color o talla..." value={query} onChange={e => setQuery(e.target.value)} />
            </div>
            {results.map(r => (
                <div key={r.vkey} className="bg-white rounded-xl border shadow-sm p-4">
                    <div className="flex justify-between items-start">
                        <div><p className="font-bold text-slate-800">{r.mod}</p><p className="text-sm text-slate-500">{r.color} · Talla {r.talla}</p></div>
                        <div className="text-right"><p className="text-xs text-slate-400">Teo / Fís</p><p className="text-lg font-bold">{r.teo} / <span className={r.fis >= r.teo ? 'text-emerald-600' : 'text-red-500'}>{r.fis}</span></p></div>
                    </div>
                    {Object.keys(r.areaMap).length > 0 && (
                        <div className="mt-2 pt-2 border-t flex flex-wrap gap-2">
                            {Object.entries(r.areaMap).map(([a, c]) => <span key={a} className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full">{a}: {c as number}</span>)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ─── DICT TAB ─────────────────────────────────────────────────────────────────
const DictTab = ({ colors, onUpdate, addToast }: { colors: ColorMap; onUpdate: (m: ColorMap) => void; addToast: (m: string, t?: ToastType) => void }) => {
    const [search, setSearch] = useState('');
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [editing, setEditing] = useState<string | null>(null);
    const [editCode, setEditCode] = useState('');

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
                                <button onClick={() => { if (!confirm(`¿Eliminar "${name}"?`)) return; const c = { ...colors }; delete c[name]; onUpdate(c); }} className="text-red-400"><Trash2 size={14} /></button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── DATABASE TAB ─────────────────────────────────────────────────────────────
const DatabaseTab = ({ addToast }: { addToast: (m: string, t?: ToastType) => void }) => {
    const [lastBackup, setLastBackup] = useState<string | null>(() => localStorage.getItem('conteo:lastBackup'));

    const handleExport = async () => {
        const dump = await fbGetFullDump();
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

// ─── INFO TAB ─────────────────────────────────────────────────────────────────
const InfoTab = () => (
    <div className="space-y-4">
        <div className="bg-gradient-to-br from-sky-500 to-sky-700 rounded-xl p-6 text-white text-center">
            <QrCode size={40} className="mx-auto mb-2 opacity-90" />
            <h1 className="text-2xl font-bold">Conteo Cíclico Pro</h1>
            <p className="text-sky-200 text-sm">Versión 3.1 · Firebase Sync</p>
        </div>
        {[
            { icon: <Wifi size={18} className="text-emerald-500" />, title: 'Sincronización en Tiempo Real', desc: 'Todos los datos se sincronizan instantáneamente vía Firebase Firestore.' },
            { icon: <Users size={18} className="text-sky-500" />, title: 'Multi-Scanner', desc: 'Múltiples scanners pueden escanear simultáneamente. El admin ve todo en tiempo real.' },
            { icon: <PlayCircle size={18} className="text-amber-500" />, title: 'Sesiones Independientes', desc: 'Los scanners crean sesiones propias con área y operador, sin afectar los folios.' },
            { icon: <BarChart3 size={18} className="text-purple-500" />, title: 'Reporte en Vivo', desc: 'Cobertura, faltantes y distribución por área actualizados al instante.' },
        ].map((item, i) => (
            <div key={i} className="bg-white rounded-xl border p-4 shadow-sm flex gap-3">
                <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                <div><p className="font-semibold text-slate-700 text-sm">{item.title}</p><p className="text-xs text-slate-500 mt-0.5">{item.desc}</p></div>
            </div>
        ))}
    </div>
);

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin }: { onLogin: (r: Role) => void }) => {
    const [pass, setPass] = useState('');
    const [loading, setLoading] = useState(false);

    const ADMIN_HASH = '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918';

    const handleAdmin = async () => {
        setLoading(true);
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
        const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        setLoading(false);
        if (hash === ADMIN_HASH) onLogin('admin');
        else alert('Contraseña incorrecta');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
            <div className="w-full max-w-sm space-y-6">
                <div className="text-center text-white">
                    <div className="w-20 h-20 bg-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-2xl"><QrCode size={40} className="text-white" /></div>
                    <h1 className="text-2xl font-bold">Conteo Cíclico Pro</h1>
                    <p className="text-slate-400 text-sm">v3.1 · Firebase Sync</p>
                </div>
                <div className="bg-sky-500 rounded-2xl p-6 text-center shadow-xl">
                    <QrCode size={36} className="mx-auto text-white mb-3 opacity-90" />
                    <p className="text-white text-sm font-medium mb-4">Acceso rápido para scanners</p>
                    <button onClick={() => onLogin('scanner')} className="w-full bg-white text-sky-600 font-bold py-3 rounded-xl text-lg shadow-md active:scale-95 transition-transform">
                        Iniciar Escaneo
                    </button>
                    <p className="text-sky-200 text-[10px] mt-2">Sincronización en tiempo real con el admin</p>
                </div>
                <div className="relative flex items-center"><div className="flex-grow border-t border-slate-600"></div><span className="mx-4 text-slate-400 text-xs">ADMINISTRADOR</span><div className="flex-grow border-t border-slate-600"></div></div>
                <div className="bg-white bg-opacity-10 rounded-2xl p-5 space-y-3">
                    <input type="password" placeholder="Contraseña de administrador" className="w-full bg-white bg-opacity-20 border border-white border-opacity-30 rounded-xl p-3 text-white placeholder-slate-400 focus:outline-none focus:border-sky-400" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdmin()} />
                    <button onClick={handleAdmin} disabled={loading} className="w-full bg-white text-slate-800 font-bold py-3 rounded-xl shadow-md active:scale-95 transition-transform disabled:opacity-50">
                        {loading ? 'Verificando...' : 'Ingresar como Admin'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
const App: React.FC = () => {
    const [role, setRole] = useState<Role | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('folio');
    const [folioId, setFolioId] = useState<string | null>(null);
    const [folio, setFolio] = useState<Folio | null>(null);
    const [catalog, setCatalog] = useState<Catalog>({ byBarcode: {}, byVariant: {} });
    const [scans, setScans] = useState<Scan[]>([]);
    const [colors, setColors] = useState<ColorMap>(DEFAULT_COLORS);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confetti, setConfetti] = useState(false);
    const [startTime] = useState(Date.now());
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!role) return;
        const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
        return () => clearInterval(interval);
    }, [role, startTime]);

    const formatElapsed = () => {
        const h = Math.floor(elapsed / 3600), m = Math.floor((elapsed % 3600) / 60), s = elapsed % 60;
        return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
    };

    const addToast = useCallback((msg: string, type: ToastType = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev.slice(-4), { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    }, []);

    useEffect(() => {
        const milestones = [100, 500, 1000];
        if (milestones.includes(scans.length)) {
            setConfetti(true);
            setTimeout(() => setConfetti(false), 3000);
            addToast(`🎉 ¡${scans.length} escaneos!`, 'success');
        }
    }, [scans.length]);

    useEffect(() => {
        fbLoadSettings('catalog').then(c => { if (c) setCatalog(c); });
        fbLoadSettings('colors').then(cm => { if (cm) setColors(prev => ({ ...prev, ...cm })); });
    }, []);

    useEffect(() => {
        if (!folioId) return;
        const unsubFolio = fbSubscribeToFolio(folioId, data => { if (data) setFolio(data as Folio); });
        const unsubScans = fbSubscribeToScans(folioId, data => { setScans(data as Scan[]); });
        return () => { unsubFolio(); unsubScans(); };
    }, [folioId]);

    const handleLogin = async (r: Role) => {
        setRole(r);
        if (r === 'scanner') {
            // Auto-join last open folio
            const f = await fbGetLastOpenFolio() as Folio | undefined;
            if (f) {
                setFolioId(f.id);
                setFolio(f);
            }
            setActiveTab('escanear');
        } else {
            setActiveTab('folio');
        }
    };

    const handleUpdateColorMap = (m: ColorMap) => { setColors(m); fbSaveSettings('colors', m); };
    const handleUpdateCatalog = (c: Catalog) => { setCatalog(c); };
    const handleTabChange = useCallback((t: Tab) => { setActiveTab(t); window.scrollTo(0, 0); }, []);

    if (!role) return <LoginScreen onLogin={handleLogin} />;

    // Tabs config
    const tabs = [
        { id: 'folio', label: 'Inventarios', icon: <FileText />, roles: ['admin'] },
        { id: 'existencias', label: 'Cargar', icon: <Boxes />, roles: ['admin'] },
        { id: 'escanear', label: 'Escanear', icon: <QrCode />, roles: ['admin', 'scanner'] },
        { id: 'sesiones', label: 'Sesiones', icon: <Users />, roles: ['admin'], badge: 0 },
        { id: 'reporte', label: 'Reporte', icon: <BarChart3 />, roles: ['admin'] },
        { id: 'consulta', label: 'Consulta', icon: <Search />, roles: ['admin'] },
        { id: 'historial', label: 'Historial', icon: <History />, roles: ['admin'] },
        { id: 'colores', label: 'Colores', icon: <Palette />, roles: ['admin'] },
        { id: 'database', label: 'DB', icon: <Database />, roles: ['admin'] },
        { id: 'info', label: 'Info', icon: <BookOpen />, roles: ['admin'] },
    ];

    const visibleTabs = tabs.filter(t => t.roles.includes(role!));

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
            <Confetti active={confetti} />

            {/* Header */}
            <header className="bg-white border-b px-4 py-3 flex justify-between items-center shadow-sm z-10 flex-shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                    {folio ? (
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">Inventario Activo</span>
                            <span className="font-bold text-slate-800 text-sm truncate max-w-[140px] sm:max-w-xs">{folio.name}</span>
                        </div>
                    ) : <span className="font-bold text-slate-800 text-sm">Conteo Cíclico Pro</span>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium">
                        <Wifi size={12} /> Live
                    </div>
                    {role === 'admin' && <div className="flex items-center gap-1 text-xs text-slate-400"><Timer size={12} />{formatElapsed()}</div>}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{role}</span>
                    <button onClick={() => { setRole(null); setFolioId(null); setFolio(null); setScans([]); }} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><LogOut size={18} /></button>
                </div>
            </header>

            {/* Main */}
            <main className="flex-1 overflow-auto p-4 pb-24">
                <ErrorBoundary tab={activeTab}>
                    {activeTab === 'folio' && role === 'admin' && <FolioTab onJoin={(id) => { setFolioId(id); setActiveTab('reporte'); }} onCreate={(id) => setFolioId(id)} addToast={addToast} colors={colors} catalog={catalog} />}
                    {activeTab === 'existencias' && role === 'admin' && <StockTab folioId={folioId} catalog={catalog} colors={colors} onUpdate={handleUpdateCatalog} addToast={addToast} />}
                    {activeTab === 'escanear' && <ScanTab folio={folio} catalog={catalog} colors={colors} scans={scans} role={role!} addToast={addToast} />}
                    {activeTab === 'sesiones' && role === 'admin' && <SessionsAdminTab addToast={addToast} />}
                    {activeTab === 'reporte' && role === 'admin' && <ReportTab folio={folio} scans={scans} onTabChange={handleTabChange} addToast={addToast} />}
                    {activeTab === 'consulta' && role === 'admin' && <QueryTab folio={folio} scans={scans} />}
                    {activeTab === 'historial' && role === 'admin' && <HistoryTab scans={scans} folioId={folioId} folio={folio} onDataChange={() => {}} addToast={addToast} />}
                    {activeTab === 'colores' && role === 'admin' && <DictTab colors={colors} onUpdate={handleUpdateColorMap} addToast={addToast} />}
                    {activeTab === 'database' && role === 'admin' && <DatabaseTab addToast={addToast} />}
                    {activeTab === 'info' && role === 'admin' && <InfoTab />}
                </ErrorBoundary>
            </main>

            {/* Bottom Nav */}
            <nav className="bg-white border-t flex justify-around fixed bottom-0 w-full z-20 overflow-x-auto py-1">
                {visibleTabs.map(t => (
                    <button key={t.id} onClick={() => handleTabChange(t.id as Tab)} className={`flex flex-col items-center px-2 py-2 min-w-[48px] rounded-xl transition-all relative ${activeTab === t.id ? 'text-sky-600 bg-sky-50' : 'text-slate-400'}`}>
                        <div className="w-5 h-5">{t.icon}</div>
                        <span className="text-[9px] font-medium mt-0.5 whitespace-nowrap">{t.label}</span>
                    </button>
                ))}
            </nav>

            <style>{`
                @keyframes confetti { from { transform: translateY(-20px) rotate(0deg); opacity: 1; } to { transform: translateY(100vh) rotate(720deg); opacity: 0; } }
            `}</style>
        </div>
    );
};

export default App;
