// ─── TALLA HELPERS ────────────────────────────────────────────────────────────

export const formatTalla = (t: string | number): string => {
    const s = String(t).trim();
    if (s === '100' || s === '10.0' || s.toUpperCase() === 'UNI') return 'UNI';
    return s;
};

export const isTallaUni = (talla: string, vkey?: string): boolean => {
    if (talla.toUpperCase() === 'UNI') return true;
    if (vkey && vkey.endsWith('|100') && !vkey.startsWith('R|')) return true;
    return false;
};

export const formatTallaFromVkey = (talla: string, vkey?: string): string => {
    if (isTallaUni(talla, vkey)) return 'UNI';
    return talla;
};

// ─── MAPAS DE TALLAS DE ROPA ──────────────────────────────────────────────────

export const DAMA_SIZE_MAP: Record<string, string> = {
    '100': 'CH',
    '107': 'MED',
    '108': 'CHI',
    '110': 'M',
    '112': 'GDE',
    '120': 'G',
    '128': 'XCH',
    '130': 'EXG',
    '140': 'XXG',
    '150': '3EG',
    '990': 'UNI',
};

export const JEANS_DAMA_SIZE_MAP: Record<string, string> = {
    '030': '3',  '050': '5',  '070': '7',
    '090': '9',  '110': '11', '130': '13',
    '150': '15',
    '990': 'UNI',
};

export const JEANS_CAB_SIZE_MAP: Record<string, string> = {
    '280': '28', '300': '30', '320': '32',
    '340': '34', '360': '36', '380': '38',
    '400': '40', '420': '42', '440': '44',
};

export const BEBE_SIZE_MAP: Record<string, string> = {
    '100': '3M',  '101': '6M',  '102': '9M',
    '103': '12M', '104': '18M', '105': '24M',
};

export const BRASIER_SIZE_MAP: Record<string, string> = {
    '232': '32B', '234': '34B', '236': '36B', '238': '38B', '240': '40B',
    '242': '32C', '244': '34C', '246': '36C', '248': '38C', '250': '40C',
    '252': '32D', '254': '34D', '256': '36D', '258': '38D', '260': '40D',
    '990': 'UNI',
};

export const BRASIER_BARCODE_TO_VKEY: Record<string, string> = {
    '100': '232', '110': '234', '120': '236', '130': '238', '140': '240',
    '101': '242', '111': '244', '121': '246', '131': '248', '141': '250',
    '102': '252', '112': '254', '122': '256', '132': '258', '142': '260',
    '160': '250',
};

export const ANOS_SIZE_MAP: Record<string, string> = {
    '109': '2A',  '113': '4A',  '117': '6A',
    '121': '8A',  '122': '10A', '125': '10A',
    '129': '12A',
};

export const ALL_ROPA_MAPS = [
    DAMA_SIZE_MAP, JEANS_DAMA_SIZE_MAP, JEANS_CAB_SIZE_MAP,
    BEBE_SIZE_MAP, BRASIER_SIZE_MAP, ANOS_SIZE_MAP,
];

// ─── ESTADO MUTABLE DE SISTEMA DE TALLAS ─────────────────────────────────────
// Se rellena al parsear el teórico y se lee en decode/format

export type SizeSystem = 'dama' | 'jeans_dama' | 'jeans_cab' | 'bebe' | 'brasier' | 'anos';
export const sizeSystemByModel: Record<string, SizeSystem> = {};
export const uniRopaModels: Set<string> = new Set();
export const tallaVariantByModel: Record<string, Record<string, string>> = {};

// ─── FUNCIONES ────────────────────────────────────────────────────────────────

export const getSizeMapForSystem = (sys: SizeSystem): Record<string, string> => {
    if (sys === 'jeans_dama') return JEANS_DAMA_SIZE_MAP;
    if (sys === 'jeans_cab')  return JEANS_CAB_SIZE_MAP;
    if (sys === 'bebe')       return BEBE_SIZE_MAP;
    if (sys === 'brasier')    return BRASIER_SIZE_MAP;
    if (sys === 'anos')       return ANOS_SIZE_MAP;
    return DAMA_SIZE_MAP;
};

