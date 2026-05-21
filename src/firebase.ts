import { initializeApp } from 'firebase/app';
import {
    getFirestore, collection, doc, setDoc, getDoc, getDocs,
    onSnapshot, deleteDoc, query, where, writeBatch,
    updateDoc, increment, serverTimestamp
} from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDWo7-4YPq1pDl4cWsxqht9HeTarp6RkIM",
    authDomain: "ciclicos-bc996.firebaseapp.com",
    projectId: "ciclicos-bc996",
    storageBucket: "ciclicos-bc996.firebasestorage.app",
    messagingSenderId: "253371789405",
    appId: "1:253371789405:web:0c70e98fa9cfd6e7c49db4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// ─── HASH ─────────────────────────────────────────────────────────────────────
export const hashPassword = async (pass: string): Promise<string> => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
};

// ─── SUPERADMIN ───────────────────────────────────────────────────────────────
// Hash de "super123"
const SUPER_HASH = '4e4c56e4a15f89f05c2f4c72613da2a18c9665d4f0d6acce16415eb06f9be776';

export const loginSuperAdmin = async (usuario: string, password: string): Promise<boolean> => {
    if (usuario !== 'super') return false;
    const hashed = await hashPassword(password);
    return hashed === SUPER_HASH;
};

// ─── SUCURSALES ───────────────────────────────────────────────────────────────
export interface Sucursal {
    id: string;
    nombre: string;
    usuario: string;
    passwordHash: string;
    activa: boolean;
    creadaAt: number;
}

export const fbGetSucursales = async (): Promise<Sucursal[]> => {
    const snap = await getDocs(collection(db, 'sucursales'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Sucursal));
};

export const fbSaveSucursal = async (s: Sucursal) => {
    await setDoc(doc(db, 'sucursales', s.id), s);
};

export const fbDeleteSucursal = async (id: string) => {
    // Elimina la sucursal y todos sus datos
    const batch = writeBatch(db);
    batch.delete(doc(db, 'sucursales', id));
    // Eliminar folios de la sucursal
    const foliosSnap = await getDocs(collection(db, 'sucursales', id, 'folios'));
    foliosSnap.docs.forEach(d => batch.delete(d.ref));
    // Eliminar operadores
    const opsSnap = await getDocs(collection(db, 'sucursales', id, 'operadores'));
    opsSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
};

export const fbLoginSucursal = async (usuario: string, password: string): Promise<Sucursal | null> => {
    const hashed = await hashPassword(password);
    const sucursales = await fbGetSucursales();
    return sucursales.find(s => s.usuario === usuario && s.passwordHash === hashed && s.activa) ?? null;
};

// ─── OPERADORES POR SUCURSAL ──────────────────────────────────────────────────
export interface OperadorFS {
    id: string;
    nombre: string;
    pin: string; // SHA-256
    rol: 'scanner' | 'supervisor';
    activo: boolean;
    sucursalId: string;
    creadoAt: number;
    ultimoLogin?: number;
}

export const fbGetOperadores = async (sucursalId: string): Promise<OperadorFS[]> => {
    const snap = await getDocs(collection(db, 'sucursales', sucursalId, 'operadores'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as OperadorFS));
};

export const fbSaveOperador = async (sucursalId: string, op: OperadorFS) => {
    await setDoc(doc(db, 'sucursales', sucursalId, 'operadores', op.id), op);
};

export const fbDeleteOperador = async (sucursalId: string, opId: string) => {
    await deleteDoc(doc(db, 'sucursales', sucursalId, 'operadores', opId));
};

export const fbLoginOperador = async (sucursalId: string, pin: string): Promise<OperadorFS | null> => {
    const hashed = await hashPassword(pin);
    const ops = await fbGetOperadores(sucursalId);
    const op = ops.find(o => o.pin === hashed && o.activo);
    if (op) {
        // Actualizar ultimo login
        await updateDoc(doc(db, 'sucursales', sucursalId, 'operadores', op.id), { ultimoLogin: Date.now() });
    }
    return op ?? null;
};

// ─── FOLIOS (con sucursalId) ───────────────────────────────────────────────────
export const fbCreateFolio = async (folio: any) => {
    const path = folio.sucursalId
        ? doc(db, 'sucursales', folio.sucursalId, 'folios', folio.id)
        : doc(db, 'folios', folio.id);
    await setDoc(path, { ...folio, updatedAt: serverTimestamp() });
};

export const fbGetAllFolios = async (sucursalId?: string) => {
    const col = sucursalId
        ? collection(db, 'sucursales', sucursalId, 'folios')
        : collection(db, 'folios');
    const snap = await getDocs(col);
    return snap.docs.map(d => d.data());
};

