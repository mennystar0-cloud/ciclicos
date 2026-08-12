import React from 'react';
import { fbLoginSucursal, fbGetSucursales, fbGetOperadores, loginSuperAdmin, hashPassword, fbSaveOperador, fbLoginOperador } from './firebase.ts';
import { PinKeyboard } from './OperatorsPanel.tsx';
import { loadUIPrefs, applyTheme } from './uiUtils.ts';
import { type AppSession, saveSession } from './session.ts';

export const LoginScreen = ({ onLogin }: { onLogin: (session: AppSession) => void }) => {
    const [mode, setMode]         = React.useState<'main'|'pin'|'admin'|'super'|'elegir'|'operador'>('main');
    const [usuario, setUsuario]   = React.useState('');
    const [password, setPassword] = React.useState('');
    const [loading, setLoading]   = React.useState(false);
    const [error, setError]       = React.useState('');
    const [sucursal, setSucursal] = React.useState<any>(null);
    const [sucursales, setSucursales] = React.useState<any[]>([]);
    const [operadores, setOperadores] = React.useState<any[]>([]);
    const [opSeleccionado, setOpSeleccionado] = React.useState<any>(null);

    React.useEffect(() => {
        const saved = localStorage.getItem('conteo:sucursal');
        if (saved) { try { setSucursal(JSON.parse(saved)); } catch {} }
        const p = loadUIPrefs(); applyTheme(p.dark, p.font);
    }, []);

    const loadSucursales = async () => {
        const list = await fbGetSucursales();
        setSucursales(list.filter((s: any) => s.activa));
    };

    const loadOperadoresSucursal = async (sucursalId: string) => {
        setLoading(true);
        const list = await fbGetOperadores(sucursalId);
        setOperadores(list.filter((o: any) => o.activo));
        setLoading(false);
    };

    const handleAdminLogin = async () => {
        setLoading(true); setError('');
        const suc = await fbLoginSucursal(usuario.trim().toLowerCase(), password);
        setLoading(false);
        if (!suc) { setError('Usuario o contrasena incorrectos'); return; }
        localStorage.setItem('conteo:sucursal', JSON.stringify(suc));
        setSucursal(suc);
        const session: AppSession = { tipo: 'admin', nombre: suc.nombre, sucursalId: suc.id, sucursalNombre: suc.nombre, loginAt: Date.now(), timeoutMs: 99*60*60*1000 };
        saveSession(session);
        onLogin(session);
    };

    const handleSuperLogin = async () => {
        setLoading(true); setError('');
        const ok = await loginSuperAdmin(usuario.trim().toLowerCase(), password);
        setLoading(false);
        if (!ok) { setError('Credenciales incorrectas'); return; }
        const session: AppSession = { tipo: 'superadmin', nombre: 'SuperAdmin', loginAt: Date.now(), timeoutMs: 99*60*60*1000 };
        saveSession(session);
        onLogin(session);
    };

    const handlePin = async (pin: string) => {
        if (!sucursal) return;
        setLoading(true); setError('');
        let op;
        if (opSeleccionado) {
            const hashed = await hashPassword(pin);
            if (hashed !== opSeleccionado.pin) {
                setLoading(false);
                setError('PIN incorrecto para ' + opSeleccionado.nombre);
                return;
            }
            op = opSeleccionado;
            await fbSaveOperador(sucursal.id, { ...op, ultimoLogin: Date.now() });
        } else {
            op = await fbLoginOperador(sucursal.id, pin);
        }
        setLoading(false);
        if (!op) { setError('PIN incorrecto o usuario inactivo'); return; }
        const timeoutMs = 8*60*60*1000;
        const session: AppSession = { tipo: 'operador', nombre: op.nombre, sucursalId: sucursal.id, sucursalNombre: sucursal.nombre, operadorId: op.id, operadorRol: op.rol, loginAt: Date.now(), timeoutMs };
        saveSession(session);
        onLogin(session);
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-sky-900 p-5">
            <div className="mb-8 text-center">
                <div className="text-5xl mb-3">📦</div>
                <h1 className="text-2xl font-black text-white tracking-tight">Conteo Ciclico Pro</h1>
                {sucursal && <p className="text-sky-300 text-sm mt-1 font-medium">📍 {sucursal.nombre}</p>}
                {!sucursal && <p className="text-slate-400 text-sm mt-1">v4.0 · Multi-Sucursal</p>}
            </div>

            <div className="w-full max-w-sm bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl">

                {mode === 'main' && sucursal && (
                    <div className="space-y-3">
                        <button onClick={async () => { await loadOperadoresSucursal(sucursal.id); setOpSeleccionado(null); setMode('operador'); setError(''); }}
                            className="w-full bg-sky-500 hover:bg-sky-400 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 active:scale-95 shadow-lg">
                            📷 Escaner
                        </button>
                        <div className="pt-2 border-t border-white/10 space-y-2">
                            <button onClick={() => { setMode('admin'); setError(''); setUsuario(''); setPassword(''); }}
                                className="w-full bg-white/10 hover:bg-white/20 text-white/80 py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
                                🔑 Admin de sucursal
                            </button>
                            <button onClick={() => { localStorage.removeItem('conteo:sucursal'); setSucursal(null); }}
                                className="w-full text-white/30 hover:text-white/60 py-1.5 text-xs text-center">
                                Cambiar sucursal
                            </button>
                        </div>
                    </div>
                )}

                {mode === 'operador' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <button onClick={() => { setMode('main'); setError(''); setOpSeleccionado(null); }} className="text-white/60 hover:text-white text-xl">←</button>
                            <div>
                                <p className="text-white font-bold">¿Quién eres?</p>
                                <p className="text-white/50 text-xs">{sucursal?.nombre} · Selecciona tu nombre</p>
                            </div>
                        </div>

                        {loading && (
                            <div className="text-center py-6">
                                <p className="text-white/50 text-sm">Cargando operadores...</p>
                            </div>
                        )}

                        {!loading && operadores.length === 0 && (
                            <div className="text-center py-6 space-y-3">
                                <div className="text-4xl">👤</div>
                                <p className="text-white/60 text-sm font-medium">Sin operadores registrados</p>
                                <p className="text-white/30 text-xs">El admin debe crear operadores primero desde el panel 👥</p>
                                <button onClick={() => { setOpSeleccionado(null); setMode('pin'); setError(''); }}
                                    className="w-full bg-white/10 hover:bg-white/20 text-white/70 py-3 rounded-xl text-sm font-medium mt-2">
                                    Entrar sin identificarme
                                </button>
                            </div>
                        )}

                        {!loading && operadores.length > 0 && (
                            <>
                                <div className="space-y-2 max-h-72 overflow-y-auto">
                                    {operadores.map((op: any) => (
                                        <button key={op.id}
                                            onClick={() => { setOpSeleccionado(op); setMode('pin'); setError(''); }}
                                            className="w-full bg-white/15 hover:bg-white/25 text-white py-3 rounded-2xl flex items-center gap-3 px-4 active:scale-95 transition-all">
                                            <div className="w-10 h-10 rounded-full bg-sky-500/30 flex items-center justify-center flex-shrink-0">
                                                <span className="text-sky-200 font-bold text-sm">{op.nombre.slice(0,2).toUpperCase()}</span>
                                            </div>
                                            <div className="text-left flex-1">
                                                <p className="font-bold text-sm">{op.nombre}</p>
                                                <p className="text-white/40 text-xs">Escaner</p>
                                            </div>
                                            <span className="text-white/40 text-xl">→</span>
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => { setOpSeleccionado(null); setMode('pin'); setError(''); }}
                                    className="w-full bg-white/10 hover:bg-white/20 text-white/60 py-2.5 rounded-xl text-xs text-center border border-white/10">
                                    Entrar sin identificarme
                                </button>
                            </>
                        )}
                    </div>
                )}

                {mode === 'main' && !sucursal && (
                    <div className="space-y-3">
                        <button onClick={async () => { await loadSucursales(); setMode('elegir'); setError(''); }}
                            className="w-full bg-sky-500 hover:bg-sky-400 text-white py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 active:scale-95">
                            📷 Escaner
                        </button>
                        <button onClick={() => { setMode('admin'); setError(''); }}
                            className="w-full bg-white/15 hover:bg-white/25 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 active:scale-95">
                            🔑 Admin de Sucursal
                        </button>
                        <button onClick={() => { setMode('super'); setError(''); }}
                            className="w-full bg-white/10 hover:bg-white/20 text-white/70 py-2.5 rounded-2xl text-sm flex items-center justify-center gap-2">
                            ⭐ SuperAdmin
                        </button>
                    </div>
                )}

                {mode === 'elegir' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <button onClick={() => { setMode('main'); setError(''); }} className="text-white/60 hover:text-white text-xl">←</button>
                            <div>
                                <p className="text-white font-bold">Selecciona tu sucursal</p>
                                <p className="text-white/50 text-xs">Luego ingresa tu PIN</p>
                            </div>
                        </div>
                        {sucursales.length === 0 && (
                            <p className="text-center text-white/50 text-sm py-4">No hay sucursales disponibles</p>
                        )}
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {sucursales.map((s: any) => (
                                <button key={s.id}
                                    onClick={async () => {
                                        localStorage.setItem('conteo:sucursal', JSON.stringify(s));
                                        setSucursal(s);
                                        await loadOperadoresSucursal(s.id);
                                        setOpSeleccionado(null);
                                        setMode('operador');
                                        setError('');
                                    }}
                                    className="w-full bg-white/15 hover:bg-white/25 text-white py-4 rounded-2xl flex items-center gap-3 px-4 active:scale-95 transition-all">
                                    <div className="w-10 h-10 rounded-xl bg-sky-500/30 flex items-center justify-center flex-shrink-0">
                                        <span className="text-sky-300 font-black text-lg">{s.nombre.slice(0,1).toUpperCase()}</span>
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold">{s.nombre}</p>
                                        <p className="text-white/50 text-xs">Toca para seleccionar</p>
                                    </div>
                                    <span className="ml-auto text-white/40">→</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {mode === 'pin' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <button onClick={() => { setMode(sucursal ? 'operador' : 'main'); setError(''); setOpSeleccionado(null); }} className="text-white/60 hover:text-white text-xl">←</button>
                            <div>
                                {opSeleccionado ? (
                                    <>
                                        <p className="text-white font-bold">{opSeleccionado.nombre}</p>
                                        <p className="text-white/50 text-xs">Ingresa tu PIN de acceso</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-white font-bold">Ingresa tu PIN</p>
                                        <p className="text-white/50 text-xs">4 a 8 digitos numericos</p>
                                    </>
                                )}
                            </div>
                        </div>
                        {opSeleccionado && (
                            <div className="flex items-center justify-center gap-3 py-2">
                                <div className="w-14 h-14 rounded-full bg-sky-500/30 flex items-center justify-center">
                                    <span className="text-sky-200 font-bold text-xl">{opSeleccionado.nombre.slice(0,2).toUpperCase()}</span>
                                </div>
                            </div>
                        )}
                        <PinKeyboard onSubmit={handlePin} loading={loading} error={error} />
                    </div>
                )}

                {mode === 'admin' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <button onClick={() => { setMode('main'); setError(''); }} className="text-white/60 hover:text-white text-xl">←</button>
                            <div>
                                <p className="text-white font-bold">Admin de Sucursal</p>
                                <p className="text-white/50 text-xs">Ingresa tus credenciales</p>
                            </div>
                        </div>
                        <input className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:border-sky-400"
                            placeholder="Usuario" value={usuario} onChange={e => setUsuario(e.target.value)} autoFocus />
                        <input type="password" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:border-sky-400"
                            placeholder="Contrasena" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key==='Enter') handleAdminLogin(); }} />
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        <button onClick={handleAdminLogin} disabled={loading || !usuario || !password}
                            className="w-full bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-white py-3 rounded-xl font-bold active:scale-95">
                            {loading ? 'Verificando...' : 'Entrar'}
                        </button>
                    </div>
                )}

                {mode === 'super' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <button onClick={() => { setMode('main'); setError(''); }} className="text-white/60 hover:text-white text-xl">←</button>
                            <div>
                                <p className="text-white font-bold">⭐ SuperAdmin</p>
                                <p className="text-white/50 text-xs">Acceso total al sistema</p>
                            </div>
                        </div>
                        <input className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:border-amber-400"
                            placeholder="Usuario" value={usuario} onChange={e => setUsuario(e.target.value)} autoFocus />
                        <input type="password" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:border-amber-400"
                            placeholder="Contrasena" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => { if (e.key==='Enter') handleSuperLogin(); }} />
                        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                        <button onClick={handleSuperLogin} disabled={loading || !usuario || !password}
                            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white py-3 rounded-xl font-bold active:scale-95">
                            {loading ? 'Verificando...' : 'Entrar como SuperAdmin'}
                        </button>
                    </div>
                )}
            </div>
            <p className="mt-6 text-white/20 text-xs">Conteo Ciclico Pro v4.0 · Multi-Sucursal</p>
        </div>
    );
};
