import React, { useState, useEffect, useCallback } from 'react';
import {
    fbGetLastOpenFolio, fbSubscribeToFolio,
    fbSubscribeToScans, fbSubscribeToAllSessions,
} from './firebase.ts';
import type { Role, Tab, Folio, Catalog, ColorMap, Scan, ToastType, ScanSession } from './types.ts';
import { AlmacenModule } from './AlmacenModule';
import { splitKey } from './utils.ts';
import {
    sizeSystemByModel, uniRopaModels, tallaVariantByModel,
} from './ropaUtils.ts';
import type { SizeSystem } from './ropaUtils.ts';
import {
    QrCode, ChevronDown, FileText, BarChart3,
    LogOut, Search, Database, Palette, Boxes, X, MapPin, BookOpen,
    Timer, AlertTriangle, Warehouse, MoreHorizontal, Users,
    Wifi, Moon, Sun,
} from './icons.tsx';
import { useConfirm } from './hooks.tsx';
import { InfoTab } from './InfoTab.tsx';
import { QueryTab } from './QueryTab.tsx';
import { DictTab } from './DictTab.tsx';
import { DatabaseTab } from './DatabaseTab.tsx';
import { UbicacionesTab } from './UbicacionesTab.tsx';
import { ReportTab, PRINT_STYLES } from './ReportTab.tsx';
import { GlobalSearchModal } from './GlobalSearchModal.tsx';
import { SettingsPanel } from './SettingsPanel.tsx';
import { PinKeyboard, OperatorsPanel } from './OperatorsPanel.tsx';
import { FolioTab } from './FolioTab.tsx';
import { StockTab } from './StockTab.tsx';
import { ScanTab } from './ScanTab.tsx';
import { CoverageRing } from './CoverageRing.tsx';
import { LoginScreen } from './LoginScreen.tsx';
import { SuperAdminPanel } from './SuperAdminPanel.tsx';
import { SessionsAdminTab } from './SessionsAdminTab.tsx';
import { ScannerSessionTab } from './ScannerSessionTab.tsx';
import { type AppSession, saveSession, loadSession, clearSession } from './session.ts';
import { applyTheme, loadUIPrefs, saveUIPrefs, type FontSize } from './uiUtils.ts';

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface Toast { id: string; msg: string; type: ToastType; }

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
    // Colores compuestos y adicionales verificados con barcodes reales
    'NEGRO/MULTICOLOR': '087', 'AZUL MULTICOLOR': '127', 'MARINO MULTICOLOR': '145',
    'NEGRO MULTICOLOR': '437', 'ARENA MULTICOLOR': '292', 'IVORY MULTICOLOR': '492',
    'NEGRO/AZUL': '303', 'NEGRO/IVORY': '878', 'NEGRO/ROJO': '115',
    'BLANCO/NEGRO': '039', 'BLANCO/ROJO': '043', 'AZUL/BLANCO': '142',
    'NARANJA/NEGRO': '141', 'CAMEL/NEGRO': '163', 'MARINO/BLANCO': '933',
    'AZUL ACERO': '496', 'AZUL MEZCLILLA': '551', 'MEZCLILLA GRIS': '768',
    'PALO DE ROSA': '506', 'CHAMPAGNE': '732', 'UVA': '288', 'GRIS JASPE': '964',
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

