# Conteo Cíclico Pro v3.0

Sistema profesional de inventario cíclico para tiendas de calzado y ropa.

## Stack
- React 18 + TypeScript
- Vite 5
- Tailwind CSS 3
- IndexedDB (persistencia local)

## Funcionalidades
- Login con roles: Admin y Scanner
- Gestión de inventarios (folios)
- Carga de inventario teórico (texto libre)
- Escaneo con lector físico o cámara (BarcodeDetector API)
- Reporte de diferencias con cobertura
- Historial de escaneos
- Consulta por SKU
- Diccionario de colores con preview visual
- Backup/Restore en JSON
- PWA instalable

## Deploy en Railway

```bash
npm install
npm run build
```

Railway detecta Vite automáticamente.
Start command: `npm run preview`
