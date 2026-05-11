
export type Role = 'admin' | 'scanner';
export type Tab = 'folio' | 'existencias' | 'escanear' | 'reporte' | 'consulta' | 'historial' | 'colores' | 'database' | 'info';

export type StockMap = { [vkey: string]: number };

export interface CatalogItem {
    mod: string;
    color: string;
    talla: string;
    vkey: string;
    category?: 'calzado' | 'ropa';
}

export interface Catalog {
    byBarcode: { [barcode: string]: CatalogItem };
    byVariant: { [variantKey: string]: CatalogItem };
}

export interface Folio {
    id: string;
    name: string;
    almacen: string;
    temporada?: string;
    state: 'open' | 'closed';
    theoreticalMap: StockMap; // Inventario Cargado
    existenciasMap: StockMap; // Inventario Físico (Escaneado)
    areaCounters: { [area: string]: number }; // Contadores por área
    createdAt: number;
}

export interface Scan {
    id: string;
    folioId: string;
    code: string;
    vkey: string;
    mod: string;
    color: string;
    talla: string;
    area: string;
    pos: string;
    user: string;
    ts: number;
    category?: 'calzado' | 'ropa';
}

export type ColorMap = { [name: string]: string };