export const detectSistemaByTalla = (tallaRaw: string, modKey: string): SizeSystem => {
    const u = tallaRaw.toUpperCase().trim();
    if (/^\d{1,2}M$/.test(u)) { sizeSystemByModel[modKey] = 'bebe'; return 'bebe'; }
    if (/^\d{2}[ABCD]$/.test(u) && parseInt(u) >= 28) { sizeSystemByModel[modKey] = 'brasier'; return 'brasier'; }
    if (/^(0[2-9]|1[02])A$/i.test(u)) { sizeSystemByModel[modKey] = 'anos'; return 'anos'; }
    const n = parseInt(u.replace(/[^0-9]/g, ''));
    if (!isNaN(n)) {
        const nNorm = n > 50 ? n / 10 : n;
        if (nNorm >= 28 && nNorm <= 50 && nNorm % 2 === 0) {
            sizeSystemByModel[modKey] = 'jeans_cab'; return 'jeans_cab';
        }
        const nBase = n > 15 ? n / 10 : n;
        if (nBase >= 3 && nBase <= 15 && nBase % 2 === 1) {
            sizeSystemByModel[modKey] = 'jeans_dama'; return 'jeans_dama';
        }
    }
    sizeSystemByModel[modKey] = 'dama';
    return 'dama';
};

export const normalizeTallaRopa = (t: string, sistema: SizeSystem = 'dama'): string => {
    const u = t.toUpperCase().trim();
    if (sistema === 'bebe' || sistema === 'brasier' || sistema === 'anos') return u;
    if (sistema === 'jeans_cab') {
        const n = parseInt(u.replace(/[^0-9]/g, ''));
        return !isNaN(n) ? String(n > 50 ? n / 10 : n) : u;
    }
    if (sistema === 'jeans_dama') {
        const n = parseInt(u.replace(/[^0-9]/g, ''));
        return !isNaN(n) ? String(n > 15 ? n / 10 : n) : u;
    }
    if (u === '3EG')                                        return '3EG';
    if (u.startsWith('XXG'))                                return 'XXG';
    if (u.startsWith('EXG'))                                return 'EXG';
    if (u.startsWith('XG'))                                 return 'XG';
    if (u.startsWith('XCH'))                                return 'XCH';
    if (u === 'CHM' || u === 'CHI' || u.startsWith('CH'))  return 'CH';
    if (u === 'MED' || u === 'M')                           return 'M';
    if (u === 'GDE' || u === 'GEX' || u === 'G')           return 'G';
    return u;
};

export const ropaTallaToCode = (tallaLabel: string, sistema: SizeSystem = 'dama'): string => {
    const map = getSizeMapForSystem(sistema);
    const entry = Object.entries(map).find(([, v]) => v === tallaLabel);
    if (entry) return entry[0];
    if (sistema === 'jeans_cab') {
        const n = parseInt(tallaLabel);
        if (!isNaN(n)) return String(n * 10).padStart(3, '0');
    }
    if (sistema === 'jeans_dama') {
        const n = parseInt(tallaLabel);
        if (!isNaN(n)) return String(n * 10).padStart(3, '0');
    }
    if (sistema === 'bebe') {
        const orden = ['3M','6M','9M','12M','18M','24M'];
        const idx = orden.indexOf(tallaLabel);
        if (idx >= 0) return String(100 + idx).padStart(3, '0');
    }
    if (sistema === 'brasier') {
        const m = tallaLabel.match(/^(\d{2})([ABCD])$/);
        if (m) {
            const tNum = parseInt(m[1]);
            const copaOffset: Record<string, number> = { B: 0, C: 10, D: 20 };
            const base = 230 + (tNum - 32) + (copaOffset[m[2]] ?? 0);
            return String(base).padStart(3, '0');
        }
    }
    if (sistema === 'anos') {
        const m = tallaLabel.match(/^(\d{1,2})A$/i);
        if (m) return String(109 + (parseInt(m[1]) / 2 - 1) * 4).padStart(3, '0');
    }
    return '000';
};

