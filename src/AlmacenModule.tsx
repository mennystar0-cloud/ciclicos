import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { db } from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import type { AlmacenLayout, SeccionAlmacen, RackAlmacen } from './types';

// ─── Color palette (hash-based, consistent per line name) ──────────────────
const PALETTE = [
    { bg: '#E6F1FB', bd: '#85B7EB', tx: '#0C447C' },
    { bg: '#E1F5EE', bd: '#5DCAA5', tx: '#085041' },
    { bg: '#EEEDFE', bd: '#AFA9EC', tx: '#3C3489' },
    { bg: '#FAECE7', bd: '#F0997B', tx: '#712B13' },
    { bg: '#FAEEDA', bd: '#EF9F27', tx: '#633806' },
    { bg: '#EAF3DE', bd: '#97C459', tx: '#27500A' },
    { bg: '#FBEAF0', bd: '#ED93B1', tx: '#4B1528' },
    { bg: '#FCEBEB', bd: '#F09595', tx: '#501313' },
];
const EMPTY_C = { bg: '#F1EFE8', bd: '#D3D1C7', tx: '#888780' };

const lineColor = (linea: string) => {
    if (!linea) return EMPTY_C;
    let h = 0;
    for (let i = 0; i < linea.length; i++) h = (h * 31 + linea.charCodeAt(i)) & 0xFFFF;
    return PALETTE[h % PALETTE.length];
};

// ─── Firebase helpers (scoped to this module) ──────────────────────────────
const subscribeLayouts = (cb: (ls: AlmacenLayout[]) => void) =>
    onSnapshot(collection(db, 'almacen_layouts'), snap =>
        cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as AlmacenLayout)))
    );

const saveLayout = (layout: AlmacenLayout) =>
    setDoc(doc(db, 'almacen_layouts', layout.id), layout);

const removeLayout = (id: string) =>
    deleteDoc(doc(db, 'almacen_layouts', id));

// ─── Layout predefinido (extraído de los planos del almacén) ──────────────
const r = (numero: number, linea: string): RackAlmacen => ({ numero, linea });