export const fbGetLastOpenFolio = async (sucursalId?: string) => {
    const folios = await fbGetAllFolios(sucursalId);
    const open = folios.filter((f: any) => f.state === 'open');
    return open.sort((a: any, b: any) => b.createdAt - a.createdAt)[0];
};

export const fbSubscribeToFolio = (id: string, callback: (f: any) => void, sucursalId?: string) => {
    const path = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'folios', id)
        : doc(db, 'folios', id);
    return onSnapshot(path, snap => {
        if (snap.exists()) callback(snap.data());
        else callback(null);
    });
};

export const fbUpdateFolio = async (folio: any) => {
    const path = folio.sucursalId
        ? doc(db, 'sucursales', folio.sucursalId, 'folios', folio.id)
        : doc(db, 'folios', folio.id);
    await setDoc(path, { ...folio, updatedAt: serverTimestamp() });
};

export const fbDeleteFolio = async (folioId: string, sucursalId?: string) => {
    const folioPath = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'folios', folioId)
        : doc(db, 'folios', folioId);
    await deleteDoc(folioPath);
    const scansCol = sucursalId
        ? collection(db, 'sucursales', sucursalId, 'scans')
        : collection(db, 'scans');
    const q = query(scansCol, where('folioId', '==', folioId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
};

// ─── SCANS (con sucursalId) ───────────────────────────────────────────────────
export const fbAddScan = async (scan: any) => {
    const scansCol = scan.sucursalId
        ? collection(db, 'sucursales', scan.sucursalId, 'scans')
        : collection(db, 'scans');
    const folioPath = scan.sucursalId
        ? doc(db, 'sucursales', scan.sucursalId, 'folios', scan.folioId)
        : doc(db, 'folios', scan.folioId);

    await Promise.all([
        setDoc(doc(scansCol, scan.id), { ...scan, createdAt: serverTimestamp() }),
        updateDoc(folioPath, {
            [`existenciasMap.${scan.vkey}`]: increment(1),
            [`areaCounters.${scan.area}`]: increment(1),
            updatedAt: serverTimestamp(),
        }),
    ]);
    return scan;
};

export const fbDeleteScan = async (scanId: string, folioId: string, vkey: string, area?: string, sucursalId?: string) => {
    const scansCol = sucursalId
        ? collection(db, 'sucursales', sucursalId, 'scans')
        : collection(db, 'scans');
    const folioPath = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'folios', folioId)
        : doc(db, 'folios', folioId);

    await Promise.all([
        deleteDoc(doc(scansCol, scanId)),
        updateDoc(folioPath, {
            [`existenciasMap.${vkey}`]: increment(-1),
            ...(area ? { [`areaCounters.${area}`]: increment(-1) } : {}),
            updatedAt: serverTimestamp(),
        }),
    ]);
};

export const fbGetScans = async (folioId: string, sucursalId?: string) => {
    const scansCol = sucursalId
        ? collection(db, 'sucursales', sucursalId, 'scans')
        : collection(db, 'scans');
    const q = query(scansCol, where('folioId', '==', folioId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data()).sort((a: any, b: any) => b.ts - a.ts);
};

export const fbSubscribeToScans = (folioId: string, callback: (scans: any[]) => void, sucursalId?: string) => {
    const scansCol = sucursalId
        ? collection(db, 'sucursales', sucursalId, 'scans')
        : collection(db, 'scans');
    const q = query(scansCol, where('folioId', '==', folioId));
    return onSnapshot(q, snap => {
        callback(snap.docs.map(d => d.data()).sort((a: any, b: any) => b.ts - a.ts));
    });
};

// ─── SCAN SESSIONS ────────────────────────────────────────────────────────────
export const fbCreateScanSession = async (session: any) => {
    const col = session.sucursalId
        ? collection(db, 'sucursales', session.sucursalId, 'scanSessions')
        : collection(db, 'scanSessions');
    await setDoc(doc(col, session.id), { ...session, createdAt: serverTimestamp() });
};

export const fbAddSessionScan = async (sessionId: string, scan: any, sucursalId?: string) => {
    const sessionRef = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'scanSessions', sessionId)
        : doc(db, 'scanSessions', sessionId);
    const scanRef = doc(collection(sessionRef, 'items'), scan.id);
    await Promise.all([
        setDoc(scanRef, { ...scan, createdAt: serverTimestamp() }),
        updateDoc(sessionRef, { count: increment(1), updatedAt: serverTimestamp() }),
    ]);
};