// ─── BANNER OFFLINE ───────────────────────────────────────────────────────────
export const useOnlineStatus = () => {
    const [online, setOnline] = React.useState(navigator.onLine);
    React.useEffect(() => {
        const on = () => setOnline(true);
        const off = () => setOnline(false);
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);
    return online;
};

const OfflineBanner = () => {
    const [online, setOnline] = React.useState(navigator.onLine);
    const [justReconnected, setJustReconnected] = React.useState(false);
    const [offlineSince, setOfflineSince] = React.useState<number | null>(null);
    const wasOffline = React.useRef(false);

    React.useEffect(() => {
        const on = () => {
            setOnline(true);
            setOfflineSince(null);
            if (wasOffline.current) {
                setJustReconnected(true);
                setTimeout(() => setJustReconnected(false), 3500);
            }
            wasOffline.current = false;
        };
        const off = () => {
            setOnline(false);
            setOfflineSince(Date.now());
            wasOffline.current = true;
        };
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
    }, []);

    if (online && !justReconnected) return null;

    if (justReconnected) return (
        <div style={{ animation: 'slideDown 0.3s ease' }} className="bg-emerald-500 text-white px-4 py-2.5 flex items-center gap-2 text-sm font-semibold z-30">
            <Wifi size={15} />
            <span>Conexión restaurada — sincronizando datos...</span>
        </div>
    );

    const minutos = offlineSince ? Math.floor((Date.now() - offlineSince) / 60000) : 0;

    return (
        <div style={{ animation: 'slideDown 0.3s ease' }} className="bg-red-500 text-white px-4 py-2.5 flex items-center gap-2 text-sm font-semibold z-30">
            <AlertTriangle size={15} className="flex-shrink-0" />
            <span className="flex-1">
                Sin conexión{minutos > 0 ? ` · ${minutos} min` : ''} — los escaneos se guardarán al reconectarse
            </span>
            <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse flex-shrink-0" />
        </div>
    );
};

// ─── MAIN APP v4 ──────────────────────────────────────────────────────────────
const App: React.FC = () => {
    const isOnline = useOnlineStatus();
    const [session, setSession]   = useState<AppSession | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('folio');
    const [folioId, setFolioId]   = useState<string | null>(null);
    const [folio, setFolio]       = useState<Folio | null>(null);
    const [catalog, setCatalog]   = useState<Catalog>({ byBarcode: {}, byVariant: {} });
    const [scans, setScans]       = useState<Scan[]>([]);
    const [colors, setColors]     = useState<ColorMap>(DEFAULT_COLORS);
    const [toasts, setToasts]     = useState<Toast[]>([]);
    const [confetti, setConfetti] = useState(false);
    const [startTime]             = useState(Date.now());
    const [elapsed, setElapsed]   = useState(0);
    const [showSettings,  setShowSettings]  = useState(false);
    const [showOperators, setShowOperators] = useState(false);
    const [showSearch,    setShowSearch]    = useState(false);
    const [showMoreMenu,  setShowMoreMenu]  = useState(false);
    const [activeScannerCount, setActiveScannerCount] = useState(0);
    const [sessions, setSessions] = useState<ScanSession[]>([]);
    const [isDark, setIsDark] = useState(() => loadUIPrefs().dark);

    const sucursalId = session?.sucursalId;
    const role: Role | null = !session ? null : session.tipo === 'admin' ? 'admin' : 'scanner';

    useEffect(() => { const p = loadUIPrefs(); applyTheme(p.dark, p.font); }, []);

    useEffect(() => {
        if (!session) return;
        const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
        return () => clearInterval(iv);
    }, [session, startTime]);

    // Timeout watcher operadores
    useEffect(() => {
        if (!session || session.tipo !== 'operador') return;
        const iv = setInterval(() => { if (!loadSession()) { setSession(null); setFolioId(null); setFolio(null); setScans([]); } }, 30000);
        const refresh = () => { const s = loadSession(); if (s) saveSession({ ...s, loginAt: Date.now() }); };
        window.addEventListener('click', refresh);
        window.addEventListener('keydown', refresh);
        window.addEventListener('touchstart', refresh);
        return () => { clearInterval(iv); window.removeEventListener('click', refresh); window.removeEventListener('keydown', refresh); window.removeEventListener('touchstart', refresh); };
    }, [session]);

    const formatElapsed = () => { const h = Math.floor(elapsed/3600), m = Math.floor((elapsed%3600)/60), s = elapsed%60; return `${h>0?h+'h ':''}${m}m ${s}s`; };

    const addToast = useCallback((msg: string, type: ToastType = 'info') => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev.slice(-4), { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    }, []);

    useEffect(() => {
        const milestones = [100,500,1000];
        if (milestones.includes(scans.length)) { setConfetti(true); setTimeout(() => setConfetti(false), 3000); addToast(`🎉 ¡${scans.length} escaneos!`, 'success'); }
    }, [scans.length]);

    useEffect(() => {
        try { const cm = localStorage.getItem('conteo:colors'); if (cm) setColors(prev => ({ ...prev, ...JSON.parse(cm) })); } catch {}
    }, []);

    useEffect(() => {
        if (!folioId) return;
        const unsubFolio = fbSubscribeToFolio(folioId, data => { if (data) setFolio(data as Folio); }, sucursalId ?? undefined);
        const unsubScans = fbSubscribeToScans(folioId, data => { setScans(data as Scan[]); }, sucursalId ?? undefined);
        return () => { unsubFolio(); unsubScans(); };
    }, [folioId, sucursalId]);

    // Sesiones — badge de nav + datos para SessionsAdminTab (una sola suscripción)
    useEffect(() => {
        if (!sucursalId) return;
        const ACTIVE_THRESHOLD = 90_000;
        const unsub = fbSubscribeToAllSessions((data: any[]) => {
            const typed = data as ScanSession[];
            setSessions(typed);
            const count = typed.filter(s => (Date.now() - (s.lastSeen ?? 0)) < ACTIVE_THRESHOLD).length;
            setActiveScannerCount(prev => prev === count ? prev : count);
        }, sucursalId);
        return () => unsub();
    }, [sucursalId]);

    useEffect(() => {
        if (!folio?.theoreticalMap) { setCatalog({ byBarcode: {}, byVariant: {} }); return; }
        const byVariant: Catalog['byVariant'] = {};
        const byBarcode: Catalog['byBarcode'] = {};
        const vkeys = Object.keys(folio.theoreticalMap);

        // Reset estado global mutable
        for (const k of Object.keys(sizeSystemByModel)) delete sizeSystemByModel[k];
        for (const k of Object.keys(tallaVariantByModel)) delete tallaVariantByModel[k];
        uniRopaModels.clear();

        // Paso 1 — pasada única: catálogo + uniRopa + __VAR__ + sizeparts
        const spByModel: Record<string, number[]> = {};
        for (const vkey of vkeys) {
            const isRopa = vkey.startsWith('R|');
            if (isRopa) {
                const p = vkey.split('|');
                const col = p[2], sp3 = p[3], mod = p[1];
                if (col === '__VAR__') {
                    if (sp3) {
                        const [base, variant] = sp3.split(':');
                        if (base && variant) {
                            if (!tallaVariantByModel[mod]) tallaVariantByModel[mod] = {};
                            tallaVariantByModel[mod][base] = variant;
                        }
                    }
                    continue;
                }
                if (col === '__SYS__') continue;
                if (sp3 === '990') uniRopaModels.add(mod);
                const sp = parseInt(sp3 || '0');
                if (!isNaN(sp)) {
                    if (!spByModel[mod]) spByModel[mod] = [];
                    spByModel[mod].push(sp);
                }
            }
            const parts = splitKey(vkey);
            if (!parts.mod) continue;
            const item = { mod: parts.mod, color: parts.color || '', talla: parts.talla || '', vkey, category: parts.category };
            byVariant[vkey] = item;
            if (parts.barcode) byBarcode[parts.barcode] = item;
        }

        // Paso 2 — marcadores __SYS__ (necesita spByModel del paso 1)
        for (const vkey of vkeys) {
            if (!vkey.startsWith('R|')) continue;
            const p = vkey.split('|');
            if (p[2] !== '__SYS__' || !p[3]) continue;
            const sys = p[3] as SizeSystem;
            const sps = spByModel[p[1]] || [];
            if (sys === 'brasier' && !sps.includes(160)) continue;
            sizeSystemByModel[p[1]] = sys;
        }

        // Paso 3 — inferir sistema para modelos sin marcador
        for (const [modKey, sps] of Object.entries(spByModel)) {
            if (sizeSystemByModel[modKey]) continue;
            const damaCount   = sps.filter(sp => sp >= 100 && sp <= 160 && sp % 10 === 0).length;
            const jeansDCount = sps.filter(sp => [30,50,70,90].includes(sp)).length;
            const jeansCCount = sps.filter(sp => sp >= 280 && sp <= 500).length;
            const bebeCount   = sps.filter(sp => sp >= 100 && sp <= 105).length;
            const anosCount   = sps.filter(sp => sp >= 109 && sp <= 129).length;

            if (sps.includes(160) || sps.some(sp => sp >= 232 && sp <= 260)) { sizeSystemByModel[modKey] = 'brasier'; continue; }
            if (jeansCCount > 0)                                 { sizeSystemByModel[modKey] = 'jeans_cab'; continue; }
            if (bebeCount > 1)                                   { sizeSystemByModel[modKey] = 'bebe';      continue; }
            if (anosCount > 0 && damaCount === 0)                { sizeSystemByModel[modKey] = 'anos';      continue; }
            if (jeansDCount > 0 && jeansDCount >= damaCount)    { sizeSystemByModel[modKey] = 'jeans_dama'; continue; }
            sizeSystemByModel[modKey] = 'dama';
        }

        setCatalog({ byVariant, byBarcode });
    }, [folio?.theoreticalMap]);

    const handleLogin = async (s: AppSession) => {
        setSession(s);
        if (s.tipo === 'operador') {
            const f = await fbGetLastOpenFolio(s.sucursalId) as Folio | undefined;
            if (f) { setFolioId(f.id); setFolio(f); }
            setActiveTab('escanear');
        } else if (s.tipo === 'admin') {
            setActiveTab('folio');
        }
    };

    const handleLogout = () => { clearSession(); setSession(null); setFolioId(null); setFolio(null); setScans([]); };
    const handleUpdateColorMap = (m: ColorMap) => { setColors(m); try { localStorage.setItem('conteo:colors', JSON.stringify(m)); } catch {} };
    const handleTabChange = useCallback((t: Tab) => { setActiveTab(t); window.scrollTo(0,0); }, []);

    // Superadmin ve su propio panel
    if (!session) return <LoginScreen onLogin={handleLogin} />;
    if (session.tipo === 'superadmin') return <SuperAdminPanel onLogout={handleLogout} />;

    const tabs = [
        { id: 'folio',       label: 'Inventarios', icon: <FileText />,  roles: ['admin'] },
        { id: 'existencias', label: 'Cargar',       icon: <Boxes />,     roles: ['admin'] },
        { id: 'escanear',    label: 'Escanear',     icon: <QrCode />,    roles: ['scanner'] },
        { id: 'sesiones',    label: 'Sesiones',     icon: <Users />,     roles: ['admin'], badge: activeScannerCount },
        { id: 'reporte',     label: 'Reporte',      icon: <BarChart3 />, roles: ['admin'] },
        { id: 'consulta',    label: 'Consulta',     icon: <Search />,    roles: ['admin'] },
        { id: 'historial',   label: 'Ubic. Modelo', icon: <MapPin />,    roles: ['admin'] },
        { id: 'colores',     label: 'Colores',      icon: <Palette />,   roles: ['admin'] },
        { id: 'database',    label: 'DB',           icon: <Database />,  roles: ['admin'] },
        { id: 'info',        label: 'Info',         icon: <BookOpen />,  roles: ['admin'] },
        { id: 'almacen',     label: 'Almacén',      icon: <Warehouse />, roles: ['admin'] },
    ];
    const visibleTabs = role === 'scanner' ? [] : tabs.filter(t => t.roles.includes(role!));
    const MORE_TAB_IDS = new Set(['colores', 'database', 'info']);
    const primaryTabs  = visibleTabs.filter(t => !MORE_TAB_IDS.has(t.id));
    const moreTabs     = visibleTabs.filter(t =>  MORE_TAB_IDS.has(t.id));
    const activeInMore = moreTabs.some(t => t.id === activeTab);

    return (
        <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 dark:text-white">
            <OfflineBanner />
            <ToastContainer toasts={toasts} onRemove={id => setToasts(prev => prev.filter(t => t.id !== id))} />
            <Confetti active={confetti} />

            <header className="bg-white dark:bg-slate-900 dark:border-slate-700 border-b px-4 py-3 flex justify-between items-center shadow-sm z-10 flex-shrink-0">
                <div className="flex items-center gap-2 overflow-hidden">
                    {folio ? (
                        <div className="flex flex-col">
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">
                                {session.sucursalNombre} · Inventario Activo
                            </span>
                            <span className="font-bold text-slate-800 dark:text-white text-sm truncate max-w-[140px] sm:max-w-xs">{folio.name}</span>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <span className="font-bold text-slate-800 dark:text-white text-sm">Conteo Ciclico Pro</span>
                            <span className="text-[10px] text-slate-400">{session.sucursalNombre}</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {isOnline
                        ? <div className="flex items-center gap-1 text-xs text-emerald-500 font-medium"><Wifi size={12}/> Live</div>
                        : <div className="flex items-center gap-1 text-xs text-red-500 font-medium"><AlertTriangle size={12}/> Offline</div>
                    }
                    {role === 'admin' && <div className="flex items-center gap-1 text-xs text-slate-400"><Timer size={12}/>{formatElapsed()}</div>}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                        {session.nombre}
                    </span>
                    {role === 'admin' && folio && (
                        <button onClick={() => setShowSearch(true)} className="p-1.5 text-slate-400 hover:text-sky-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Buscar código">
                            <Search size={17} />
                        </button>
                    )}
                    {role === 'admin' && (
                        <button onClick={() => setShowOperators(true)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Operadores">👥</button>
                    )}
                    <button
                        onClick={() => { const p = loadUIPrefs(); const next = !p.dark; saveUIPrefs(next, p.font); setIsDark(next); }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                        title={isDark ? 'Modo claro' : 'Modo oscuro'}
                    >
                        {isDark ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                    <button onClick={() => setShowSettings(true)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">⚙️</button>
                    <button onClick={handleLogout} className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50"><LogOut size={18}/></button>
                </div>
            </header>

            <main className={`flex-1 overflow-auto p-4 ${role === 'admin' ? 'pb-24' : 'pb-4'}`}>
                {role === 'scanner' && (
                    <ErrorBoundary tab="escanear">
                        <ScannerSessionTab colors={colors} catalog={catalog} folio={folio} addToast={addToast} appSession={session} sucursalId={sucursalId ?? undefined} />
                    </ErrorBoundary>
                )}
                {role === 'admin' && (
                    <>
                        <div className={activeTab === 'folio'       ? '' : 'hidden'}><ErrorBoundary tab="folio">      <FolioTab onJoin={(id) => { setFolioId(id); setActiveTab('reporte'); }} onCreate={(id) => setFolioId(id)} addToast={addToast} colors={colors} catalog={catalog} sucursalId={sucursalId ?? undefined} /></ErrorBoundary></div>
                        <div className={activeTab === 'existencias'  ? '' : 'hidden'}><ErrorBoundary tab="existencias"><StockTab folioId={folioId} catalog={catalog} colors={colors} onUpdate={() => {}} addToast={addToast} sucursalId={sucursalId ?? undefined} /></ErrorBoundary></div>
                        <div className={activeTab === 'sesiones'     ? '' : 'hidden'}><ErrorBoundary tab="sesiones">  <SessionsAdminTab addToast={addToast} sucursalId={sucursalId ?? undefined} folio={folio} scans={scans} colors={colors} catalog={catalog} sessions={sessions} /></ErrorBoundary></div>
                        <div className={activeTab === 'reporte'      ? '' : 'hidden'}><ErrorBoundary tab="reporte">   <ReportTab folio={folio} scans={scans} onTabChange={handleTabChange} addToast={addToast} /></ErrorBoundary></div>
                        <div className={activeTab === 'consulta'     ? '' : 'hidden'}><ErrorBoundary tab="consulta">  <QueryTab folio={folio} scans={scans} /></ErrorBoundary></div>
                        <div className={activeTab === 'historial'    ? '' : 'hidden'}><ErrorBoundary tab="historial"> <UbicacionesTab sucursalId={sucursalId ?? undefined} folio={folio} scans={scans} addToast={addToast} /></ErrorBoundary></div>
                        <div className={activeTab === 'colores'      ? '' : 'hidden'}><ErrorBoundary tab="colores">   <DictTab colors={colors} onUpdate={handleUpdateColorMap} addToast={addToast} /></ErrorBoundary></div>
                        <div className={activeTab === 'database'     ? '' : 'hidden'}><ErrorBoundary tab="database">  <DatabaseTab addToast={addToast} sucursalId={sucursalId} /></ErrorBoundary></div>
                        <div className={activeTab === 'info'         ? '' : 'hidden'}><ErrorBoundary tab="info">      <InfoTab /></ErrorBoundary></div>
                        <div className={activeTab === 'almacen'      ? '' : 'hidden'}><ErrorBoundary tab="almacen">   <AlmacenModule sucursalId={sucursalId ?? undefined} isSuperAdmin={false} /></ErrorBoundary></div>
                    </>
                )}
            </main>

            {role === 'admin' && visibleTabs.length > 0 && (
                <>
                    {showMoreMenu && (
                        <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                    )}
                    <nav className="bg-white dark:bg-slate-900 dark:border-slate-700 border-t flex justify-around fixed bottom-0 w-full z-40 py-1">
                        {primaryTabs.map(t => (
                            <button key={t.id} onClick={() => { handleTabChange(t.id as Tab); setShowMoreMenu(false); }}
                                className={`flex flex-col items-center px-2 py-2 flex-1 rounded-xl transition-all relative ${activeTab === t.id ? 'text-sky-600 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500'}`}>
                                <div className="w-5 h-5 relative">
                                    {t.icon}
                                    {(t.badge ?? 0) > 0 && (
                                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-0.5 leading-none">
                                            {t.badge}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[9px] font-medium mt-0.5 whitespace-nowrap">{t.label}</span>
                            </button>
                        ))}
                        {moreTabs.length > 0 && (
                            <button onClick={() => setShowMoreMenu(v => !v)}
                                className={`flex flex-col items-center px-2 py-2 flex-1 rounded-xl transition-all relative ${activeInMore || showMoreMenu ? 'text-sky-600 bg-sky-50 dark:bg-sky-900/30' : 'text-slate-400 dark:text-slate-500'}`}>
                                <div className="w-5 h-5">
                                    {showMoreMenu ? <ChevronDown size={20} /> : <MoreHorizontal size={20} />}
                                </div>
                                <span className="text-[9px] font-medium mt-0.5 whitespace-nowrap">
                                    {activeInMore ? (moreTabs.find(t => t.id === activeTab)?.label ?? 'Más') : 'Más'}
                                </span>

                                {showMoreMenu && (
                                    <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden min-w-[160px]" onClick={e => e.stopPropagation()}>
                                        {moreTabs.map(t => (
                                            <button key={t.id} onClick={() => { handleTabChange(t.id as Tab); setShowMoreMenu(false); }}
                                                className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${activeTab === t.id ? 'bg-sky-50 dark:bg-sky-900/30 text-sky-600' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>
                                                <div className="w-5 h-5 flex-shrink-0">{t.icon}</div>
                                                <span className="text-sm font-medium">{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </button>
                        )}
                    </nav>
                </>
            )}

            <style>{`
                @keyframes confetti { from { transform: translateY(-20px) rotate(0deg); opacity:1; } to { transform: translateY(100vh) rotate(720deg); opacity:0; } }
                @keyframes slideDown { from { transform: translateY(-100%); opacity:0; } to { transform: translateY(0); opacity:1; } }
                @keyframes countPop { 0% { transform: scale(1.25); opacity:0.7; } 100% { transform: scale(1); opacity:1; } }
            `}</style>
            {showSettings  && <SettingsPanel  onClose={() => setShowSettings(false)} />}
            {showOperators && sucursalId && <OperatorsPanel sucursalId={sucursalId} onClose={() => setShowOperators(false)} addToast={addToast} />}
            {showSearch    && <GlobalSearchModal folio={folio} scans={scans} catalog={catalog} onClose={() => setShowSearch(false)} />}
        </div>
    );
};

export default App;