const LAYOUT_PREDEFINIDO: Omit<AlmacenLayout, 'id' | 'creadoEn' | 'actualizadoEn' | 'sucursalesAsignadas'> = {
    nombre: 'Layout Calzado Juárez',
    descripcion: 'Layout completo del almacén — extraído de los planos',
    secciones: [
        // ── Plano: columna 1 (izquierda) ────────────────────────────────────
        {
            id: 'pre-linea',
            nombre: 'Sección 1 — Línea',
            planCol: 1, cols: 2,
            racks: [
                r(16,'CONFORT'), r(17,'CONFORT'), r(18,'CONFORT'), r(19,'CONFORT'),
                r(20,'CONFORT'), r(21,'CONFORT'), r(22,'CONFORT'), r(23,'CONFORT'),
                r(24,'CONFORT LINEA/OFERTA'), r(25,'CONFORT'),
                r(26,'GLAMOUR/CONFORT'), r(27,'CONFORT'),
                r(28,'GLAMOUR'), r(29,'GLAMOUR'),
                r(30,'GLAMOUR/B2S'), r(31,'GLAMOUR/B2S'),
                r(32,'B2S'), r(33,'B2S'),
                r(34,'URBAN'), r(35,'URBAN'),
                r(36,''),
            ],
        },
        {
            id: 'pre-ninos',
            nombre: 'Planta Baja — Niños / Bota',
            planCol: 1, cols: 2,
            racks: [
                r(37,'NIÑOS Y B2S LINEA'), r(38,'NIÑOS Y B2S LINEA'),
                r(39,'NIÑOS Y B2S LINEA'), r(40,'NIÑOS Y B2S LINEA'),
                r(41,'NIÑOS Y B2S LINEA'), r(42,'NIÑOS Y B2S LINEA'),
                r(43,'NIÑOS Y B2S LINEA'), r(44,'NIÑOS LINEA/OFERTA'),
                r(45,'NIÑOS Y B2S LINEA'), r(46,'NIÑOS OFERTA'),
                r(47,'NIÑOS OFERTA'), r(48,'LIBRE'),
                r(49,'EXCEDENTE PASO/SALDO'),
                r(50,'BOTA'), r(51,'BOTA'), r(52,'BOTA'),
                r(53,'BOTA'), r(54,'BOTA'), r(55,'BOTA'),
            ],
        },
        // ── Plano: columna 2 (centro) ────────────────────────────────────────
        {
            id: 'pre-six',
            nombre: 'Six y Dúo',
            planCol: 2, cols: 1,
            racks: [
                r(9,'SIX Y DUO'), r(10,'SIX Y DUO'), r(11,'SIX Y DUO'),
                r(12,'SIX Y DUO'), r(13,'SIX Y DUO'), r(14,'SIX Y DUO'),
                r(15,'SIX Y DUO'),
            ],
        },
        {
            id: 'pre-dama',
            nombre: 'Planta Baja — Dama',
            planCol: 2, cols: 5,
            racks: [
                r(56,'DAMA LINEA'), r(57,'DAMA LINEA'), r(58,'DAMA LINEA'),
                r(59,'DAMA LINEA'), r(60,'DAMA LINEA'), r(61,'DAMA LINEA'),
                r(62,'DAMA LINEA'), r(63,'DAMA LINEA'), r(64,'DAMA LINEA'),
                r(65,'DAMA LINEA'),
                r(66,'DAMA'), r(67,'DAMA'), r(68,'DAMA'), r(69,'DAMA'), r(70,'DAMA'),
                r(71,'DAMA OFERTA'), r(72,'DAMA OFERTA'), r(73,'DAMA OFERTA'),
                r(74,'DAMA OFERTA'), r(75,'DAMA OFERTA'),
            ],
        },
        {
            id: 'pre-3p',
            nombre: 'Tercer Piso',
            planCol: 2, cols: 2,
            racks: [ r(93,''), r(94,'') ],
        },
        // ── Plano: columna 3 (derecha) ────────────────────────────────────────
        {
            id: 'pre-cab',
            nombre: 'Caballero',
            planCol: 3, cols: 1,
            racks: [
                r(1,'CABALLERO/URBAN'), r(2,'CABALLERO'), r(3,'CABALLERO'),
                r(4,'CABALLERO'), r(5,'CABALLERO'), r(6,'CABALLERO'),
                r(7,'CABALLERO'), r(8,'CABALLERO'),
            ],
        },
        {
            id: 'pre-der',
            nombre: 'Planta Baja — Derecha',
            planCol: 3, cols: 2,
            racks: [
                r(77,'URBAN'), r(78,'URBAN'), r(79,'URBAN'), r(80,'URBAN'),
                r(81,'URBAN'), r(82,'URBAN'), r(83,'URBAN'), r(84,'URBAN'),
                r(85,'URBAN'), r(86,'URBAN'),
                r(87,'SPORT'), r(88,'EXC URBAN'), r(89,'EXC URBAN'),
                r(90,'INFRAMUNDO'),
                r(91,'PANTUNFLA HUARACHE OFERTA'),
                r(92,'PANTUNFLA HUARACHE LINEA'),
            ],
        },
        {
            id: 'pre-touch',
            nombre: 'Touch / Pedidos',
            planCol: 3, cols: 4,
            racks: [
                r(95,''),
                r(103,'PERIMETRO 3'), r(104,'PERIMETRO 2'), r(105,'PERIMETRO 1'),
                r(106,'BASE 1'), r(107,'BASE 2'),
                r(108,'ATEMPORAL 1'), r(109,'ATEMPORAL 2'),
                r(110,'MESA 1'), r(111,'MESA 2'), r(112,'MESA 3'), r(113,'MESA 4'),
                r(114,'ZAPATERA 1'), r(115,'ZAPATERA 2'),
            ],
        },
    ],
};

// ─── Parse rack range string ("1-8, 10, 12-15") ───────────────────────────
function parseRange(input: string): number[] {
    const nums = new Set<number>();
    input.split(',').forEach(part => {
        const p = part.trim();
        if (p.includes('-')) {
            const [a, b] = p.split('-').map(Number);
            if (!isNaN(a) && !isNaN(b))
                for (let i = Math.min(a, b); i <= Math.max(a, b); i++) nums.add(i);
        } else {
            const n = parseInt(p);
            if (!isNaN(n)) nums.add(n);
        }
    });
    return Array.from(nums).sort((a, b) => a - b);
}

