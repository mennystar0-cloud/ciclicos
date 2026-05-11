
import type { Folio, Scan, Catalog, ColorMap } from './types.ts';

const DB_NAME = 'ConteoProDB_Local';
const DB_VERSION = 5; 

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains('folios')) db.createObjectStore('folios', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('scans')) {
                const scanStore = db.createObjectStore('scans', { keyPath: 'id' });
                scanStore.createIndex('folioId', 'folioId', { unique: false });
            }
            if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const listeners: { [key: string]: Function[] } = {};
const notify = (key: string, data: any) => {
    if (listeners[key]) listeners[key].forEach(cb => cb(data));
};

export const database = {
    saveSettings: async (key: string, val: any) => {
        const db = await openDB();
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(val, key);
    },
    loadSettings: async (key: string) => {
        const db = await openDB();
        return new Promise<any>((resolve) => {
            const tx = db.transaction('settings', 'readonly');
            const req = tx.objectStore('settings').get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        });
    },
    createFolio: async (folio: Folio) => {
        const db = await openDB();
        const tx = db.transaction('folios', 'readwrite');
        tx.objectStore('folios').put(folio);
        return new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
    },
    subscribeToFolio: (id: string, callback: (f: Folio | null) => void) => {
        openDB().then(db => {
            const tx = db.transaction('folios', 'readonly');
            const req = tx.objectStore('folios').get(id);
            req.onsuccess = () => callback(req.result || null);
        });
        const eventId = `folio:${id}`;
        if (!listeners[eventId]) listeners[eventId] = [];
        listeners[eventId].push(callback);
        return () => { listeners[eventId] = listeners[eventId].filter(cb => cb !== callback); };
    },
    getAllFolios: async (): Promise<Folio[]> => {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction('folios', 'readonly');
            const req = tx.objectStore('folios').getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    },
    getLastOpenFolio: async (): Promise<Folio | undefined> => {
        const db = await openDB();
        return new Promise((resolve) => {
            const tx = db.transaction('folios', 'readonly');
            const req = tx.objectStore('folios').getAll();
            req.onsuccess = () => {
                const folios = req.result as Folio[];
                const open = folios.filter(f => f.state === 'open').sort((a, b) => b.createdAt - a.createdAt);
                resolve(open.length > 0 ? open[0] : undefined);
            };
            req.onerror = () => resolve(undefined);
        });
    },
    updateFolioStock: async (id: string, theoretical: any, catalog: any) => {
        const db = await openDB();
        const tx = db.transaction('folios', 'readwrite');
        const store = tx.objectStore('folios');
        const req = store.get(id);
        req.onsuccess = () => {
            const data = req.result as Folio;
            if (data) {
                const mergedMap = { ...(data.theoreticalMap || {}) };
                Object.entries(theoretical).forEach(([key, val]) => {
                    mergedMap[key] = (mergedMap[key] || 0) + (val as number);
                });
                data.theoreticalMap = mergedMap;
                store.put(data);
                notify(`folio:${id}`, data);
            }
        };
        await database.saveSettings('catalog', catalog);
    },
    applyFolioAdjustment: async (id: string, vkeys: string[] | null = null) => {
        const db = await openDB();
        const tx = db.transaction('folios', 'readwrite');
        const store = tx.objectStore('folios');
        return new Promise<void>((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => {
                const folio = req.result as Folio;
                if (folio) {
                    if (vkeys === null) { folio.theoreticalMap = { ...folio.existenciasMap }; }
                    else {
                        const newTheoretical = { ...folio.theoreticalMap };
                        vkeys.forEach(vk => { newTheoretical[vk] = folio.existenciasMap[vk] || 0; });
                        folio.theoreticalMap = newTheoretical;
                    }
                    store.put(folio);
                    notify(`folio:${id}`, folio);
                    resolve();
                } else reject("No se encontró el folio");
            };
        });
    },
    deleteFolioFull: async (folioId: string) => {
        const db = await openDB();
        const tx = db.transaction(['folios', 'scans'], 'readwrite');
        tx.objectStore('folios').delete(folioId);
        const index = tx.objectStore('scans').index('folioId');
        index.getAllKeys(folioId).onsuccess = (e: any) => {
            e.target.result.forEach((k: any) => tx.objectStore('scans').delete(k));
        };
    },
    rollbackArea: async (folioId: string, area: string, targetPos: number) => {
        const db = await openDB();
        const tx = db.transaction(['folios', 'scans'], 'readwrite');
        const folioStore = tx.objectStore('folios');
        const scanStore = tx.objectStore('scans');
        scanStore.index('folioId').getAll(folioId).onsuccess = (e: any) => {
            const allScans = e.target.result as Scan[];
            folioStore.get(folioId).onsuccess = (ev: any) => {
                const folio = ev.target.result as Folio;
                if (!folio) return;
                allScans.filter(s => s.area === area && parseInt(s.pos) > targetPos).forEach(s => {
                    scanStore.delete(s.id);
                    if (folio.existenciasMap[s.vkey] > 0) folio.existenciasMap[s.vkey]--;
                });
                if (!folio.areaCounters) folio.areaCounters = {};
                folio.areaCounters[area] = targetPos;
                folioStore.put(folio);
                notify(`folio:${folioId}`, folio);
                notify(`scans:${folioId}`, null);
            };
        };
    },
    addScan: async (scan: Scan) => {
        const db = await openDB();
        const tx = db.transaction(['folios', 'scans'], 'readwrite');
        const folioStore = tx.objectStore('folios');
        const scanStore = tx.objectStore('scans');
        folioStore.get(scan.folioId).onsuccess = (e: any) => {
            const folio = e.target.result as Folio;
            if (!folio) return;
            const currentCounter = folio.areaCounters?.[scan.area] || 0;
            const nextPos = currentCounter + 1;
            const finalScan = { ...scan, pos: String(nextPos) };
            scanStore.put(finalScan);
            if (!folio.areaCounters) folio.areaCounters = {};
            folio.areaCounters[scan.area] = nextPos;
            if (!folio.existenciasMap) folio.existenciasMap = {};
            folio.existenciasMap[scan.vkey] = (folio.existenciasMap[scan.vkey] || 0) + 1;
            folioStore.put(folio);
            notify(`folio:${scan.folioId}`, folio);
            notify(`scans:${scan.folioId}`, null); 
        };
    },
    addScansBulk: async (scans: Scan[], targetFolioId: string) => {
        const db = await openDB();
        const tx = db.transaction(['folios', 'scans'], 'readwrite');
        const folioStore = tx.objectStore('folios');
        const scanStore = tx.objectStore('scans');
        return new Promise<void>((resolve) => {
            folioStore.get(targetFolioId).onsuccess = (e: any) => {
                const folio = e.target.result as Folio;
                if (!folio) return;
                if (!folio.areaCounters) folio.areaCounters = {};
                if (!folio.existenciasMap) folio.existenciasMap = {};
                scans.forEach(s => {
                    const area = (s.area || 'IMPORTADO').toUpperCase();
                    const nextPos = (folio.areaCounters[area] || 0) + 1;
                    folio.areaCounters[area] = nextPos;
                    folio.existenciasMap[s.vkey] = (folio.existenciasMap[s.vkey] || 0) + 1;
                    scanStore.put({ ...s, id: Math.random().toString(36).substring(2, 15) + Date.now(), folioId: targetFolioId, pos: String(nextPos), area });
                });
                folioStore.put(folio);
            };
            tx.oncomplete = () => { notify(`folio:${targetFolioId}`, null); notify(`scans:${targetFolioId}`, null); resolve(); };
        });
    },
    updateScan: async (scanId: string, folioId: string, updatedData: Partial<Scan>) => {
        const db = await openDB();
        const tx = db.transaction(['folios', 'scans'], 'readwrite');
        const folioStore = tx.objectStore('folios');
        const scanStore = tx.objectStore('scans');
        return new Promise<void>((resolve) => {
            scanStore.get(scanId).onsuccess = (e: any) => {
                const oldScan = e.target.result as Scan;
                if (!oldScan) return;
                folioStore.get(folioId).onsuccess = (ev: any) => {
                    const folio = ev.target.result as Folio;
                    if (!folio) return;
                    // Descontar viejo
                    if (folio.existenciasMap[oldScan.vkey] > 0) folio.existenciasMap[oldScan.vkey]--;
                    // Actualizar escaneo
                    const newScan = { ...oldScan, ...updatedData };
                    scanStore.put(newScan);
                    // Sumar nuevo
                    folio.existenciasMap[newScan.vkey] = (folio.existenciasMap[newScan.vkey] || 0) + 1;
                    folioStore.put(folio);
                    notify(`folio:${folioId}`, folio);
                    notify(`scans:${folioId}`, null);
                    resolve();
                };
            };
        });
    },
    subscribeToScans: (folioId: string, callback: (scans: Scan[]) => void) => {
        const load = () => database.getScans(folioId).then(callback);
        load();
        const eventId = `scans:${folioId}`;
        if (!listeners[eventId]) listeners[eventId] = [];
        listeners[eventId].push(load);
        return () => { listeners[eventId] = listeners[eventId].filter(cb => cb !== load); };
    },
    deleteScan: async (scanId: string, folioId: string, vkey: string) => {
        const db = await openDB();
        const tx = db.transaction(['folios', 'scans'], 'readwrite');
        const folioStore = tx.objectStore('folios');
        const scanStore = tx.objectStore('scans');
        scanStore.get(scanId).onsuccess = (e: any) => {
            const scan = e.target.result as Scan;
            if (!scan) return;
            scanStore.delete(scanId);
            folioStore.get(folioId).onsuccess = (ev: any) => {
                const folio = ev.target.result as Folio;
                if (!folio) return;
                if (folio.existenciasMap[scan.vkey] > 0) folio.existenciasMap[scan.vkey]--;
                const currentMaxPos = folio.areaCounters?.[scan.area] || 0;
                if (parseInt(scan.pos) === currentMaxPos) {
                    folio.areaCounters[scan.area] = Math.max(0, currentMaxPos - 1);
                }
                folioStore.put(folio);
                notify(`folio:${folioId}`, folio);
                notify(`scans:${folioId}`, null);
            };
        };
    },
    getScans: async (folioId: string) => {
        const db = await openDB();
        return new Promise<Scan[]>((resolve) => {
            const tx = db.transaction('scans', 'readonly');
            tx.objectStore('scans').index('folioId').getAll(folioId).onsuccess = (e: any) => resolve(e.target.result || []);
        });
    },
    getFullDump: async () => {
        const db = await openDB();
        return new Promise<any>((resolve) => {
            const tx = db.transaction(['folios', 'scans', 'settings'], 'readonly');
            const result: any = { timestamp: Date.now(), folios: [], scans: [], settings: [] };
            tx.objectStore('folios').getAll().onsuccess = (e: any) => result.folios = e.target.result;
            tx.objectStore('scans').getAll().onsuccess = (e: any) => result.scans = e.target.result;
            const sStore = tx.objectStore('settings');
            sStore.getAllKeys().onsuccess = (e: any) => {
                const keys = e.target.result;
                sStore.getAll().onsuccess = (ev: any) => {
                    result.settings = keys.map((k: any, i: number) => ({ key: k, value: ev.target.result[i] }));
                };
            };
            tx.oncomplete = () => resolve(result);
        });
    },
    restoreFullDump: async (dump: any) => {
        const db = await openDB();
        const tx = db.transaction(['folios', 'scans', 'settings'], 'readwrite');
        tx.objectStore('folios').clear(); tx.objectStore('scans').clear(); tx.objectStore('settings').clear();
        dump.folios.forEach((f: any) => tx.objectStore('folios').add(f));
        dump.scans.forEach((s: any) => tx.objectStore('scans').add(s));
        if (Array.isArray(dump.settings)) dump.settings.forEach((s: any) => tx.objectStore('settings').put(s.value, s.key));
        return new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
    },
    getDatabaseInfo: async () => {
        const db = await openDB();
        return new Promise<any>((resolve) => {
            db.transaction('settings', 'readonly').objectStore('settings').get('db_version_info').onsuccess = (e: any) => resolve(e.target.result || null);
        });
    },
    seedDatabase: async () => {
        const folios = await database.getAllFolios();
        if (folios.length > 0) return; // Ya hay datos

        const demoFolioId = 'DEMO-001';
        const demoFolio: Folio = {
            id: demoFolioId,
            name: 'Inventario de Prueba (Demo)',
            almacen: 'Almacén de Ejemplo',
            state: 'open',
            theoreticalMap: {
                'NIKEAIR|NEGRO|270': 10,
                'ADIDASRUN|BLANCO|260': 5,
                'PUMASMASH|AZUL|280': 8,
                'VANSOLD|NEGRO|250': 12
            },
            existenciasMap: {
                'NIKEAIR|NEGRO|270': 9,   // Parcial (Faltante)
                'ADIDASRUN|BLANCO|260': 6, // Sobrante (Parcial)
                'PUMASMASH|AZUL|280': 8,  // OK
                'VANSOLD|NEGRO|250': 0,   // Diferencia (Faltante Total)
                'REEBOKCLUB|BLANCO|240': 3 // Teórico 0 (Sobrante Puro)
            },
            areaCounters: {
                'AREA-A': 15,
                'AREA-B': 11
            },
            createdAt: Date.now()
        };

        const demoCatalog: Catalog = {
            byBarcode: {
                '1234567890': { mod: 'NIKEAIR', color: 'NEGRO', talla: '27', vkey: 'NIKEAIR|NEGRO|270' },
                '0987654321': { mod: 'ADIDASRUN', color: 'BLANCO', talla: '26', vkey: 'ADIDASRUN|BLANCO|260' },
                '1122334455': { mod: 'PUMASMASH', color: 'AZUL', talla: '28', vkey: 'PUMASMASH|AZUL|280' },
                '5544332211': { mod: 'VANSOLD', color: 'NEGRO', talla: '25', vkey: 'VANSOLD|NEGRO|250' },
                '9988776655': { mod: 'REEBOKCLUB', color: 'BLANCO', talla: '24', vkey: 'REEBOKCLUB|BLANCO|240' }
            },
            byVariant: {
                'NIKEAIR|NEGRO|270': { mod: 'NIKEAIR', color: 'NEGRO', talla: '27', vkey: 'NIKEAIR|NEGRO|270' },
                'ADIDASRUN|BLANCO|260': { mod: 'ADIDASRUN', color: 'BLANCO', talla: '26', vkey: 'ADIDASRUN|BLANCO|260' },
                'PUMASMASH|AZUL|280': { mod: 'PUMASMASH', color: 'AZUL', talla: '28', vkey: 'PUMASMASH|AZUL|280' },
                'VANSOLD|NEGRO|250': { mod: 'VANSOLD', color: 'NEGRO', talla: '25', vkey: 'VANSOLD|NEGRO|250' },
                'REEBOKCLUB|BLANCO|240': { mod: 'REEBOKCLUB', color: 'BLANCO', talla: '24', vkey: 'REEBOKCLUB|BLANCO|240' }
            }
        };

        const demoScans: Scan[] = [];
        // NIKE AIR (9 escaneos)
        for(let i=0; i<9; i++) {
            demoScans.push({
                id: `s1-${i}`, folioId: demoFolioId, code: '1234567890', vkey: 'NIKEAIR|NEGRO|270',
                mod: 'NIKEAIR', color: 'NEGRO', talla: '27', area: 'AREA-A', pos: String(i+1), user: 'DemoUser', ts: Date.now() - (i * 60000)
            });
        }
        // ADIDAS RUN (6 escaneos)
        for(let i=0; i<6; i++) {
            demoScans.push({
                id: `s2-${i}`, folioId: demoFolioId, code: '0987654321', vkey: 'ADIDASRUN|BLANCO|260',
                mod: 'ADIDASRUN', color: 'BLANCO', talla: '26', area: 'AREA-B', pos: String(i+1), user: 'DemoUser', ts: Date.now() - (i * 70000)
            });
        }
        // PUMA SMASH (8 escaneos)
        for(let i=0; i<8; i++) {
            demoScans.push({
                id: `s3-${i}`, folioId: demoFolioId, code: '1122334455', vkey: 'PUMASMASH|AZUL|280',
                mod: 'PUMASMASH', color: 'AZUL', talla: '28', area: 'AREA-A', pos: String(i+10), user: 'DemoUser', ts: Date.now() - (i * 80000)
            });
        }
        // REEBOK CLUB (3 escaneos - Teórico 0)
        for(let i=0; i<3; i++) {
            demoScans.push({
                id: `s4-${i}`, folioId: demoFolioId, code: '9988776655', vkey: 'REEBOKCLUB|BLANCO|240',
                mod: 'REEBOKCLUB', color: 'BLANCO', talla: '24', area: 'AREA-B', pos: String(i+7), user: 'DemoUser', ts: Date.now() - (i * 90000)
            });
        }

        await database.createFolio(demoFolio);
        await database.saveSettings('catalog', demoCatalog);
        
        const db = await openDB();
        const tx = db.transaction('scans', 'readwrite');
        const store = tx.objectStore('scans');
        demoScans.forEach(s => store.put(s));
        
        return new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
    }
};
