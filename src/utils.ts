
import type { ColorMap } from './types.ts';

export const canonical = (s: string) => String(s || '').trim().toUpperCase();

/**
 * Normaliza el modelo eliminando guiones y espacios para la llave interna
 */
export const cleanModel = (m: string) => String(m || '').replace(/[^A-Z0-9]/g, '').toUpperCase();

/**
 * Valida si una talla (numérica) está en un rango lógico 
 */
export const isSizeInRange = (tallaStr: string, category: 'calzado' | 'ropa' = 'calzado') => {
    const n = parseFloat(tallaStr);
    if (isNaN(n)) return false;
    if (category === 'ropa') return n >= 1 && n <= 60;
    return n >= 10 && n <= 45;
};

/**
 * Convierte cualquier formato de talla a código de 3 dígitos (ej. 24 -> 240, 250 -> 250)
 */
export const getSizeCode = (t: string) => {
    const cleanT = String(t || '').toUpperCase().replace('T', '').replace(/[^0-9.]/g, '');
    // Si ya es un sizePart de 3 dígitos con cero inicial (ej: '050', '070', '090'),
    // usarlo directo — el teórico usa sizeparts como etiqueta de talla para jeans
    if (/^0\d{2}$/.test(cleanT)) return cleanT;
    let n = parseFloat(cleanT);
    if (isNaN(n)) return '000';
    if (n < 70) n = n * 10;
    return Math.round(n).toString().padStart(3, '0').slice(-3);
};

/**
 * Intenta detectar la categoría basado en el string de la talla
 */
export const detectCategoryBySize = (tallaRaw: string) => {
    const cleanT = String(tallaRaw || '').toUpperCase().replace('PZ', '');
    const n = parseFloat(cleanT.replace(/[^0-9.]/g, ''));
    
    // Si contiene letras como XS, S, M, L, XL, CH, MD, GD es casi seguro ropa
    if (/[XS|S|M|L|XL|CH|MD|GD|EXT]/i.test(cleanT)) return 'ropa';
    
    // Lógica de rangos: si es un número muy pequeño (1-16) suele ser ropa de niños/bebes
    // o tallas de ropa (32, 34, 36 etc). 
    // Calzado suele ser 17-30 (niños/adultos) o 100-300.
    // Esta es una heurística inicial, el usuario dará la lógica final después.
    if (!isNaN(n) && (n >= 1 && n <= 16)) return 'ropa';
    if (!isNaN(n) && (n >= 34 && n <= 60)) return 'ropa';

    return 'calzado';
};

export const keyOf = (m: string, c: string, t: string, cat?: 'calzado' | 'ropa') => {
    // Si no se pasa categoría, intentamos detectarla por la talla
    const activeCat = cat || detectCategoryBySize(t);
    const prefix = activeCat === 'ropa' ? 'R|' : '';
    return `${prefix}${cleanModel(m)}|${canonical(c)}|${getSizeCode(t)}`;
};

export const splitKey = (k: string) => {
    const isRopa = k.startsWith('R|');
    const cleanK = isRopa ? k.substring(2) : k;
    const p = cleanK.split('|');
    const talla3d = p[2] || '000';
    const n = parseInt(talla3d);
    const tallaHumana = !isNaN(n) ? (n / 10).toString() : '0';
    return { 
        mod: p[0], 
        color: p[1], 
        talla: tallaHumana, 
        talla3d,
        category: (isRopa ? 'ropa' : 'calzado') as 'calzado' | 'ropa'
    };
};

export const formatModel = (mod: string) => {
    const clean = cleanModel(mod);
    if (clean.length === 5 && /^\d+$/.test(clean)) {
        return `${clean.slice(0, 3)}-${clean.slice(3, 5)}`;
    }
    return canonical(mod);
};

export const cleanColorName = (name: string) => canonical(name).trim();

// Add generateBarcode function to fix the import error in StockTab.tsx
/**
 * Genera un código de barras estructurado compatible con el decodificador
 */
export const generateBarcode = (mod: string, color: string, talla: string, colorMap: ColorMap) => {
    const m = cleanModel(mod).padStart(5, '0').slice(-5);
    const c = (colorMap[canonical(color)] || '000').padStart(3, '0').slice(-3);
    const t = getSizeCode(talla);
    // Retorna 12 dígitos para que tryDecodeStructuredBarcode pueda procesarlo correctamente
    // El decodificador espera encontrar el modelo en indices 1-5 tras añadir un '0' inicial si la longitud es 12.
    return `${m}${c}${t}0`; 
};

export const tryDecodeStructuredBarcode = (barcode: string, colorMap: ColorMap, category: 'calzado' | 'ropa' = 'calzado') => {
    if (!barcode) return null;
    
    // Si es ropa, dejamos la lógica "en blanco" (placeholder que no decodifica nada por ahora)
    // hasta que el usuario comparta la estructura
    if (category === 'ropa') return null;

    const isIncomplete = barcode.length < 12;
    const cleanBarcode = barcode.length === 12 ? `0${barcode}` : barcode;

    if (barcode.length < 10) return null; // Demasiado corto para ser estructurado

    const modelPart = cleanBarcode.substring(1, 6); 
    const colorPart = cleanBarcode.substring(6, 9); 
    const sizePart = cleanBarcode.substring(9, 12); 

    const colorCodeToFind = colorPart.padStart(3, '0');
    const colorEntry = Object.entries(colorMap).find(([name, code]) => {
        return String(code).padStart(3, '0') === colorCodeToFind;
    });

    const colorName = colorEntry ? colorEntry[0] : `COLOR-${colorPart}`;
    const talla3d = sizePart;
    const tallaHumana = (parseInt(talla3d) / 10).toString();

    const vkey = keyOf(modelPart, colorName, tallaHumana, 'calzado');

    return {
        mod: modelPart,
        color: colorName,
        talla: tallaHumana,
        vkey,
        category: 'calzado' as 'calzado',
        isSuspicious: !isSizeInRange(tallaHumana, 'calzado') || isIncomplete,
        isIncomplete
    };
};

export const formatDate = (ts: number) => new Date(ts).toLocaleString('es-MX');