// ─── Rack card ─────────────────────────────────────────────────────────────
const RackCard = ({
    rack, selected, onClick,
}: { rack: RackAlmacen; selected: boolean; onClick: () => void }) => {
    const c = lineColor(rack.linea);
    const pct = rack.capacidad && rack.capacidad > 0
        ? Math.round(((rack.piezasActuales || 0) / rack.capacidad) * 100)
        : null;
    return (
        <button
            onClick={onClick}
            style={{ background: c.bg, borderColor: selected ? '#7c3aed' : c.bd }}
            className={`rounded-xl border-2 p-2 text-left w-full transition-all ${selected ? 'ring-2 ring-violet-400 ring-offset-1 scale-[1.04]' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
        >
            <div className="text-[10px] font-black leading-none" style={{ color: c.tx }}>{rack.numero}</div>
            <div className="text-[9px] font-semibold leading-tight mt-1 truncate" style={{ color: c.tx }}>
                {rack.linea ? rack.linea : <span style={{ opacity: 0.3 }}>—</span>}
            </div>
            {pct !== null && (
                <div className="mt-1.5 h-[3px] rounded-full overflow-hidden" style={{ background: c.bd + '55' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: c.tx, opacity: 0.55 }} />
                </div>
            )}
        </button>
    );
};

// ─── Rack edit panel ────────────────────────────────────────────────────────
const RackPanel = ({
    rack, onSave, onCancel,
}: { rack: RackAlmacen; onSave: (u: Partial<RackAlmacen>) => Promise<void>; onCancel: () => void }) => {
    const [linea, setLinea] = useState(rack.linea || '');
    const [cap, setCap] = useState(rack.capacidad != null ? String(rack.capacidad) : '');
    const [pzs, setPzs] = useState(rack.piezasActuales != null ? String(rack.piezasActuales) : '');
    const [notas, setNotas] = useState(rack.notas || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave({
            linea: linea.trim().toUpperCase(),
            capacidad: cap !== '' ? (parseInt(cap) || 0) : undefined,
            piezasActuales: pzs !== '' ? (parseInt(pzs) || 0) : undefined,
            notas: notas.trim() || undefined,
        });
        setSaving(false);
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700 dark:text-white">Rack #{rack.numero}</p>
            <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Línea asignada</label>
                <input
                    className="w-full border dark:border-slate-600 rounded-xl p-2.5 text-sm mt-1 dark:bg-slate-700 dark:text-white font-semibold uppercase"
                    placeholder="CABALLERO, CONFORT, GLAMOUR..."
                    value={linea}
                    onChange={e => setLinea(e.target.value.toUpperCase())}
                    autoFocus
                />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Capacidad (pzas)</label>
                    <input type="number" min="0"
                        className="w-full border dark:border-slate-600 rounded-xl p-2.5 text-sm mt-1 dark:bg-slate-700 dark:text-white"
                        placeholder="0" value={cap} onChange={e => setCap(e.target.value)} />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pzas. actuales</label>
                    <input type="number" min="0"
                        className="w-full border dark:border-slate-600 rounded-xl p-2.5 text-sm mt-1 dark:bg-slate-700 dark:text-white"
                        placeholder="0" value={pzs} onChange={e => setPzs(e.target.value)} />
                </div>
            </div>
            <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Notas</label>
                <input
                    className="w-full border dark:border-slate-600 rounded-xl p-2.5 text-sm mt-1 dark:bg-slate-700 dark:text-white"
                    placeholder="Opcional" value={notas} onChange={e => setNotas(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-1">
                <button onClick={onCancel}
                    className="flex-1 py-2.5 text-sm bg-slate-100 dark:bg-slate-700 dark:text-white text-slate-700 rounded-xl font-medium">
                    Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2.5 text-sm bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar'}
                </button>
            </div>
        </div>
    );
};

// ─── Props ──────────────────────────────────────────────────────────────────
interface Props {
    sucursalId?: string;
    isSuperAdmin: boolean;
    sucursales?: { id: string; nombre: string }[];
}

// ─── Main component ─────────────────────────────────────────────────────────
export const AlmacenModule = ({ sucursalId, isSuperAdmin, sucursales = [] }: Props) => {
    const [layouts, setLayouts] = useState<AlmacenLayout[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminVista, setAdminVista] = useState<'list' | 'editor'>('list');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedSecId, setSelectedSecId] = useState<string | null>(null);
    const [selectedRackNum, setSelectedRackNum] = useState<number | null>(null);
    const [vistaPlano, setVistaPlano] = useState(false);

    // New layout form
    const [showNewLayout, setShowNewLayout] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [savingLayout, setSavingLayout] = useState(false);

    // New section form
    const [showNewSec, setShowNewSec] = useState(false);
    const [newSecNombre, setNewSecNombre] = useState('');
    const [newSecRange, setNewSecRange] = useState('');
    const [savingSec, setSavingSec] = useState(false);

    useEffect(() => {
        const unsub = subscribeLayouts(list => { setLayouts(list); setLoading(false); });
        return unsub;
    }, []);

    const visibleLayouts = useMemo(() =>
        isSuperAdmin
            ? layouts
            : layouts.filter(l => (l.sucursalesAsignadas || []).includes(sucursalId || '')),
        [layouts, isSuperAdmin, sucursalId]
    );

    // Auto-select first layout for sucursal
    useEffect(() => {
        if (isSuperAdmin || selectedId || visibleLayouts.length === 0) return;
        const l = visibleLayouts[0];
        setSelectedId(l.id);
        setSelectedSecId(l.secciones[0]?.id || null);
    }, [isSuperAdmin, selectedId, visibleLayouts]);

    // When selected layout changes, validate section
    useEffect(() => {
        if (!selectedId) { setSelectedSecId(null); setSelectedRackNum(null); return; }
        const layout = layouts.find(l => l.id === selectedId);
        if (!layout) return;
        const secExists = layout.secciones.some(s => s.id === selectedSecId);
        if (!secExists) {
            setSelectedSecId(layout.secciones[0]?.id || null);
            setSelectedRackNum(null);
        }
    }, [selectedId, layouts, selectedSecId]);

    const selectedLayout = layouts.find(l => l.id === selectedId) ?? null;
    const selectedSection = selectedLayout?.secciones.find(s => s.id === selectedSecId) ?? null;
    const selectedRack = selectedSection?.racks.find(r => r.numero === selectedRackNum) ?? null;

    // ── Handlers ──────────────────────────────────────────────────────────────

    const openLayout = useCallback((id: string) => {
        setSelectedId(id);
        setSelectedRackNum(null);
        if (isSuperAdmin) setAdminVista('editor');
    }, [isSuperAdmin]);

    const handleCreateLayout = async () => {
        if (!newName.trim()) return;
        setSavingLayout(true);
        const layout: AlmacenLayout = {
            id: crypto.randomUUID(),
            nombre: newName.trim(),
            descripcion: newDesc.trim() || undefined,
            secciones: [],
            sucursalesAsignadas: [],
            creadoEn: Date.now(),
            actualizadoEn: Date.now(),
        };
        await saveLayout(layout);
        setShowNewLayout(false);
        setNewName(''); setNewDesc('');
        openLayout(layout.id);
        setSavingLayout(false);
    };

    const handleDeleteLayout = async (id: string) => {
        if (!confirm('¿Eliminar este layout? No se puede deshacer.')) return;
        await removeLayout(id);
        if (selectedId === id) { setSelectedId(null); setAdminVista('list'); }
    };

    const handleImportPredefinido = async () => {
        if (!confirm('¿Importar el "Layout Calzado Juárez" con las asignaciones del plano? Se creará como un nuevo layout.')) return;
        setSavingLayout(true);
        const layout: AlmacenLayout = {
            ...LAYOUT_PREDEFINIDO,
            id: crypto.randomUUID(),
            sucursalesAsignadas: [],
            creadoEn: Date.now(),
            actualizadoEn: Date.now(),
        };
        await saveLayout(layout);
        openLayout(layout.id);
        setSavingLayout(false);
    };

    const handleAddSection = async () => {
        if (!selectedLayout || !newSecNombre.trim()) return;
        setSavingSec(true);
        const nums = parseRange(newSecRange);
        const section: SeccionAlmacen = {
            id: crypto.randomUUID(),
            nombre: newSecNombre.trim(),
            racks: nums.map(n => ({ numero: n, linea: '' })),
        };
        const updated: AlmacenLayout = {
            ...selectedLayout,
            actualizadoEn: Date.now(),
            secciones: [...selectedLayout.secciones, section],
        };
        await saveLayout(updated);
        setShowNewSec(false);
        setNewSecNombre(''); setNewSecRange('');
        setSelectedSecId(section.id);
        setSelectedRackNum(null);
        setSavingSec(false);
    };

    const handleDeleteSection = async (secId: string) => {
        if (!selectedLayout || !confirm('¿Eliminar esta sección y todos sus racks?')) return;
        const updated: AlmacenLayout = {
            ...selectedLayout,
            actualizadoEn: Date.now(),
            secciones: selectedLayout.secciones.filter(s => s.id !== secId),
        };
        if (selectedSecId === secId) {
            setSelectedSecId(updated.secciones[0]?.id || null);
            setSelectedRackNum(null);
        }
        await saveLayout(updated);
    };

    const handleSaveRack = async (updates: Partial<RackAlmacen>) => {
        if (!selectedLayout || !selectedSection || selectedRackNum == null) return;
        const updated: AlmacenLayout = {
            ...selectedLayout,
            actualizadoEn: Date.now(),
            secciones: selectedLayout.secciones.map(s =>
                s.id !== selectedSection.id ? s : {
                    ...s,
                    racks: s.racks.map(r =>
                        r.numero !== selectedRackNum ? r : { ...r, ...updates }
                    ),
                }
            ),
        };
        await saveLayout(updated);
        setSelectedRackNum(null);
    };

    const handleToggleSucursal = async (layout: AlmacenLayout, sucId: string) => {
        const current = layout.sucursalesAsignadas || [];
        const next = current.includes(sucId)
            ? current.filter(id => id !== sucId)
            : [...current, sucId];
        await saveLayout({ ...layout, sucursalesAsignadas: next, actualizadoEn: Date.now() });
    };

    const handleRackClick = useCallback((secId: string, rackNum: number) => {
        const isSel = selectedSecId === secId && selectedRackNum === rackNum;
        setSelectedSecId(secId);
        setSelectedRackNum(isSel ? null : rackNum);
    }, [selectedSecId, selectedRackNum]);

    // ── Shared: render a single section's rack grid ───────────────────────────

    const renderSeccionRacks = (sec: SeccionAlmacen, compact = false) => {
        if (sec.racks.length === 0) return <p className="text-xs text-slate-400 py-2 text-center">Sin racks</p>;
        const colCount = sec.cols || (compact ? 2 : 4);
        const lines = Array.from(new Set(sec.racks.map(r => r.linea).filter(Boolean)));
        return (
            <>
                {!compact && lines.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
                        {lines.map(linea => {
                            const c = lineColor(linea);
                            return (
                                <div key={linea} className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.tx }} />
                                    <span className="text-[9px] text-slate-500 dark:text-slate-400">{linea}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`, gap: compact ? '3px' : '6px' }}>
                    {sec.racks.map(rack => (
                        <RackCard
                            key={rack.numero}
                            rack={rack}
                            selected={selectedSecId === sec.id && selectedRackNum === rack.numero}
                            onClick={() => handleRackClick(sec.id, rack.numero)}
                        />
                    ))}
                </div>
            </>
        );
    };

    // ── Vista Secciones (tabs) ────────────────────────────────────────────────

    const renderSectionView = (editable: boolean) => {
        if (!selectedLayout) return null;
        return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                {/* Section tabs */}
                <div className="border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
                    <div className="flex min-w-max">
                        {selectedLayout.secciones.map(sec => (
                            <button key={sec.id}
                                onClick={() => { setSelectedSecId(sec.id); setSelectedRackNum(null); }}
                                className={`group px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors flex items-center gap-1.5 ${
                                    selectedSecId === sec.id
                                        ? 'border-violet-500 text-violet-600 dark:text-violet-400'
                                        : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                                }`}>
                                {sec.nombre}
                                <span className="text-[9px] opacity-50">({sec.racks.length})</span>
                                {editable && (
                                    <span role="button"
                                        onClick={e => { e.stopPropagation(); handleDeleteSection(sec.id); }}
                                        className="opacity-0 group-hover:opacity-50 hover:!opacity-100 text-red-400 cursor-pointer leading-none">✕</span>
                                )}
                            </button>
                        ))}
                        {editable && (
                            <button onClick={() => setShowNewSec(true)}
                                className="px-3 py-2.5 text-xs font-bold text-violet-500 hover:text-violet-700 border-b-2 border-transparent hover:border-violet-200 whitespace-nowrap">
                                + Sección
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-4">
                    {!selectedSection ? (
                        <div className="text-center py-10 text-slate-400">
                            <p className="text-sm">{selectedLayout.secciones.length === 0 ? 'Sin secciones.' : 'Selecciona una sección.'}</p>
                        </div>
                    ) : renderSeccionRacks(selectedSection, false)}
                </div>
            </div>
        );
    };

    // ── Vista Plano (todas las secciones en layout espacial) ──────────────────

    const renderFloorPlan = (editable: boolean) => {
        if (!selectedLayout) return null;
        const secciones = selectedLayout.secciones;
        const col1 = secciones.filter(s => s.planCol === 1);
        const col2 = secciones.filter(s => s.planCol === 2);
        const col3 = secciones.filter(s => s.planCol === 3);
        const sinCol = secciones.filter(s => !s.planCol);
        const hasPlan = col1.length > 0 || col2.length > 0 || col3.length > 0;

        const SecCard = ({ sec }: { sec: SeccionAlmacen }) => (
            <div className={`bg-white dark:bg-slate-800 rounded-xl border-2 overflow-hidden transition-all ${
                selectedSecId === sec.id ? 'border-violet-400' : 'border-slate-200 dark:border-slate-700'
            }`}>
                <div className="px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">{sec.nombre}</span>
                    <span className="text-[9px] text-slate-400 flex-shrink-0">{sec.racks.length}</span>
                    {editable && (
                        <span role="button"
                            onClick={() => handleDeleteSection(sec.id)}
                            className="text-[9px] text-red-400 flex-shrink-0 cursor-pointer hover:opacity-100 opacity-40">✕</span>
                    )}
                </div>
                <div className="p-1.5">{renderSeccionRacks(sec, true)}</div>
            </div>
        );

        if (!hasPlan) {
            return (
                <div className="space-y-3">
                    {secciones.map(sec => <SecCard key={sec.id} sec={sec} />)}
                </div>
            );
        }

        return (
            <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 items-start">
                    <div className="space-y-2">{col1.map(sec => <SecCard key={sec.id} sec={sec} />)}</div>
                    <div className="space-y-2">{col2.map(sec => <SecCard key={sec.id} sec={sec} />)}</div>
                    <div className="space-y-2">{col3.map(sec => <SecCard key={sec.id} sec={sec} />)}</div>
                </div>
                {sinCol.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                        {sinCol.map(sec => <SecCard key={sec.id} sec={sec} />)}
                    </div>
                )}
            </div>
        );
    };

    // ── Loading ────────────────────────────────────────────────────────────────

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="text-4xl mb-3">🏭</div>
            <p className="text-sm">Cargando layouts...</p>
        </div>
    );

    // ── SUPERADMIN: Layout list ────────────────────────────────────────────────

    if (isSuperAdmin && adminVista === 'list') return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-slate-800 dark:text-white text-base">Layouts de Almacén</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{layouts.length} layout{layouts.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleImportPredefinido} disabled={savingLayout}
                        className="px-3 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50"
                        title="Importa el Layout Calzado Juárez con todas las secciones y líneas del plano">
                        📥 Importar plano
                    </button>
                    <button onClick={() => setShowNewLayout(true)}
                        className="px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 active:scale-95 transition-all">
                        + Nuevo
                    </button>
                </div>
            </div>

            {layouts.length === 0 && (
                <div className="text-center py-16 text-slate-400">
                    <div className="text-5xl mb-3">🏭</div>
                    <p className="font-medium text-sm">Sin layouts todavía</p>
                    <p className="text-xs mt-1">Crea el primero con el botón de arriba</p>
                </div>
            )}

            <div className="space-y-3">
                {layouts.map(layout => (
                    <div key={layout.id}
                        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 dark:text-white truncate">{layout.nombre}</p>
                                {layout.descripcion && (
                                    <p className="text-xs text-slate-400 mt-0.5 truncate">{layout.descripcion}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                        {layout.secciones.length} secc. · {layout.secciones.reduce((a, s) => a + s.racks.length, 0)} racks
                                    </span>
                                    <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                        {(layout.sucursalesAsignadas || []).length} sucursal{(layout.sucursalesAsignadas || []).length !== 1 ? 'es' : ''} asignada{(layout.sucursalesAsignadas || []).length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5 flex-shrink-0">
                                <button onClick={() => openLayout(layout.id)}
                                    className="px-3 py-1.5 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-bold rounded-lg hover:bg-violet-100 transition-colors">
                                    Editar
                                </button>
                                <button onClick={() => handleDeleteLayout(layout.id)}
                                    className="px-3 py-1.5 text-red-400 text-xs font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {showNewLayout && (
                <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
                        <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4">Nuevo Layout</h3>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre *</label>
                        <input
                            className="w-full border dark:border-slate-600 rounded-xl p-2.5 text-sm mt-1 mb-3 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: Layout Calzado Juárez"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateLayout()}
                            autoFocus
                        />
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Descripción</label>
                        <input
                            className="w-full border dark:border-slate-600 rounded-xl p-2.5 text-sm mt-1 mb-4 dark:bg-slate-700 dark:text-white"
                            placeholder="Opcional"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button onClick={() => { setShowNewLayout(false); setNewName(''); setNewDesc(''); }}
                                className="flex-1 py-2.5 text-sm bg-slate-100 dark:bg-slate-700 dark:text-white text-slate-700 rounded-xl font-medium">
                                Cancelar
                            </button>
                            <button onClick={handleCreateLayout} disabled={savingLayout || !newName.trim()}
                                className="flex-1 py-2.5 text-sm bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50">
                                {savingLayout ? 'Creando...' : 'Crear'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // ── SUPERADMIN: Layout editor ──────────────────────────────────────────────

    if (isSuperAdmin && adminVista === 'editor' && selectedLayout) return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => { setAdminVista('list'); setSelectedId(null); setSelectedRackNum(null); }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium">
                    ← Volver
                </button>
                <h2 className="font-bold text-slate-800 dark:text-white text-base flex-1 truncate">{selectedLayout.nombre}</h2>
            </div>

            {/* Sucursal assignment */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
                    Sucursales que pueden ver este layout
                </p>
                {sucursales.length === 0 ? (
                    <p className="text-xs text-slate-400">No hay sucursales registradas.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {sucursales.map(s => {
                            const assigned = (selectedLayout.sucursalesAsignadas || []).includes(s.id);
                            return (
                                <button key={s.id}
                                    onClick={() => handleToggleSucursal(selectedLayout, s.id)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border-2 transition-all ${
                                        assigned
                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-400 text-emerald-700 dark:text-emerald-400'
                                            : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400'
                                    }`}>
                                    {assigned ? '✓ ' : ''}{s.nombre}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* View toggle + section add */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-bold">
                    <button onClick={() => setVistaPlano(false)}
                        className={`px-3 py-1.5 transition-colors ${!vistaPlano ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        Secciones
                    </button>
                    <button onClick={() => setVistaPlano(true)}
                        className={`px-3 py-1.5 transition-colors ${vistaPlano ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                        🗺 Plano
                    </button>
                </div>
                {vistaPlano && (
                    <button onClick={() => setShowNewSec(true)}
                        className="px-3 py-1.5 text-xs font-bold text-violet-600 border border-violet-200 rounded-xl hover:bg-violet-50">
                        + Sección
                    </button>
                )}
            </div>

            {/* Section tabs + rack grid / floor plan */}
            {vistaPlano ? renderFloorPlan(true) : renderSectionView(true)}

            {/* Rack edit panel */}
            {selectedRack && (
                <RackPanel
                    rack={selectedRack}
                    onSave={handleSaveRack}
                    onCancel={() => setSelectedRackNum(null)}
                />
            )}

            {/* Add section modal */}
            {showNewSec && (
                <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl">
                        <h3 className="font-bold text-slate-800 dark:text-white text-base mb-4">Nueva Sección</h3>
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre *</label>
                        <input
                            className="w-full border dark:border-slate-600 rounded-xl p-2.5 text-sm mt-1 mb-3 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: Planta Baja, Sección Caballero..."
                            value={newSecNombre}
                            onChange={e => setNewSecNombre(e.target.value)}
                            autoFocus
                        />
                        <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Racks (rango o lista)
                        </label>
                        <input
                            className="w-full border dark:border-slate-600 rounded-xl p-2.5 text-sm mt-1 mb-1 dark:bg-slate-700 dark:text-white"
                            placeholder="Ej: 1-15, 20, 25-30"
                            value={newSecRange}
                            onChange={e => setNewSecRange(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-400 mb-4">
                            Rangos: <strong>1-15</strong> · Individuales: <strong>20, 25</strong> · Mezcla: <strong>1-8, 10, 12-15</strong>
                        </p>
                        <div className="flex gap-2">
                            <button onClick={() => { setShowNewSec(false); setNewSecNombre(''); setNewSecRange(''); }}
                                className="flex-1 py-2.5 text-sm bg-slate-100 dark:bg-slate-700 dark:text-white text-slate-700 rounded-xl font-medium">
                                Cancelar
                            </button>
                            <button onClick={handleAddSection} disabled={savingSec || !newSecNombre.trim()}
                                className="flex-1 py-2.5 text-sm bg-violet-600 text-white font-bold rounded-xl hover:bg-violet-700 disabled:opacity-50">
                                {savingSec ? 'Guardando...' : 'Agregar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    // ── SUCURSAL: View ─────────────────────────────────────────────────────────

    if (visibleLayouts.length === 0) return (
        <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">🏭</div>
            <p className="font-medium text-sm">Sin layouts asignados</p>
            <p className="text-xs mt-1 max-w-xs mx-auto">El administrador aún no ha asignado un layout de almacén a esta sucursal.</p>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Layout selector (only shown when multiple assigned) */}
            {visibleLayouts.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {visibleLayouts.map(l => (
                        <button key={l.id}
                            onClick={() => openLayout(l.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap border-2 transition-all flex-shrink-0 ${
                                selectedId === l.id
                                    ? 'bg-violet-600 border-violet-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-300'
                            }`}>
                            {l.nombre}
                        </button>
                    ))}
                </div>
            )}

            {selectedLayout && (
                <>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-bold text-slate-800 dark:text-white text-sm">{selectedLayout.nombre}</p>
                            {selectedLayout.descripcion && (
                                <p className="text-xs text-slate-400 mt-0.5">{selectedLayout.descripcion}</p>
                            )}
                        </div>
                    </div>

                    {/* View toggle */}
                    <div className="flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-bold w-fit">
                        <button onClick={() => setVistaPlano(false)}
                            className={`px-3 py-1.5 transition-colors ${!vistaPlano ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            Secciones
                        </button>
                        <button onClick={() => setVistaPlano(true)}
                            className={`px-3 py-1.5 transition-colors ${vistaPlano ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
                            🗺 Plano
                        </button>
                    </div>

                    {vistaPlano ? renderFloorPlan(false) : renderSectionView(false)}

                    {selectedRack && (
                        <RackPanel
                            rack={selectedRack}
                            onSave={handleSaveRack}
                            onCancel={() => setSelectedRackNum(null)}
                        />
                    )}
                </>
            )}
        </div>
    );
};
