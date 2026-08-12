import { QrCode, Wifi, Users, Lock, PlayCircle, BarChart3, AlertTriangle } from './icons.tsx';

export const InfoTab = () => (
    <div className="space-y-4">
        <div className="bg-sky-600 rounded-xl p-6 text-white text-center">
            <QrCode size={40} className="mx-auto mb-2 opacity-90" />
            <h1 className="text-2xl font-bold">Conteo Cíclico Pro</h1>
            <p className="text-sky-200 text-sm">Versión 4.0 · Multi-Sucursal · Firebase Sync</p>
        </div>
        {[
            { icon: <Wifi size={18} className="text-emerald-500" />, title: 'Sincronización en tiempo real', desc: 'Todos los datos se sincronizan instantáneamente vía Firebase Firestore entre dispositivos.' },
            { icon: <Users size={18} className="text-sky-500" />, title: 'Multi-sucursal', desc: 'Cada sucursal tiene sus propios folios, operadores y datos completamente aislados.' },
            { icon: <Lock size={18} className="text-purple-500" />, title: 'Operadores con PIN', desc: 'Cada operador tiene un PIN cifrado (SHA-256). La sesión expira automáticamente por inactividad.' },
            { icon: <PlayCircle size={18} className="text-amber-500" />, title: 'Sesiones de escaneo', desc: 'Los scanners crean sesiones propias por área. Se registra quién escaneó cada pieza y cuándo.' },
            { icon: <BarChart3 size={18} className="text-purple-500" />, title: 'Reporte en vivo', desc: 'Cobertura, faltantes y sobrantes actualizados al instante. Desglose por SKU, área y operador.' },
            { icon: <AlertTriangle size={18} className="text-amber-500" />, title: 'Modo sin conexión', desc: 'Los escaneos se guardan localmente y se sincronizan automáticamente al recuperar la conexión.' },
        ].map((item, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border dark:border-slate-700 p-4 shadow-sm flex gap-3">
                <div className="flex-shrink-0 mt-0.5">{item.icon}</div>
                <div><p className="font-semibold text-slate-700 dark:text-white text-sm">{item.title}</p><p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</p></div>
            </div>
        ))}
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 pb-2">Conteo Cíclico Pro v4.0 · 2026</p>
    </div>
);
