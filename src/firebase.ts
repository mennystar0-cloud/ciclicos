import { initializeApp } from 'firebase/app';
import {
    getFirestore, collection, doc, setDoc, getDoc, getDocs,
    onSnapshot, deleteDoc, query, where, writeBatch,
    updateDoc, increment, serverTimestamp, Timestamp
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

// ─── FOLIOS ───────────────────────────────────────────────────────────────────
export const fbCreateFolio = async (folio: any) => {
    await setDoc(doc(db, 'folios', folio.id), { ...folio, updatedAt: serverTimestamp() });
};

export const fbGetAllFolios = async () => {
    const snap = await getDocs(collection(db, 'folios'));
    return snap.docs.map(d => d.data());
};

export const fbGetLastOpenFolio = async () => {
    const snap = await getDocs(collection(db, 'folios'));
    const folios = snap.docs.map(d => d.data()).filter((f: any) => f.state === 'open');
    return folios.sort((a: any, b: any) => b.createdAt - a.createdAt)[0];
};

export const fbSubscribeToFolio = (id: string, callback: (f: any) => void) => {
    return onSnapshot(doc(db, 'folios', id), snap => {
        if (snap.exists()) callback(snap.data());
        else callback(null);
    });
};

export const fbUpdateFolio = async (folio: any) => {
    await setDoc(doc(db, 'folios', folio.id), { ...folio, updatedAt: serverTimestamp() });
};

export const fbDeleteFolio = async (folioId: string) => {
    await deleteDoc(doc(db, 'folios', folioId));
    // delete scans
    const q = query(collection(db, 'scans'), where('folioId', '==', folioId));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
};

// ─── SCANS (Inventario Cíclico) ───────────────────────────────────────────────
export const fbAddScan = async (scan: any) => {
    const scanRef = doc(db, 'scans', scan.id);
    const folioRef = doc(db, 'folios', scan.folioId);

    // Escribir scan y actualizar contadores del folio en paralelo
    // increment() no requiere leer el documento primero — elimina 1 round-trip
    await Promise.all([
        setDoc(scanRef, { ...scan, createdAt: serverTimestamp() }),
        updateDoc(folioRef, {
            [`existenciasMap.${scan.vkey}`]: increment(1),
            [`areaCounters.${scan.area}`]: increment(1),
            updatedAt: serverTimestamp(),
        }),
    ]);

    return scan;
};

export const fbDeleteScan = async (scanId: string, folioId: string, vkey: string, area?: string, pos?: string) => {
    const folioRef = doc(db, 'folios', folioId);

    await Promise.all([
        deleteDoc(doc(db, 'scans', scanId)),
        updateDoc(folioRef, {
            [`existenciasMap.${vkey}`]: increment(-1),
            ...(area ? { [`areaCounters.${area}`]: increment(-1) } : {}),
            updatedAt: serverTimestamp(),
        }),
    ]);
};

export const fbGetScans = async (folioId: string) => {
    const q = query(collection(db, 'scans'), where('folioId', '==', folioId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data()).sort((a: any, b: any) => b.ts - a.ts);
};

export const fbSubscribeToScans = (folioId: string, callback: (scans: any[]) => void) => {
    const q = query(collection(db, 'scans'), where('folioId', '==', folioId));
    return onSnapshot(q, snap => {
        const scans = snap.docs.map(d => d.data()).sort((a: any, b: any) => b.ts - a.ts);
        callback(scans);
    });
};

// ─── SESIONES DE SCANNER (Escaneos Independientes) ────────────────────────────
export const fbCreateScanSession = async (session: any) => {
    await setDoc(doc(db, 'scanSessions', session.id), { ...session, createdAt: serverTimestamp() });
};

export const fbAddSessionScan = async (sessionId: string, scan: any) => {
    const scanRef = doc(db, 'scanSessions', sessionId, 'items', scan.id);
    const sessionRef = doc(db, 'scanSessions', sessionId);

    await Promise.all([
        setDoc(scanRef, { ...scan, createdAt: serverTimestamp() }),
        updateDoc(sessionRef, {
            count: increment(1),
            updatedAt: serverTimestamp(),
        }),
    ]);
};

export const fbSubscribeToSession = (sessionId: string, callback: (session: any) => void) => {
    return onSnapshot(doc(db, 'scanSessions', sessionId), snap => {
        if (snap.exists()) callback(snap.data());
        else callback(null);
    });
};

export const fbSubscribeToSessionItems = (sessionId: string, callback: (items: any[]) => void) => {
    return onSnapshot(collection(db, 'scanSessions', sessionId, 'items'), snap => {
        const items = snap.docs.map(d => d.data()).sort((a: any, b: any) => b.ts - a.ts);
        callback(items);
    });
};

export const fbGetAllSessions = async () => {
    const snap = await getDocs(collection(db, 'scanSessions'));
    return snap.docs.map(d => d.data());
};

export const fbSubscribeToAllSessions = (callback: (sessions: any[]) => void) => {
    return onSnapshot(collection(db, 'scanSessions'), snap => {
        callback(snap.docs.map(d => d.data()).sort((a: any, b: any) => b.createdAt?.seconds - a.createdAt?.seconds));
    });
};

export const fbDeleteSession = async (sessionId: string) => {
    // delete items subcollection
    const itemsSnap = await getDocs(collection(db, 'scanSessions', sessionId, 'items'));
    const batch = writeBatch(db);
    itemsSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'scanSessions', sessionId));
    await batch.commit();
};

export const fbGetSessionItems = async (sessionId: string) => {
    const snap = await getDocs(collection(db, 'scanSessions', sessionId, 'items'));
    return snap.docs.map(d => d.data()).sort((a: any, b: any) => b.ts - a.ts);
};

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
export const fbSaveSettings = async (key: string, value: any) => {
    await setDoc(doc(db, 'settings', key), { value, updatedAt: serverTimestamp() });
};

export const fbLoadSettings = async (key: string) => {
    const snap = await getDoc(doc(db, 'settings', key));
    return snap.exists() ? snap.data().value : null;
};

// ─── BACKUP ───────────────────────────────────────────────────────────────────
export const fbGetFullDump = async () => {
    const [folios, scans, sessions] = await Promise.all([
        getDocs(collection(db, 'folios')),
        getDocs(collection(db, 'scans')),
        getDocs(collection(db, 'scanSessions')),
    ]);
    return {
        timestamp: Date.now(),
        folios: folios.docs.map(d => d.data()),
        scans: scans.docs.map(d => d.data()),
        sessions: sessions.docs.map(d => d.data()),
    };
};

export const fbRestoreFullDump = async (dump: any) => {
    const batch = writeBatch(db);
    dump.folios?.forEach((f: any) => batch.set(doc(db, 'folios', f.id), f));
    dump.scans?.forEach((s: any) => batch.set(doc(db, 'scans', s.id), s));
    await batch.commit();
};
