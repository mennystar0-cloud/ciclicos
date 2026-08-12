import React from 'react';
import { fbDeleteSucursal, fbGetAllFoliosDetallado, fbGetAllSucursalesStats, fbSaveSucursal, fbSubscribeToAllSessions, hashPassword } from './firebase.ts';
import { SettingsPanel } from './SettingsPanel.tsx';
import { AlmacenModule } from './AlmacenModule';
import { useConfirm } from './hooks.tsx';
export const SuperAdminPanel = ({ onLogout }: { onLogout: () => void }) => {
    const [sucursales, setSucursales] = React.useState<any[]>([]);
    const [loading, setLoading]       = React.useState(true);
    const [showForm, setShowForm]     = React.useState(false);
    const [editSuc, setEditSuc]       = React.useState<any>(null);
    const [nombre, setNombre]         = React.useState('');
    const [usuario, setUsuario]       = React.useState('');
    const [password, setPassword]     = React.useState('');
    const [showSettings, setShowSettings] = React.useState(false);
    const [vista, setVista]           = React.useState<'dashboard'|'sucursales'|'reporte'|'almacen'>('dashboard');
    const [viewMode, setViewMode]       = React.useState<'cards'|'list'>('cards');
    const [dashSessions, setDashSessions] = React.useState<Record<string, any[]>>({});
    const [dashNow, setDashNow]         = React.useState(Date.now());
    const [foliosAll, setFoliosAll]   = React.useState<any[]>([]);
    const [loadingRep, setLoadingRep] = React.useState(false);
    const [filtroSuc, setFiltroSuc]   = React.useState('todas');
    const [filtroEstado, setFiltroEstado] = React.useState('todos');
    const [fechaDesde, setFechaDesde] = React.useState('');
    const [fechaHasta, setFechaHasta] = React.useState('');
    const { confirm: askConfirm, modal: confirmModal } = useConfirm();

    const reload = async () => {
        setLoading(true);
        const list = await fbGetAllSucursalesStats();
        setSucursales(list);
        setLoading(false);
    };
    React.useEffect(() => { reload(); }, []);

    const loadReporte = async () => {
        setLoadingRep(true);
        const list = await fbGetAllFoliosDetallado();
        setFoliosAll(list);
        setLoadingRep(false);
    };
    React.useEffect(() => { if (vista === 'reporte') loadReporte(); }, [vista]);

    // Suscribir a sesiones de cada sucursal para el dashboard en tiempo real
    const sucursalIds = sucursales.map((s: any) => s.id).join(',');
    React.useEffect(() => {
        if (sucursales.length === 0) return;
        const unsubs = sucursales.filter((s: any) => s.activa).map((s: any) =>
            fbSubscribeToAllSessions((sessions: any[]) => {
                setDashSessions(prev => ({ ...prev, [s.id]: sessions }));
            }, s.id)
        );
        return () => unsubs.forEach((u: any) => u());
    }, [sucursalIds]);

    // Ticker para refrescar "activo ahora" cada 15s
    React.useEffect(() => {
        const iv = setInterval(() => setDashNow(Date.now()), 15_000);
        return () => clearInterval(iv);
    }, []);

    const foliosFiltrados = React.useMemo(() => {
        return foliosAll.filter(f => {
            if (filtroSuc !== 'todas' && f.sucursalId !== filtroSuc) return false;
            if (filtroEstado !== 'todos' && f.state !== filtroEstado) return false;
            if (fechaDesde) {
                const desde = new Date(fechaDesde).getTime();
                if (f.createdAt < desde) return false;
            }
            if (fechaHasta) {
                const hasta = new Date(fechaHasta).getTime() + 86400000;
                if (f.createdAt > hasta) return false;
            }
            return true;
        });
    }, [foliosAll, filtroSuc, filtroEstado, fechaDesde, fechaHasta]);

    const statsReporte = React.useMemo(() => {
        const total = foliosFiltrados.length;
        const abiertos = foliosFiltrados.filter(f => f.state === 'open').length;
        const cerrados = foliosFiltrados.filter(f => f.state === 'closed').length;
        const porSucursal: Record<string, number> = {};
        foliosFiltrados.forEach(f => {
            porSucursal[f.sucursalNombre] = (porSucursal[f.sucursalNombre] || 0) + 1;
        });
        return { total, abiertos, cerrados, porSucursal };
    }, [foliosFiltrados]);

    const dashStats = React.useMemo(() => {
        const ACTIVE_THRESHOLD = 90_000;
        const activeSucs = sucursales.filter((s: any) => s.activa).length;
        const openInventarios = sucursales.reduce((a: number, s: any) => a + (s.openFolios || 0), 0);
        const totalOps = sucursales.reduce((a: number, s: any) => a + (s.totalOperadores || 0), 0);
        const totalFoliosHistorico = sucursales.reduce((a: number, s: any) => a + (s.totalFolios || 0), 0);
        const branchActivity = sucursales.map((suc: any) => {
            const sessions = dashSessions[suc.id] || [];
            const activeSessions = sessions.filter((s: any) => s.active && (dashNow - (s.lastSeen ?? 0)) < ACTIVE_THRESHOLD);
            return { suc, activeSessions, hasOpenInventory: (suc.openFolios || 0) > 0 };
        });
        const activeOpsNow = branchActivity.reduce((a: number, b: any) => a + b.activeSessions.length, 0);
        return { activeSucs, openInventarios, totalOps, totalFoliosHistorico, activeOpsNow, branchActivity };
    }, [sucursales, dashSessions, dashNow]);

    const openNew  = () => { setEditSuc(null); setNombre(''); setUsuario(''); setPassword(''); setShowForm(true); };
    const openEdit = (s: any) => { setEditSuc(s); setNombre(s.nombre); setUsuario(s.usuario); setPassword(''); setShowForm(true); };

    const handleSave = async () => {
        if (!nombre.trim() || !usuario.trim()) { alert('Nombre y usuario son requeridos'); return; }
        if (!editSuc && !password) { alert('La contrasena es requerida'); return; }
        const hashed = password ? await hashPassword(password) : editSuc?.passwordHash;
        const suc = {
            id: editSuc?.id ?? crypto.randomUUID(),
            nombre: nombre.trim(),
            usuario: usuario.trim().toLowerCase(),
            passwordHash: hashed,
            activa: true,
            creadaAt: editSuc?.creadaAt ?? Date.now(),
        };
        await fbSaveSucursal(suc);
        await reload(); setShowForm(false);
        alert((editSuc ? 'Sucursal actualizada: ' : 'Sucursal creada: ') + nombre.trim());
    };

    const handleToggle = async (s: any) => {
        await fbSaveSucursal({ ...s, activa: !s.activa });
        await reload();
    };

    const handleDelete = async (s: any) => {
        const ok = await askConfirm(`Se eliminarán la sucursal "${s.nombre}" y TODOS sus datos. Esta acción no se puede deshacer.`, '¿Eliminar sucursal?');
        if (!ok) return;
        await fbDeleteSucursal(s.id);
        await reload();
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* Header */}
            <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
                <div>
                    <p className="font-black text-lg">Conteo Ciclico Pro</p>
                    <p className="text-xs text-amber-400 font-bold">⭐ SUPERADMIN</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowSettings(true)} className="p-2 text-slate-400 hover:text-white rounded-lg">⚙️</button>
                    <button onClick={onLogout} className="p-2 text-red-400 hover:text-red-300 rounded-lg text-sm">Salir</button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-800 px-2 overflow-x-auto">
                <button onClick={() => setVista('dashboard')}
                    className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${vista === 'dashboard' ? 'border-violet-400 text-violet-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                    ⚡ Dashboard
                    {dashStats.activeOpsNow > 0 && (
                        <span className="min-w-[18px] h-[18px] bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none animate-pulse">
                            {dashStats.activeOpsNow}
                        </span>
                    )}
                </button>
                <button onClick={() => setVista('sucursales')}
                    className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${vista === 'sucursales' ? 'border-amber-400 text-amber-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                    🏢 Sucursales
                </button>
                <button onClick={() => setVista('reporte')}
                    className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${vista === 'reporte' ? 'border-sky-400 text-sky-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                    📊 Reportes
                </button>
                <button onClick={() => setVista('almacen')}
                    className={`px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${vista === 'almacen' ? 'border-violet-400 text-violet-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                    🏭 Almacén
                </button>
            </div>

            <div className="p-4 space-y-4 max-w-2xl mx-auto pb-10">

            {/* ── VISTA DASHBOARD ── */}
            {vista === 'dashboard' && (
                <div className="space-y-4 pt-1">
                    {/* Metric cards */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                            <p className="text-3xl font-black text-sky-400">{loading ? '…' : dashStats.activeSucs}</p>
                            <p className="text-xs font-semibold text-slate-300 mt-1">Sucursales activas</p>
                            <p className="text-[10px] text-slate-500">{sucursales.length} registradas en total</p>
                        </div>
                        <div className={`rounded-2xl p-4 border transition-all ${dashStats.openInventarios > 0 ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}`}>
                            <p className={`text-3xl font-black ${dashStats.openInventarios > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{loading ? '…' : dashStats.openInventarios}</p>
                            <p className="text-xs font-semibold text-slate-300 mt-1">Inventarios abiertos</p>
                            <p className="text-[10px] text-slate-500">{dashStats.totalFoliosHistorico} folios en total</p>
                        </div>
                        <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                            <p className="text-3xl font-black text-amber-400">{loading ? '…' : dashStats.totalOps}</p>
                            <p className="text-xs font-semibold text-slate-300 mt-1">Operadores registrados</p>
                            <p className="text-[10px] text-slate-500">en todas las sucursales</p>
                        </div>
                        <div className={`rounded-2xl p-4 border transition-all ${dashStats.activeOpsNow > 0 ? 'bg-emerald-900/30 border-emerald-500/40' : 'bg-slate-800 border-slate-700'}`}>
                            <div className="flex items-center gap-2">
                                <p className={`text-3xl font-black ${dashStats.activeOpsNow > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{dashStats.activeOpsNow}</p>
                                {dashStats.activeOpsNow > 0 && <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />}
                            </div>
                            <p className="text-xs font-semibold text-slate-300 mt-1">Operadores activos ahora</p>
                            <p className="text-[10px] text-slate-500">últimos 90 s · actualiza cada 15 s</p>
                        </div>
                    </div>

                    {/* Branch activity list */}
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                            <p className="text-sm font-bold text-white">Estado por sucursal</p>
                            <button onClick={reload} className="text-xs text-slate-400 hover:text-white transition-colors">
                                {loading ? 'Actualizando…' : '↻ Refrescar'}
                            </button>
                        </div>
                        {loading ? (
                            <p className="text-center text-slate-400 py-10 text-sm">Cargando sucursales…</p>
                        ) : sucursales.length === 0 ? (
                            <p className="text-center text-slate-500 py-10 text-sm">Sin sucursales registradas</p>
                        ) : (
                            <div className="divide-y divide-slate-700/50">
                                {[...dashStats.branchActivity]
                                    .sort((a: any, b: any) => {
                                        if (a.suc.activa !== b.suc.activa) return b.suc.activa ? 1 : -1;
                                        const aS = a.activeSessions.length > 0 ? 2 : a.hasOpenInventory ? 1 : 0;
                                        const bS = b.activeSessions.length > 0 ? 2 : b.hasOpenInventory ? 1 : 0;
                                        return bS - aS;
                                    })
                                    .map(({ suc, activeSessions, hasOpenInventory }: any) => {
                                        const isActive = activeSessions.length > 0;
                                        return (
                                            <div key={suc.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${isActive ? 'bg-emerald-900/10' : ''} ${!suc.activa ? 'opacity-40' : ''}`}>
                                                <div className="relative flex-shrink-0">
                                                    <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
                                                        <span className="text-sky-400 font-black">{suc.nombre.slice(0,1).toUpperCase()}</span>
                                                    </div>
                                                    {isActive && (
                                                        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-800 animate-pulse" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-white text-sm truncate">{suc.nombre}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {isActive
                                                            ? `${activeSessions.length} operador${activeSessions.length !== 1 ? 'es' : ''} escaneando ahora`
                                                            : hasOpenInventory
                                                                ? 'Inventario abierto · sin operadores activos'
                                                                : suc.activa ? 'Sin actividad reciente' : 'Desactivada'}
                                                    </p>
                                                </div>
                                                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                                    {isActive ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">● Activa</span>
                                                    ) : hasOpenInventory ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">◐ Abierto</span>
                                                    ) : null}
                                                    <p className="text-[10px] text-slate-500">{suc.openFolios || 0} abiertos · {suc.totalFolios || 0} folios</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        )}
                    </div>

                    {/* Quick nav */}
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => setVista('sucursales')}
                            className="bg-slate-800 hover:bg-slate-700 rounded-2xl p-4 border border-slate-700 text-left transition-colors">
                            <p className="text-xl mb-1">🏢</p>
                            <p className="text-sm font-bold text-white">Sucursales</p>
                            <p className="text-[11px] text-slate-400">Crear · editar · activar</p>
                        </button>
                        <button onClick={() => { loadReporte(); setVista('reporte'); }}
                            className="bg-slate-800 hover:bg-slate-700 rounded-2xl p-4 border border-slate-700 text-left transition-colors">
                            <p className="text-xl mb-1">📊</p>
                            <p className="text-sm font-bold text-white">Reportes</p>
                            <p className="text-[11px] text-slate-400">Inventarios · folios · filtros</p>
                        </button>
                    </div>
                </div>
            )}

            {/* ── VISTA REPORTE ── */}
            {vista === 'reporte' && (
                <div className="space-y-4">
                    {/* Filtros */}
                    <div className="bg-slate-800 rounded-2xl p-4 space-y-3">
                        <p className="text-sm font-bold text-slate-300">Filtros</p>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs text-slate-400">Sucursal</label>
                                <select className="w-full mt-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white"
                                    value={filtroSuc} onChange={e => setFiltroSuc(e.target.value)}>
                                    <option value="todas">Todas</option>
                                    {sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Estado</label>
                                <select className="w-full mt-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white"
                                    value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                                    <option value="todos">Todos</option>
                                    <option value="open">Abiertos</option>
                                    <option value="closed">Cerrados</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Desde</label>
                                <input type="date" className="w-full mt-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white"
                                    value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400">Hasta</label>
                                <input type="date" className="w-full mt-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white"
                                    value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                            </div>
                        </div>
                        <button onClick={() => { setFiltroSuc('todas'); setFiltroEstado('todos'); setFechaDesde(''); setFechaHasta(''); }}
                            className="text-xs text-slate-400 hover:text-white underline">Limpiar filtros</button>
                    </div>

                    {/* KPIs */}
                    {!loadingRep && (
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-slate-800 rounded-2xl p-3 text-center">
                                <p className="text-2xl font-black text-white">{statsReporte.total}</p>
                                <p className="text-xs text-slate-400">Total inventarios</p>
                            </div>
                            <div className="bg-emerald-900/40 border border-emerald-800/50 rounded-2xl p-3 text-center">
                                <p className="text-2xl font-black text-emerald-400">{statsReporte.abiertos}</p>
                                <p className="text-xs text-emerald-500">Abiertos</p>
                            </div>
                            <div className="bg-slate-800 rounded-2xl p-3 text-center">
                                <p className="text-2xl font-black text-slate-300">{statsReporte.cerrados}</p>
                                <p className="text-xs text-slate-400">Cerrados</p>
                            </div>
                        </div>
                    )}

                    {/* Por sucursal */}
                    {!loadingRep && Object.keys(statsReporte.porSucursal).length > 0 && (
                        <div className="bg-slate-800 rounded-2xl p-4 space-y-2">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Por sucursal</p>
                            {Object.entries(statsReporte.porSucursal).map(([nombre, count]) => (
                                <div key={nombre} className="flex items-center gap-3">
                                    <span className="text-sm text-white flex-1">{nombre}</span>
                                    <div className="flex-1 bg-slate-700 rounded-full h-2">
                                        <div className="bg-sky-500 h-2 rounded-full" style={{ width: `${Math.round((count as number / statsReporte.total) * 100)}%` }} />
                                    </div>
                                    <span className="text-sm font-bold text-sky-400 w-6 text-right">{count as number}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Lista de folios */}
                    {loadingRep ? (
                        <div className="text-center py-10 text-slate-400">Cargando inventarios...</div>
                    ) : foliosFiltrados.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">Sin inventarios con los filtros aplicados</div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-xs text-slate-400">{foliosFiltrados.length} inventario(s) encontrado(s)</p>
                            {foliosFiltrados.map((f: any) => (
                                <div key={f.id} className="bg-slate-800 rounded-2xl p-4 border border-slate-700">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm truncate">{f.name}</p>
                                            <p className="text-xs text-sky-400 mt-0.5">{f.sucursalNombre}</p>
                                        </div>
                                        <span className={`text-[10px] px-2 py-1 rounded-full font-bold flex-shrink-0 ${f.state === 'open' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                                            {f.state === 'open' ? 'Abierto' : 'Cerrado'}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                                        <span>📅 {new Date(f.createdAt).toLocaleDateString('es-MX')}</span>
                                        {f.closedAt && <span>🔒 {new Date(f.closedAt).toLocaleDateString('es-MX')}</span>}
                                        <span>🏪 {f.almacen}</span>
                                        {f.temporada && <span>🗓 {f.temporada}</span>}
                                    </div>
                                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                                        <span>Teórico: <strong className="text-white">{Object.values(f.theoreticalMap || {}).reduce((a: any, b: any) => a + b, 0)}</strong></span>
                                        <span>Físico: <strong className="text-emerald-400">{Object.values(f.existenciasMap || {}).reduce((a: any, b: any) => a + b, 0)}</strong></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── VISTA SUCURSALES ── */}
            {vista === 'sucursales' && (
            <div className="space-y-4">
                <div className="flex items-center justify-between pt-2">
                    <div>
                        <h2 className="text-lg font-bold">Sucursales</h2>
                        <p className="text-xs text-slate-400">{sucursales.filter(s => s.activa).length} activas</p>
                    </div>
                    <button onClick={openNew} className="bg-sky-500 hover:bg-sky-400 text-white px-4 py-2 rounded-xl font-bold text-sm">+ Nueva</button>
                </div>

                {showForm && (
                    <div className="bg-slate-800 rounded-2xl p-4 space-y-3 border border-slate-700">
                        <p className="font-bold text-sm">{editSuc ? 'Editar' : 'Nueva'} sucursal</p>
                        <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400" placeholder="Nombre (ej: Juarez)" value={nombre} onChange={e => setNombre(e.target.value)} />
                        <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400" placeholder="Usuario (ej: admin_juarez)" value={usuario} onChange={e => setUsuario(e.target.value.replace(/\s/g,'').toLowerCase())} />
                        <input className="w-full bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-400" type="password" placeholder={editSuc ? 'Contrasena nueva (vacio = no cambiar)' : 'Contrasena'} value={password} onChange={e => setPassword(e.target.value)} />
                        <div className="flex gap-2">
                            <button onClick={handleSave} className="flex-1 bg-sky-500 text-white rounded-xl py-2 text-sm font-bold">Guardar</button>
                            <button onClick={() => setShowForm(false)} className="flex-1 bg-slate-600 text-white rounded-xl py-2 text-sm">Cancelar</button>
                        </div>
                    </div>
                )}

                {/* Toggle vista */}
                {!loading && sucursales.length > 0 && (
                    <div className="flex justify-end mb-3">
                        <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                            <button onClick={() => setViewMode('cards')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'cards' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}>⊞ Tarjetas</button>
                            <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}>☰ Lista</button>
                        </div>
                    </div>
                )}
                {loading ? <p className="text-center text-slate-400 py-10">Cargando sucursales...</p> : (
                    <div className={viewMode === 'list' ? 'rounded-2xl border border-slate-700 overflow-hidden' : 'space-y-3'}>
                        {sucursales.length === 0 && (
                            <div className="text-center py-10 text-slate-500">
                                <p className="text-4xl mb-2">🏢</p>
                                <p>Sin sucursales. Crea la primera.</p>
                            </div>
                        )}
                        {viewMode === 'list' && (
                            <div className="grid grid-cols-5 bg-slate-700/50 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-700">
                                <span className="col-span-2">Sucursal</span>
                                <span className="text-center">Folios</span>
                                <span className="text-center">Abiertos</span>
                                <span className="text-right">Acciones</span>
                            </div>
                        )}
                        {sucursales.map((s, idx) => viewMode === 'cards' ? (
                            <div key={s.id} className={`bg-slate-800 rounded-2xl p-4 border border-slate-700${!s.activa ? ' opacity-50' : ''}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                                            <span className="text-sky-400 font-black text-lg">{s.nombre.slice(0,1).toUpperCase()}</span>
                                        </div>
                                        <div>
                                            <p className="font-bold text-white">{s.nombre}</p>
                                            <p className="text-xs text-slate-400">@{s.usuario}</p>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${s.activa ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{s.activa ? 'Activa' : 'Inactiva'}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 flex-shrink-0">
                                        <button onClick={() => openEdit(s)} className="p-2 text-slate-400 hover:text-sky-400 rounded-lg">✏️</button>
                                        <button onClick={() => handleToggle(s)} className="p-2 text-slate-400 hover:text-amber-400 rounded-lg">{s.activa ? '🚫' : '✅'}</button>
                                        <button onClick={() => handleDelete(s)} className="p-2 text-slate-400 hover:text-red-400 rounded-lg">🗑️</button>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                    <div className="bg-slate-700/50 rounded-xl p-2 text-center">
                                        <p className="text-sm font-bold text-white">{s.totalFolios ?? 0}</p>
                                        <p className="text-[10px] text-slate-400">Folios</p>
                                    </div>
                                    <div className="bg-slate-700/50 rounded-xl p-2 text-center">
                                        <p className="text-sm font-bold text-emerald-400">{s.openFolios ?? 0}</p>
                                        <p className="text-[10px] text-slate-400">Abiertos</p>
                                    </div>
                                    <div className="bg-slate-700/50 rounded-xl p-2 text-center">
                                        <p className="text-sm font-bold text-sky-400">{s.totalOperadores ?? 0}</p>
                                        <p className="text-[10px] text-slate-400">Operadores</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div key={s.id} className={`grid grid-cols-5 items-center px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors${!s.activa ? ' opacity-50' : ''}${idx === sucursales.length-1 ? ' border-b-0' : ''}`}>
                                <div className="col-span-2 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                                        <span className="text-sky-400 font-black text-sm">{s.nombre.slice(0,1).toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white text-sm">{s.nombre}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-[10px] text-slate-400">@{s.usuario}</p>
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${s.activa ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{s.activa ? 'Activa' : 'Inactiva'}</span>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-center font-bold text-white text-sm">{s.totalFolios ?? 0}</p>
                                <p className="text-center font-bold text-emerald-400 text-sm">{s.openFolios ?? 0}</p>
                                <div className="flex gap-1 justify-end">
                                    <button onClick={() => openEdit(s)} className="p-1.5 text-slate-400 hover:text-sky-400 rounded-lg">✏️</button>
                                    <button onClick={() => handleToggle(s)} className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg">{s.activa ? '🚫' : '✅'}</button>
                                    <button onClick={() => handleDelete(s)} className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg">🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            )}

            {/* ── VISTA ALMACÉN ── */}
            {vista === 'almacen' && (
                <AlmacenModule
                    isSuperAdmin={true}
                    sucursales={sucursales.map((s: any) => ({ id: s.id, nombre: s.nombre }))}
                />
            )}

            {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
            {confirmModal}
            </div>
        </div>
    );
};