export const tallaFromRopaVkey = (vkey: string): string => {
    const parts = vkey.split('|');
    const sizePart = parts[3] || '000';
    const modKey = parts[1] || '';
    if (sizePart === '990') return 'UNI';
    const sistema = sizeSystemByModel[modKey];
    if (sistema) {
        const label = getSizeMapForSystem(sistema)[sizePart];
        if (label) return label;
    }
    for (const map of ALL_ROPA_MAPS) {
        if (map[sizePart]) {
            const baseLabel = map[sizePart];
            const variant = tallaVariantByModel[modKey]?.[baseLabel];
            return variant || baseLabel;
        }
    }
    return sizePart;
};

export const formatTallaConCategoria = (talla: string, vkey?: string): string => {
    if (!vkey || !vkey.startsWith('R|')) return formatTallaFromVkey(talla, vkey);
    return tallaFromRopaVkey(vkey);
};

export const decodeRopaBarcode = (barcode: string, colorMap: Record<string, string>) => {
    const clean = barcode.length === 12 ? '0' + barcode : barcode;
    if (clean.length < 12) return null;
    const modelPart = clean.substring(1, 6);
    const colorPart = clean.substring(6, 9);
    const sizePart  = clean.substring(9, 12);

    const modKey = modelPart.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const sistema: SizeSystem = sizeSystemByModel[modKey] || 'dama';
    const activeMap = getSizeMapForSystem(sistema);

    let tallaLabel: string | undefined;
    let sizeCodeForVkey = sizePart;

    if (sizePart === '100' && uniRopaModels.has(modKey)) {
        tallaLabel = 'UNI';
        sizeCodeForVkey = '990';
    } else if (sistema === 'brasier') {
        sizeCodeForVkey = BRASIER_BARCODE_TO_VKEY[sizePart] || sizePart;
        tallaLabel = BRASIER_SIZE_MAP[sizeCodeForVkey];
        if (!tallaLabel) tallaLabel = activeMap[sizePart];
    } else {
        tallaLabel = activeMap[sizePart];
        if (tallaLabel && sistema === 'jeans_dama') {
            const n = parseInt(tallaLabel);
            const isJeansDamaTalla = !isNaN(n) && n >= 3 && n <= 17 && n % 2 === 1;
            if (!isJeansDamaTalla) {
                const damaLabel = DAMA_SIZE_MAP[sizePart];
                if (damaLabel) tallaLabel = damaLabel;
            } else {
                const damaLabel = DAMA_SIZE_MAP[sizePart];
                if (damaLabel && parseInt(damaLabel) !== n && isNaN(parseInt(damaLabel))) {
                    tallaLabel = damaLabel;
                }
            }
        }
        if (!tallaLabel) {
            for (const map of ALL_ROPA_MAPS) {
                if (map[sizePart]) { tallaLabel = map[sizePart]; break; }
            }
        }
    }

    if (!tallaLabel) return null;

    const colorEntry = Object.entries(colorMap).find(([, code]) =>
        String(code).padStart(3, '0') === colorPart.padStart(3, '0')
    );
    const colorName = colorEntry ? colorEntry[0] : `COLOR-${colorPart}`;
    const vkey = `R|${modKey}|${colorName.toUpperCase()}|${sizeCodeForVkey}`;
    const variantLabel = tallaVariantByModel[modKey]?.[tallaLabel] || tallaLabel;
    return { mod: modelPart, color: colorName, talla: variantLabel, vkey, category: 'ropa' as const, isSuspicious: false, isIncomplete: false };
};
