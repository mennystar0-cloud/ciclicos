
export type Role = 'admin' | 'scanner';
export type Tab = 'folio' | 'existencias' | 'escanear' | 'reporte' | 'consulta' | 'historial' | 'colores' | 'database' | 'info' | 'almacen';

export interface RackAlmacen {
    numero: number;
    linea: string;
    capacidad?: number;
    piezasActuales?: number;
    notas?: string;
}

export interface SeccionAlmacen {
    id: string;
    nombre: string;
    racks: RackAlmacen[];
    cols?: number;    // columnas del grid de racks en la visualización
    planCol?: number; // columna en la vista de plano (1=izq, 2=centro, 3=der)
}

export interface AlmacenLayout {
    id: string;
    nombre: string;
    descripcion?: string;
    secciones: SeccionAlmacen[];
    sucursalesAsignadas: string[];
    creadoEn: number;
    actualizadoEn: number;
}

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
