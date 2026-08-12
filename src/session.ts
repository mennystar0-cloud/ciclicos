export interface AppSession {
    tipo: 'superadmin' | 'admin' | 'operador';
    nombre: string;
    sucursalId?: string;
    sucursalNombre?: string;
    operadorId?: string;
    operadorRol?: 'scanner';
    loginAt: number;
    timeoutMs: number;
}

const SES_KEY = 'conteo:session_v4';

export const saveSession = (s: AppSession) =>
    sessionStorage.setItem(SES_KEY, JSON.stringify(s));

export const loadSession = (): AppSession | null => {
    try {
        const r = sessionStorage.getItem(SES_KEY);
        if (!r) return null;
        const s = JSON.parse(r) as AppSession;
        if (Date.now() - s.loginAt > s.timeoutMs) { sessionStorage.removeItem(SES_KEY); return null; }
        return s;
    } catch { return null; }
};

export const clearSession = () => sessionStorage.removeItem(SES_KEY);