export const fbSubscribeToSession = (sessionId: string, callback: (s: any) => void, sucursalId?: string) => {
    const ref = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'scanSessions', sessionId)
        : doc(db, 'scanSessions', sessionId);
    return onSnapshot(ref, snap => { if (snap.exists()) callback(snap.data()); else callback(null); });
};

export const fbSubscribeToSessionItems = (sessionId: string, callback: (items: any[]) => void, sucursalId?: string) => {
    const sessionRef = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'scanSessions', sessionId)
        : doc(db, 'scanSessions', sessionId);
    return onSnapshot(collection(sessionRef, 'items'), snap => {
        callback(snap.docs.map(d => d.data()).sort((a: any, b: any) => b.ts - a.ts));
    });
};

export const fbGetAllSessions = async (sucursalId?: string) => {
    const col = sucursalId
        ? collection(db, 'sucursales', sucursalId, 'scanSessions')
        : collection(db, 'scanSessions');
    const snap = await getDocs(col);
    return snap.docs.map(d => d.data());
};

export const fbSubscribeToAllSessions = (callback: (sessions: any[]) => void, sucursalId?: string) => {
    const col = sucursalId
        ? collection(db, 'sucursales', sucursalId, 'scanSessions')
        : collection(db, 'scanSessions');
    return onSnapshot(col, snap => {
        callback(snap.docs.map(d => d.data()).sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds));
    });
};

export const fbDeleteSession = async (sessionId: string, sucursalId?: string) => {
    const sessionRef = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'scanSessions', sessionId)
        : doc(db, 'scanSessions', sessionId);
    const itemsSnap = await getDocs(collection(sessionRef, 'items'));
    const batch = writeBatch(db);
    itemsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(sessionRef);
    await batch.commit();
};

export const fbGetSessionItems = async (sessionId: string, sucursalId?: string) => {
    const sessionRef = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'scanSessions', sessionId)
        : doc(db, 'scanSessions', sessionId);
    const snap = await getDocs(collection(sessionRef, 'items'));
    return snap.docs.map(d => d.data()).sort((a: any, b: any) => b.ts - a.ts);
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
export const fbSaveSettings = async (key: string, value: any, sucursalId?: string) => {
    const ref = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'settings', key)
        : doc(db, 'settings', key);
    await setDoc(ref, { value, updatedAt: serverTimestamp() });
};

export const fbLoadSettings = async (key: string, sucursalId?: string) => {
    const ref = sucursalId
        ? doc(db, 'sucursales', sucursalId, 'settings', key)
        : doc(db, 'settings', key);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data().value : null;
};

// ─── BACKUP ───────────────────────────────────────────────────────────────────
export const fbGetFullDump = async (sucursalId?: string) => {
    const foliosCol = sucursalId ? collection(db, 'sucursales', sucursalId, 'folios') : collection(db, 'folios');
    const scansCol  = sucursalId ? collection(db, 'sucursales', sucursalId, 'scans')  : collection(db, 'scans');
    const [folios, scans] = await Promise.all([getDocs(foliosCol), getDocs(scansCol)]);
    return {
        timestamp: Date.now(),
        sucursalId,
        folios: folios.docs.map(d => d.data()),
        scans:  scans.docs.map(d => d.data()),
    };
};

export const fbRestoreFullDump = async (dump: any, sucursalId?: string) => {
    const batch = writeBatch(db);
    const sid = sucursalId ?? dump.sucursalId;
    dump.folios?.forEach((f: any) => {
        const ref = sid ? doc(db, 'sucursales', sid, 'folios', f.id) : doc(db, 'folios', f.id);
        batch.set(ref, f);
    });
    dump.scans?.forEach((s: any) => {
        const ref = sid ? doc(db, 'sucursales', sid, 'scans', s.id) : doc(db, 'scans', s.id);
        batch.set(ref, s);
    });
    await batch.commit();
};

// ─── SUPERADMIN: stats de todas las sucursales ────────────────────────────────
export const fbGetAllSucursalesStats = async () => {
    const sucursales = await fbGetSucursales();
    const stats = await Promise.all(sucursales.map(async s => {
        const [folios, ops] = await Promise.all([
            getDocs(collection(db, 'sucursales', s.id, 'folios')),
            getDocs(collection(db, 'sucursales', s.id, 'operadores')),
        ]);
        const openFolios = folios.docs.filter(d => d.data().state === 'open').length;
        return { ...s, totalFolios: folios.size, openFolios, totalOperadores: ops.size };
    }));
    return stats;
};
