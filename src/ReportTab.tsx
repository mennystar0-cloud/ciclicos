import { useState, useMemo } from 'react';
import { splitKey, getSizeCode } from './utils.ts';
import { formatTallaConCategoria, ALL_ROPA_MAPS } from './ropaUtils.ts';
import {
    BarChart3, Search, Package, Check, AlertTriangle, Printer,
    ChevronUp, ChevronRight, ChevronDown, FileText, Download,
} from './icons.tsx';
import type { Folio, Scan, Tab, ToastType } from './types.ts';
// ─── PRINT STYLES ─────────────────────────────────────────────────────────────
export const PRINT_STYLES = `
@media print {
    body * { visibility: hidden !important; }
    #print-report, #print-report * { visibility: visible !important; }
    #print-report { position: fixed; top: 0; left: 0; width: 100%; padding: 24px; background: white; }
    .no-print { display: none !important; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; }
    th { background: #1e293b !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr.faltante td { background: #fef2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tr.sobrante td { background: #f0fdf4 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .summary-box { border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px; display: inline-block; margin-right: 8px; }
    @page { margin: 1.5cm; size: A4 portrait; }
}
`;

// ─── REPORT TAB ───────────────────────────────────────────────────────────────
export const ReportTab = ({ folio, scans, onTabChange, addToast }: {
    folio: Folio | null; scans: Scan[];
    onTabChange: (t: Tab) => void; addToast: (m: string, t?: ToastType) => void;
}) => {
    const [filter, setFilter] = useState<'all' | 'faltante' | 'sobrante' | 'ok' | 'parcial' | 'ajustes'>('all');
    const [searchMod, setSearchMod] = useState('');
    const [sortBy, setSortBy]     = useState<'diff' | 'mod'>('diff');
    const [sortDir, setSortDir]   = useState<'asc' | 'desc'>('asc');
    const [filterTalla, setFilterTalla] = useState('');
    const [filterColor, setFilterColor] = useState('');
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [printMode, setPrintMode] = useState<'completo' | 'simplificado'>('completo');
    const [vista, setVista] = useState<'reporte' | 'ajustes'>('reporte');
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [ajusteSearch, setAjusteSearch] = useState('');
    const [ajusteTipoFil, setAjusteTipoFil] = useState<'all' | 'talla' | 'color'>('all');
    const [ajusteChecked, setAjusteChecked] = useState<Set<number>>(new Set());

    const report = useMemo(() => {
        if (!folio) return { rows: [], totalItems: 0, scannedItems: 0, missingItems: 0, sobranteItems: 0 };
        const allKeys = new Set([...Object.keys(folio.theoreticalMap || {}), ...Object.keys(folio.existenciasMap || {})]);
        const scansByVkey = new Map<string, Scan[]>();
        scans.forEach(s => {
            const list = scansByVkey.get(s.vkey);
            if (list) list.push(s);
            else scansByVkey.set(s.vkey, [s]);
        });
        const rows = Array.from(allKeys).map(vkey => {
            const teo = folio.theoreticalMap[vkey] || 0;
            const fis = folio.existenciasMap[vkey] || 0;
            const diff = fis - teo;
            const parts = splitKey(vkey);
            const areaMap: { [a: string]: number } = {};
            (scansByVkey.get(vkey) ?? []).forEach(s => { areaMap[s.area] = (areaMap[s.area] || 0) + 1; });
            const status: 'ok' | 'faltante' | 'sobrante' | 'parcial' = diff === 0 ? 'ok' : diff > 0 ? 'sobrante' : fis > 0 ? 'parcial' : 'faltante';
            return { vkey, teo, fis, diff, status, areaMap, ...parts };
        });
        return {
            rows,
            totalItems: rows.reduce((a, r) => a + r.teo, 0),
            scannedItems: rows.reduce((a, r) => a + r.fis, 0),
            missingItems: rows.filter(r => r.status === 'faltante').reduce((a, r) => a + Math.abs(r.diff), 0),
            sobranteItems: rows.filter(r => r.status === 'sobrante').reduce((a, r) => a + r.diff, 0),
        };
    }, [folio, scans]);

    const areaChart = useMemo(() => {
        const map: { [a: string]: number } = {};
        scans.forEach(s => { map[s.area] = (map[s.area] || 0) + 1; });
        return Object.entries(map).map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count);
    }, [scans]);
    const filtered = useMemo(() => {
        const rows = report.rows.filter(r => {
            if (filter !== 'all' && filter !== 'ajustes' && r.status !== filter) return false;
            if (searchMod.trim()) {
                const q = searchMod.trim().toLowerCase();
                if (!r.mod.toLowerCase().includes(q) && !r.color.toLowerCase().includes(q)) return false;
            }
            if (filterTalla && formatTallaConCategoria(r.talla, r.vkey) !== filterTalla) return false;
            if (filterColor && r.color !== filterColor) return false;
            return true;
        });
        return rows.sort((a, b) => {
            const mul = sortDir === 'asc' ? 1 : -1;
            if (sortBy === 'mod') return mul * a.mod.localeCompare(b.mod);
            return mul * (a.diff - b.diff);
        });
    }, [report.rows, filter, searchMod, sortBy, sortDir, filterTalla, filterColor]);

    const ajustesSugeridos = useMemo(() => {
        if (!folio) return [];
        const byModel: { [mod: string]: typeof report.rows } = {};
        report.rows.forEach(r => {
            if (!byModel[r.mod]) byModel[r.mod] = [];
            byModel[r.mod].push(r);
        });
        const sugerencias: {
            mod: string; tipo: 'talla' | 'color';
            sobrante: { vkey: string; color: string; talla: string; exceso: number };
            faltante: { vkey: string; color: string; talla: string; falta: number };
            piezas: number;
        }[] = [];
        // Detecta par talla falso-positivo: misma talla pero distinto encoding
        // Ej: teórico tiene '50' (vkey |500) y barcode escanea como '5' (vkey |050)
        // Si la pequeña es talla jeans dama (impar 3-15) y la grande no existe en
        // ningún mapa de tallas conocido, es error de captura en el teórico.
        const isMislabeledTallaPair = (t1: string, t2: string): boolean => {
            const n1 = parseFloat(t1), n2 = parseFloat(t2);
            if (isNaN(n1) || isNaN(n2)) return false;
            const sm = Math.min(n1, n2), lg = Math.max(n1, n2);
            if (lg !== sm * 10) return false;
            if (!Number.isInteger(sm) || sm < 3 || sm > 15 || sm % 2 !== 1) return false;
            const lgCode = getSizeCode(String(lg));
            return !ALL_ROPA_MAPS.some(m => !!m[lgCode]);
        };
        Object.entries(byModel).forEach(([mod, variantes]) => {
            const sobrantes = variantes.filter(v => v.diff > 0);
            const faltantes = variantes.filter(v => v.diff < 0);
            if (sobrantes.length === 0 || faltantes.length === 0) return;
            sobrantes.forEach(s => {
                faltantes.forEach(f => {
                    const piezas = Math.min(s.diff, Math.abs(f.diff));
                    if (piezas <= 0) return;
                    if (s.color === f.color && s.talla !== f.talla && !isMislabeledTallaPair(s.talla, f.talla)) {
                        sugerencias.push({ mod, tipo: 'talla', sobrante: { vkey: s.vkey, color: s.color, talla: s.talla, exceso: s.diff }, faltante: { vkey: f.vkey, color: f.color, talla: f.talla, falta: Math.abs(f.diff) }, piezas });
                    }
                    if (s.talla === f.talla && s.color !== f.color) {
                        sugerencias.push({ mod, tipo: 'color', sobrante: { vkey: s.vkey, color: s.color, talla: s.talla, exceso: s.diff }, faltante: { vkey: f.vkey, color: f.color, talla: f.talla, falta: Math.abs(f.diff) }, piezas });
                    }
                });
            });
        });
        return sugerencias.sort((a, b) => a.tipo === b.tipo ? b.piezas - a.piezas : a.tipo === 'talla' ? -1 : 1);
    }, [report.rows, folio]);

    const ajustesFiltrados = useMemo(() => {
        let list = ajustesSugeridos;
        if (ajusteTipoFil !== 'all') list = list.filter(a => a.tipo === ajusteTipoFil);
        if (ajusteSearch.trim()) list = list.filter(a => a.mod.toLowerCase().includes(ajusteSearch.trim().toLowerCase()));
        return list;
    }, [ajustesSugeridos, ajusteTipoFil, ajusteSearch]);

    const coveragePct = report.totalItems > 0 ? (report.scannedItems / report.totalItems) * 100 : 0;

    const exportCSV = () => {
        const header = 'Modelo,Color,Talla,Teórico,Físico,Diferencia,Estado\n';
        const rows = report.rows.map(r => `${r.mod},${r.color},${formatTallaConCategoria(r.talla, r.vkey)},${r.teo},${r.fis},${r.diff},${r.status}`).join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `reporte-${folio?.name}.csv`; a.click();
        addToast('CSV exportado', 'success');
    };

    const exportExcel = () => {
        if (!folio) return;
        const rowsSorted = [...report.rows].sort((a, b) => a.diff - b.diff);

        const statusLabel = (s: string, diff: number) => {
            if (s === 'faltante') return `Faltante (${diff})`;
            if (s === 'sobrante') return `Sobrante (+${diff})`;
            if (s === 'parcial')  return `Parcial (${diff})`;
            return 'OK';
        };
        const bgByStatus: Record<string, string> = {
            faltante: '#FEE2E2', sobrante: '#DCFCE7', parcial: '#FEF3C7', ok: '#FFFFFF',
        };

        const cell = (val: string | number, styleId: string) =>
            `<Cell ss:StyleID="${styleId}"><Data ss:Type="${typeof val === 'number' ? 'Number' : 'String'}">${String(val).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</Data></Cell>`;

        const dataRows = rowsSorted.map(r => {
            const bg = bgByStatus[r.status] || '#FFFFFF';
            const sId = `s_${bg.replace('#', '')}`;
            const diffSId = r.diff < 0 ? 'neg' : r.diff > 0 ? 'pos' : sId;
            return `<Row>
              ${cell(r.mod, sId)}
              ${cell(r.color, sId)}
              ${cell(formatTallaConCategoria(r.talla, r.vkey), sId)}
              ${cell(r.teo, sId)}
              ${cell(r.fis, sId)}
              ${cell(r.diff, diffSId)}
              ${cell(statusLabel(r.status, r.diff), sId)}
            </Row>`;
        }).join('');

        const totalTeo  = rowsSorted.reduce((a, r) => a + r.teo, 0);
        const totalFis  = rowsSorted.reduce((a, r) => a + r.fis, 0);
        const totalDiff = totalFis - totalTeo;

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
<Styles>
  <Style ss:ID="header">
    <Font ss:Bold="1" ss:Color="#FFFFFF" ss:Size="10"/>
    <Interior ss:Color="#0F172A" ss:Pattern="Solid"/>
    <Alignment ss:Horizontal="Center"/>
  </Style>
  <Style ss:ID="title">
    <Font ss:Bold="1" ss:Size="13" ss:Color="#0F172A"/>
  </Style>
  <Style ss:ID="kpi_lbl">
    <Font ss:Bold="1" ss:Size="9" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="kpi_val">
    <Font ss:Bold="1" ss:Size="14" ss:Color="#0EA5E9"/>
  </Style>
  <Style ss:ID="s_FFFFFF"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
  <Style ss:ID="s_FEE2E2"><Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/></Style>
  <Style ss:ID="s_DCFCE7"><Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="s_FEF3C7"><Interior ss:Color="#FEF3C7" ss:Pattern="Solid"/></Style>
  <Style ss:ID="neg">
    <Interior ss:Color="#FEE2E2" ss:Pattern="Solid"/>
    <Font ss:Bold="1" ss:Color="#DC2626"/>
  </Style>
  <Style ss:ID="pos">
    <Interior ss:Color="#DCFCE7" ss:Pattern="Solid"/>
    <Font ss:Bold="1" ss:Color="#16A34A"/>
  </Style>
  <Style ss:ID="total">
    <Font ss:Bold="1" ss:Size="10"/>
    <Interior ss:Color="#F1F5F9" ss:Pattern="Solid"/>
  </Style>
</Styles>
<Worksheet ss:Name="Reporte">
<Table ss:DefaultColumnWidth="90">
  <Column ss:Width="130"/>
  <Column ss:Width="100"/>
  <Column ss:Width="60"/>
  <Column ss:Width="70"/>
  <Column ss:Width="70"/>
  <Column ss:Width="80"/>
  <Column ss:Width="120"/>
  <Row>
    <Cell ss:MergeAcross="6" ss:StyleID="title">
      <Data ss:Type="String">Conteo Cíclico Pro — ${folio.name}</Data>
    </Cell>
  </Row>
  <Row>
    <Cell ss:MergeAcross="6">
      <Data ss:Type="String">${folio.almacen}${folio.temporada ? ' · ' + folio.temporada : ''} · ${new Date().toLocaleDateString('es-MX')}</Data>
    </Cell>
  </Row>
  <Row/>
  <Row>
    <Cell ss:StyleID="kpi_lbl"><Data ss:Type="String">Teórico</Data></Cell>
    <Cell ss:StyleID="kpi_val"><Data ss:Type="Number">${totalTeo}</Data></Cell>
    <Cell ss:StyleID="kpi_lbl"><Data ss:Type="String">Físico</Data></Cell>
    <Cell ss:StyleID="kpi_val"><Data ss:Type="Number">${totalFis}</Data></Cell>
    <Cell ss:StyleID="kpi_lbl"><Data ss:Type="String">Diferencia</Data></Cell>
    <Cell ss:StyleID="${totalDiff < 0 ? 'neg' : totalDiff > 0 ? 'pos' : 'total'}"><Data ss:Type="Number">${totalDiff}</Data></Cell>
    <Cell ss:StyleID="kpi_lbl"><Data ss:Type="String">Cobertura: ${Math.round((totalFis / Math.max(totalTeo, 1)) * 100)}%</Data></Cell>
  </Row>
  <Row/>
  <Row>
    ${['Modelo','Color','Talla','Teórico','Físico','Diferencia','Estado'].map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${h}</Data></Cell>`).join('')}
  </Row>
  ${dataRows}
  <Row>
    <Cell ss:StyleID="total"><Data ss:Type="String">TOTAL</Data></Cell>
    <Cell ss:StyleID="total"/>
    <Cell ss:StyleID="total"/>
    <Cell ss:StyleID="total"><Data ss:Type="Number">${totalTeo}</Data></Cell>
    <Cell ss:StyleID="total"><Data ss:Type="Number">${totalFis}</Data></Cell>
    <Cell ss:StyleID="${totalDiff < 0 ? 'neg' : totalDiff > 0 ? 'pos' : 'total'}"><Data ss:Type="Number">${totalDiff}</Data></Cell>
    <Cell ss:StyleID="total"/>
  </Row>
</Table>
</Worksheet>
</Workbook>`;

        const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `reporte-${folio.name}-${new Date().toLocaleDateString('es-MX').replace(/\//g,'-')}.xls`;
        a.click();
        URL.revokeObjectURL(url);
        addToast('Excel exportado', 'success');
    };

    const printAjustes = () => {
        if (!folio) return;
        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>Ajustes Posibles — ${folio?.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #1e293b; padding: 20px; }
  .header { border-bottom: 3px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { font-size: 17px; font-weight: 900; color: #0f172a; }
  .sub { font-size: 9px; color: #64748b; margin-top: 3px; }
  .badge { display: inline-block; background: #f59e0b; color: white; font-size: 8px; font-weight: bold; padding: 2px 8px; border-radius: 10px; margin-left: 8px; vertical-align: middle; }
  .resumen { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
  .res-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 14px; text-align: center; }
  .res-box .val { font-size: 15px; font-weight: bold; color: #f59e0b; }
  .res-box .lbl { font-size: 8px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f8fafc; }
  th { text-align: left; padding: 5px 7px; border: 1px solid #e2e8f0; font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .03em; }
  td { padding: 5px 7px; border: 1px solid #e2e8f0; vertical-align: middle; }
  tr:nth-child(even) td { background: #f8fafc; }
  .tipo-talla { background: #dbeafe; color: #1d4ed8; font-size: 8px; font-weight: bold; padding: 1px 5px; border-radius: 8px; white-space: nowrap; }
  .tipo-color { background: #f3e8ff; color: #7e22ce; font-size: 8px; font-weight: bold; padding: 1px 5px; border-radius: 8px; white-space: nowrap; }
  .sob { color: #16a34a; font-weight: 600; }
  .fal { color: #dc2626; font-weight: 600; }
  .arrow { text-align: center; color: #94a3b8; font-weight: bold; font-size: 12px; }
  .pzas { text-align: center; font-weight: bold; color: #d97706; }
  .num { text-align: center; color: #94a3b8; font-size: 9px; }
  .check { text-align: center; font-size: 14px; color: #cbd5e1; }
  .footer { margin-top: 14px; font-size: 8px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 6px; }
  @page { size: A4 portrait; margin: 1cm 1.5cm; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">Conteo Cíclico Pro <span class="badge">AJUSTES POSIBLES</span></div>
    <div class="sub">${folio?.name} &nbsp;·&nbsp; ${folio?.almacen} &nbsp;·&nbsp; ${folio?.temporada || ''}</div>
    <div class="sub">${new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</div>
  </div>
  <div style="text-align:right"><div class="sub">v4.0 · Multi-Sucursal</div></div>
</div>

<div class="resumen">
  <div class="res-box"><div class="val">${ajustesSugeridos.length}</div><div class="lbl">Ajustes posibles</div></div>
  <div class="res-box"><div class="val">${ajustesSugeridos.filter(a => a.tipo === 'talla').length}</div><div class="lbl">Por talla</div></div>
  <div class="res-box"><div class="val">${ajustesSugeridos.filter(a => a.tipo === 'color').length}</div><div class="lbl">Por color</div></div>
  <div class="res-box"><div class="val">${ajustesSugeridos.reduce((s, a) => s + a.piezas, 0)}</div><div class="lbl">Piezas a mover</div></div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:24px">#</th>
      <th style="width:72px">Modelo</th>
      <th style="width:48px">Tipo</th>
      <th>Sobrante (color · talla · cant)</th>
      <th style="width:14px"></th>
      <th>Faltante (color · talla · cant)</th>
      <th style="width:36px">Piezas</th>
      <th style="width:44px">Aplicado</th>
    </tr>
  </thead>
  <tbody>
    ${ajustesSugeridos.map((a, i) => `
    <tr>
      <td class="num">${i + 1}</td>
      <td style="font-weight:bold">${a.mod}</td>
      <td><span class="${a.tipo === 'talla' ? 'tipo-talla' : 'tipo-color'}">${a.tipo === 'talla' ? 'Talla' : 'Color'}</span></td>
      <td class="sob">${a.sobrante.color} · T${formatTallaFromVkey(a.sobrante.talla, a.sobrante.vkey)} · +${a.sobrante.exceso}</td>
      <td class="arrow">→</td>
      <td class="fal">${a.faltante.color} · T${formatTallaFromVkey(a.faltante.talla, a.faltante.vkey)} · -${a.faltante.falta}</td>
      <td class="pzas">${a.piezas}</td>
      <td class="check">☐</td>
    </tr>`).join('')}
  </tbody>
</table>

<div class="footer">
  Conteo Cíclico Pro v4.0 · Generado el ${new Date().toLocaleDateString('es-MX')} · ${ajustesSugeridos.length} ajuste(s) sugerido(s)
</div>
</body>
</html>`;
        const win = window.open('', '_blank');
        if (win) { win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 300); }
    };

    const handlePrint = (mode: 'completo' | 'simplificado' | 'ajustes') => {
        setPrintMode(mode === 'ajustes' ? 'completo' : mode);

        if (mode === 'ajustes') {
            printAjustes();
            return;
        }

        // Determinar qué filas imprimir según filtro activo
        const rowsToPrint = mode === 'simplificado'
            ? simplificadoRows
            : filter === 'all'
                ? [...report.rows].sort((a, b) => a.diff - b.diff)
                : [...filtered].sort((a, b) => a.diff - b.diff);

        const filterLabel: Record<string, string> = {
            all: 'Completo', faltante: 'Faltantes', sobrante: 'Sobrantes',
            ok: 'Sin diferencia', parcial: 'Parciales'
        };
        const titulo = mode === 'simplificado' ? 'Reporte Simplificado' : `Reporte — ${filterLabel[filter]}`;

        const totalTeo = rowsToPrint.reduce((a, r) => a + r.teo, 0);
        const totalFis = rowsToPrint.reduce((a, r) => a + r.fis, 0);
        const totalDiff = totalFis - totalTeo;

        const statusColor = (s: string) => {
            if (s === 'faltante') return '#fef2f2';
            if (s === 'sobrante') return '#f0fdf4';
            if (s === 'parcial')  return '#fffbeb';
            return '#ffffff';
        };
        const statusLabel = (s: string, diff: number) => {
            if (s === 'faltante') return `Faltante (${diff})`;
            if (s === 'sobrante') return `Sobrante (+${diff})`;
            if (s === 'parcial')  return `Parcial (${diff})`;
            return 'OK';
        };

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<title>${titulo} — ${folio?.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1e293b; padding: 24px; }
  .header { border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
  .logo { font-size: 18px; font-weight: 900; color: #0f172a; }
  .logo-sub { font-size: 10px; color: #64748b; margin-top: 3px; }
  .badge { display: inline-block; font-size: 9px; font-weight: bold; padding: 2px 8px; border-radius: 10px; margin-left: 8px; vertical-align: middle; }
  .badge-all { background: #1e293b; color: white; }
  .badge-faltante { background: #fee2e2; color: #dc2626; }
  .badge-sobrante { background: #dcfce7; color: #16a34a; }
  .badge-ok { background: #dbeafe; color: #2563eb; }
  .badge-parcial { background: #fef3c7; color: #d97706; }
  .badge-simplificado { background: #f3e8ff; color: #7e22ce; }
  .kpis { display: flex; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 14px; text-align: center; min-width: 80px; }
  .kpi .val { font-size: 17px; font-weight: bold; }
  .kpi .lbl { font-size: 9px; color: #64748b; margin-top: 1px; }
  .kpi.red .val { color: #dc2626; }
  .kpi.green .val { color: #16a34a; }
  .kpi.blue .val { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { background: #0f172a; color: white; padding: 7px 8px; text-align: left; font-size: 10px; font-weight: bold; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr.faltante td { background: #fef2f2 !important; }
  tr.sobrante td { background: #f0fdf4 !important; }
  tr.parcial td  { background: #fffbeb !important; }
  .total-row td { font-weight: bold; background: #f1f5f9 !important; border-top: 2px solid #e2e8f0; }
  .obs-cell { color: #d1d5db; font-style: italic; font-size: 9px; min-width: 120px; border-bottom: 1px dashed #d1d5db; }
  .diff-neg { color: #dc2626; font-weight: bold; }
  .diff-pos { color: #16a34a; font-weight: bold; }
  .diff-zero { color: #64748b; }
  .footer { margin-top: 20px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 8px; }
  @page { size: A4 portrait; margin: 1.5cm; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="logo">
      Conteo Cíclico Pro
      <span class="badge badge-${mode === 'simplificado' ? 'simplificado' : filter}">${titulo}</span>
    </div>
    <div class="logo-sub">${folio?.name} &nbsp;·&nbsp; ${folio?.almacen} &nbsp;·&nbsp; ${folio?.temporada || ''}</div>
    <div class="logo-sub">${new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })}</div>
  </div>
  <div style="text-align:right">
    <div class="logo-sub">v4.0 · Multi-Sucursal</div>
    <div class="logo-sub">${rowsToPrint.length} artículo(s)</div>
  </div>
</div>

<div class="kpis">
  <div class="kpi blue"><div class="val">${totalTeo}</div><div class="lbl">Teórico</div></div>
  <div class="kpi blue"><div class="val">${totalFis}</div><div class="lbl">Físico</div></div>
  <div class="kpi ${totalDiff < 0 ? 'red' : totalDiff > 0 ? 'green' : ''}">
    <div class="val">${totalDiff > 0 ? '+' : ''}${totalDiff}</div><div class="lbl">Diferencia</div>
  </div>
  <div class="kpi red"><div class="val">${rowsToPrint.filter(r => r.status === 'faltante').length}</div><div class="lbl">SKU Faltantes</div></div>
  <div class="kpi green"><div class="val">${rowsToPrint.filter(r => r.status === 'sobrante').length}</div><div class="lbl">SKU Sobrantes</div></div>
  <div class="kpi"><div class="val">${Math.round((totalFis / Math.max(totalTeo, 1)) * 100)}%</div><div class="lbl">Cobertura</div></div>
</div>

<table>
  <thead>
    <tr>
      <th>Modelo</th>
      <th>Color</th>
      <th style="text-align:center">Talla</th>
      <th style="text-align:center">Teórico</th>
      <th style="text-align:center">Físico</th>
      <th style="text-align:center">Diferencia</th>
      <th>Estado</th>
      <th>Observaciones</th>
    </tr>
  </thead>
  <tbody>
    ${rowsToPrint.map(r => `
    <tr class="${r.status}">
      <td style="font-weight:600">${r.mod}</td>
      <td>${r.color}</td>
      <td style="text-align:center">${formatTallaConCategoria(r.talla, r.vkey)}</td>
      <td style="text-align:center">${r.teo}</td>
      <td style="text-align:center">${r.fis}</td>
      <td style="text-align:center" class="${r.diff < 0 ? 'diff-neg' : r.diff > 0 ? 'diff-pos' : 'diff-zero'}">${r.diff > 0 ? '+' : ''}${r.diff}</td>
      <td>${statusLabel(r.status, r.diff)}</td>
      <td class="obs-cell">___________________________</td>
    </tr>`).join('')}
    <tr class="total-row">
      <td colspan="3" style="font-weight:bold">TOTAL</td>
      <td style="text-align:center;font-weight:bold">${totalTeo}</td>
      <td style="text-align:center;font-weight:bold">${totalFis}</td>
      <td style="text-align:center" class="${totalDiff < 0 ? 'diff-neg' : totalDiff > 0 ? 'diff-pos' : 'diff-zero'}">${totalDiff > 0 ? '+' : ''}${totalDiff}</td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>

<div class="footer">
  Conteo Cíclico Pro v4.0 &nbsp;·&nbsp; ${new Date().toLocaleDateString('es-MX')} &nbsp;·&nbsp; ${rowsToPrint.length} artículo(s) &nbsp;·&nbsp; Firmado: ________________
</div>
</body>
</html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            win.focus();
            setTimeout(() => { win.print(); }, 300);
        }
    };

    // Simplificado: only rows that have at least 1 scan (fis > 0)
    // Simplificado: artículos con al menos 1 escaneo, respetando el filtro activo
    const simplificadoRows = useMemo(() => {
        const base = filter === 'all' || filter === 'ajustes'
            ? report.rows
            : report.rows.filter(r => r.status === filter);
        return base.filter(r => r.fis > 0).sort((a, b) => a.diff - b.diff);
    }, [report.rows, filter]);
    const simplificadoMissing = simplificadoRows.filter(r => r.status === 'faltante').reduce((a, r) => a + Math.abs(r.diff), 0);
    const simplificadoSobrante = simplificadoRows.filter(r => r.status === 'sobrante').reduce((a, r) => a + r.diff, 0);
    const simplificadoOk = simplificadoRows.filter(r => r.status === 'ok').length;

    if (!folio) return <div className="text-center py-12 text-slate-400"><BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-30" /><p>Abre un inventario para ver el reporte</p><button onClick={() => onTabChange('folio')} className="mt-3 text-sm text-sky-500 underline">Ir a Inventarios →</button></div>;

    const printDate = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' });

    return (
        <div className="space-y-4">
            {/* ── PRINTABLE REPORT (hidden on screen, visible on print) ── */}
            <div id="print-report" style={{ display: 'none' }}>
                {/* Header */}
                <div style={{ borderBottom: '3px solid #0ea5e9', paddingBottom: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#0f172a', margin: 0 }}>
                                Reporte {printMode === 'simplificado' ? 'Simplificado' : 'Completo'} — Inventario Cíclico
                            </h1>
                            <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{folio.name} · {folio.almacen}{folio.temporada ? ` · ${folio.temporada}` : ''}</p>
                            {printMode === 'simplificado' && (
                                <p style={{ fontSize: 11, color: '#f59e0b', margin: '4px 0 0', fontStyle: 'italic' }}>
                                    Solo modelos escaneados al menos una vez · Modelos sin escaneo excluidos
                                </p>
                            )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: 0 }}>Conteo Cíclico Pro v4.0</p>
                            <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0' }}>{printDate}</p>
                        </div>
                    </div>
                </div>

                {/* Summary boxes */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
                    {printMode === 'completo' ? (
                        <>
                            {[
                                { label: 'Cobertura', value: `${Math.round(coveragePct)}%`, color: coveragePct >= 100 ? '#10b981' : coveragePct >= 70 ? '#f59e0b' : '#ef4444' },
                                { label: 'Teórico', value: String(report.totalItems), color: '#0f172a' },
                                { label: 'Físico', value: String(report.scannedItems), color: '#0ea5e9' },
                                { label: 'Faltantes', value: `-${report.missingItems}`, color: '#ef4444' },
                                { label: 'Sobrantes', value: `+${report.sobranteItems}`, color: '#10b981' },
                                { label: 'SKUs OK', value: String(report.rows.filter(r => r.status === 'ok').length), color: '#10b981' },
                            ].map(item => (
                                <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', minWidth: 80, textAlign: 'center' }}>
                                    <p style={{ fontSize: 18, fontWeight: 'bold', color: item.color, margin: 0 }}>{item.value}</p>
                                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', textTransform: 'uppercase' }}>{item.label}</p>
                                </div>
                            ))}
                        </>
                    ) : (
                        <>
                            {[
                                { label: 'SKUs escaneados', value: String(simplificadoRows.length), color: '#0ea5e9' },
                                { label: 'Faltantes', value: `-${simplificadoMissing}`, color: '#ef4444' },
                                { label: 'Sobrantes', value: `+${simplificadoSobrante}`, color: '#10b981' },
                                { label: 'Completos', value: String(simplificadoOk), color: '#10b981' },
                                { label: 'Con diferencia', value: String(simplificadoRows.filter(r => r.status !== 'ok').length), color: '#f59e0b' },
                            ].map(item => (
                                <div key={item.label} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 14px', minWidth: 80, textAlign: 'center' }}>
                                    <p style={{ fontSize: 18, fontWeight: 'bold', color: item.color, margin: 0 }}>{item.value}</p>
                                    <p style={{ fontSize: 10, color: '#94a3b8', margin: '2px 0 0', textTransform: 'uppercase' }}>{item.label}</p>
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Area distribution */}
                {areaChart.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>Distribución por Área</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {areaChart.map(({ area, count }) => (
                                <div key={area} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 10px', fontSize: 11 }}>
                                    <span style={{ fontWeight: 'bold' }}>{area}</span>: {count} escaneos
                                </div>
                            ))}
                        </div>
                    </div>
                )}



                {/* Buscador + Ordenar */}
                {filter !== 'ajustes' && (
                <div className="px-3 py-2 border-b dark:border-slate-700 space-y-2">
                    {/* Buscador */}
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="w-full pl-8 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-800 border dark:border-slate-600 rounded-xl focus:outline-none focus:border-sky-400 dark:text-white placeholder-slate-400"
                            placeholder="Buscar modelo o color..."
                            value={searchMod}
                            onChange={e => setSearchMod(e.target.value)}
                        />
                        {searchMod && (
                            <button onClick={() => setSearchMod('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-lg leading-none">
                                ×
                            </button>
                        )}
                    </div>
                    {/* Filtros adicionales: talla y color */}
                    <div className="flex gap-2">
                        <select
                            className="flex-1 py-1.5 px-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border dark:border-slate-600 dark:text-white"
                            value={filterTalla}
                            onChange={e => setFilterTalla(e.target.value)}
                        >
                            <option value="">Todas las tallas</option>
                            {[...new Set(report.rows.map(r => formatTallaConCategoria(r.talla, r.vkey)))].sort().map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                        <select
                            className="flex-1 py-1.5 px-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border dark:border-slate-600 dark:text-white"
                            value={filterColor}
                            onChange={e => setFilterColor(e.target.value)}
                        >
                            <option value="">Todos los colores</option>
                            {[...new Set(report.rows.map(r => r.color))].sort().map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    </div>

                    {/* Ordenar */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">Ordenar:</span>
                        <div className="flex gap-1 flex-1">
                            <button onClick={() => setSortBy('mod')}
                                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${sortBy === 'mod' ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                Modelo
                            </button>
                            <button onClick={() => setSortBy('diff')}
                                className={`flex-1 py-1 rounded-lg text-xs font-medium transition-colors ${sortBy === 'diff' ? 'bg-sky-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                Diferencia
                            </button>
                        </div>
                        <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-colors hover:bg-slate-200 dark:hover:bg-slate-600 flex-shrink-0"
                            title={sortDir === 'asc' ? 'Ascendente' : 'Descendente'}>
                            {sortDir === 'asc' ? '↑ ASC' : '↓ DESC'}
                        </button>
                    </div>
                    {searchMod && (
                        <p className="text-xs text-slate-400">
                            {filtered.length} resultado(s) para <strong className="text-slate-600 dark:text-slate-300">"{searchMod}"</strong>
                        </p>
                    )}
                </div>
                )}

                {/* Main tabla */}
                {filter !== 'ajustes' && (
                <div>
                <table>
                    <thead>
                        <tr>
                            {['Modelo', 'Color', 'Talla', 'Teórico', 'Físico', 'Dif.', 'Estado', 'Áreas'].map(h => (
                                <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, fontWeight: 'bold', background: '#1e293b', color: 'white' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((r, i) => (
                            <tr key={r.vkey} className={r.status} style={{ background: i % 2 === 0 ? '#f8fafc' : 'white' }}>
                                <td style={{ padding: '5px 8px', fontSize: 10, fontWeight: 'bold', color: '#0f172a' }}>{r.mod}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, color: '#475569' }}>{r.color}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, color: '#475569', textAlign: 'center' }}>{formatTallaConCategoria(r.talla, r.vkey)}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, textAlign: 'center', color: '#0f172a' }}>{r.teo}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, textAlign: 'center', color: '#0ea5e9', fontWeight: 'bold' }}>{r.fis}</td>
                                <td style={{ padding: '5px 8px', fontSize: 10, textAlign: 'center', fontWeight: 'bold', color: r.diff < 0 ? '#ef4444' : r.diff > 0 ? '#10b981' : '#94a3b8' }}>
                                    {r.diff > 0 ? '+' : ''}{r.diff}
                                </td>
                                <td style={{ padding: '5px 8px', fontSize: 10 }}>
                                    <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 'bold', background: r.status === 'ok' ? '#d1fae5' : r.status === 'faltante' ? '#fee2e2' : '#fef3c7', color: r.status === 'ok' ? '#065f46' : r.status === 'faltante' ? '#991b1b' : '#92400e' }}>
                                        {r.status.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '5px 8px', fontSize: 9, color: '#94a3b8' }}>
                                    {Object.entries(r.areaMap).map(([a, c]) => `${a}:${c}`).join(' ')}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Footer */}
                <div style={{ borderTop: '1px solid #e2e8f0', marginTop: 20, paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8' }}>
                    <span>Conteo Cíclico Pro v4.0 · Firebase Sync</span>
                    <span>{printMode === 'simplificado' ? `SKUs escaneados: ${simplificadoRows.length}` : `Total SKUs: ${report.rows.length}`} · Escaneos: {scans.length}</span>
                    <span>{printDate}</span>
                </div>
                </div>
                )}
            </div>

            {/* ── SCREEN UI ── */}
            <div className="grid grid-cols-2 gap-3 no-print">
                <div className="bg-white rounded-xl p-4 shadow-sm border text-center"><CoverageRing pct={coveragePct} size={70} /><p className="text-xs text-slate-500 mt-1">Cobertura</p></div>
                <div className="space-y-2">
                    <div className="bg-white rounded-xl p-3 shadow-sm border flex justify-between items-center"><div><p className="text-xs text-slate-400">Teórico</p><p className="font-bold text-slate-700">{report.totalItems}</p></div><Package size={18} className="text-slate-300" /></div>
                    <div className="bg-white rounded-xl p-3 shadow-sm border flex justify-between items-center"><div><p className="text-xs text-slate-400">Físico</p><p className="font-bold text-sky-600">{report.scannedItems}</p></div><Check size={18} className="text-emerald-300" /></div>
                    <div className="bg-red-50 rounded-xl p-3 border border-red-100 flex justify-between items-center"><div><p className="text-xs text-red-400">Faltantes</p><p className="font-bold text-red-600">{report.missingItems}</p></div><AlertTriangle size={18} className="text-red-300" /></div>
                </div>
            </div>



            {areaChart.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm border no-print">
                    <p className="text-xs font-bold text-slate-600 uppercase mb-3">Escaneos por Área</p>
                    {areaChart.map(({ area, count }) => (
                        <div key={area} className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-600 w-20 truncate">{area}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-4"><div className="h-4 bg-sky-400 rounded-full" style={{ width: `${(count / areaChart[0].count) * 100}%` }} /></div>
                            <span className="text-xs font-bold text-slate-600 w-8 text-right">{count}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Panel de acciones colapsable ── */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden no-print">

                {/* Fila 1: Vista */}
                <div className="border-b">
                    <div className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            <Package size={15} /> Reporte
                        </div>

                    </div>
                </div>

                {/* Filtros */}
                <div className="border-b">
                    <div className="flex overflow-x-auto">
                        {([
                            { key: 'all',      label: 'Todos',    count: report.rows.length,                                        color: 'text-slate-600 dark:text-slate-300', active: 'border-slate-800 dark:border-slate-200 text-slate-800 dark:text-white' },
                            { key: 'faltante', label: 'Faltante', count: report.rows.filter(r => r.status === 'faltante').length,   color: 'text-red-500',    active: 'border-red-500 text-red-600' },
                            { key: 'sobrante', label: 'Sobrante', count: report.rows.filter(r => r.status === 'sobrante').length,   color: 'text-emerald-500',active: 'border-emerald-500 text-emerald-600' },
                            { key: 'parcial',  label: 'Parcial',  count: report.rows.filter(r => r.status === 'parcial').length,    color: 'text-orange-500', active: 'border-orange-500 text-orange-600' },
                            { key: 'ok',       label: 'OK',       count: report.rows.filter(r => r.status === 'ok').length,         color: 'text-slate-400',  active: 'border-slate-500 text-slate-600' },
                            { key: 'ajustes',  label: 'Ajustes',  count: ajustesSugeridos.length,                                  color: 'text-amber-500',  active: 'border-amber-500 text-amber-600' },
                        ] as const).map(({ key, label, count, color, active }) => (
                            <button key={key} onClick={() => { setFilter(key as any); setSearchMod(''); setSortBy('diff'); setSortDir('asc'); setFilterTalla(''); setFilterColor(''); }}
                                className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                                    filter === key
                                        ? active
                                        : `border-transparent ${color} hover:bg-slate-50 dark:hover:bg-slate-800`
                                }`}>
                                <span className="text-sm font-bold">{count}</span>
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Botón único Imprimir / Exportar */}
                <div className="border-t">
                    <button
                        onClick={() => setShowPrintModal(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <Printer size={16} />
                        Imprimir / Exportar
                        <ChevronUp size={14} className="text-slate-400" />
                    </button>
                </div>

                {/* Modal de impresión */}
                {showPrintModal && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowPrintModal(false)}>
                        <div className="w-full bg-white dark:bg-slate-900 rounded-t-3xl border-t dark:border-slate-700 pb-8" onClick={e => e.stopPropagation()}>
                            {/* Handle */}
                            <div className="flex justify-center pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
                            </div>

                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b dark:border-slate-700">
                                <p className="font-semibold text-slate-800 dark:text-white">¿Qué deseas imprimir?</p>
                                <button onClick={() => setShowPrintModal(false)} className="text-slate-400 text-2xl leading-none">×</button>
                            </div>

                            {/* Filtro activo */}
                            {filter !== 'all' && (
                                <div className="mx-5 mt-3 bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span>🔽</span>
                                    <span>Filtro activo: <strong className="text-slate-700 dark:text-slate-200">{
                                        filter === 'faltante' ? `Faltantes (${filtered.length})` :
                                        filter === 'sobrante' ? `Sobrantes (${filtered.length})` :
                                        filter === 'ok' ? `Sin diferencia (${filtered.length})` :
                                        `Parciales (${filtered.length})`
                                    }</strong></span>
                                </div>
                            )}

                            {/* Opciones */}
                            <div className="mt-2">
                                    {/* Indicador de lo que se imprimirá */}
                                <div className="mx-5 mb-2 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">
                                    Vista activa: <strong className="text-slate-700 dark:text-slate-200">{
                                        filter === 'all' ? `Todos (${report.rows.length})` :
                                        filter === 'faltante' ? `Faltantes (${filtered.length})` :
                                        filter === 'sobrante' ? `Sobrantes (${filtered.length})` :
                                        filter === 'ok' ? `OK (${filtered.length})` :
                                        filter === 'parcial' ? `Parciales (${filtered.length})` :
                                        `Ajustes posibles (${ajustesSugeridos.length})`
                                    }</strong>
                                </div>

                                {/* Opción 1: Completo — imprime lo que está viendo */}
                                <button onClick={() => { setShowPrintModal(false); handlePrint(filter === 'ajustes' ? 'ajustes' : 'completo'); }}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b dark:border-slate-700">
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                                        <Printer size={20} className="text-slate-600 dark:text-slate-300" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">Completo</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {filter === 'ajustes' ? `${ajustesSugeridos.length} ajuste(s) con espacio para observaciones` :
                                             filter === 'all' ? `${report.rows.length} artículos` :
                                             `${filtered.length} artículos del filtro activo`}
                                        </p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300" />
                                </button>

                                {/* Opción 2: Simplificado — solo si no es ajustes */}
                                {filter !== 'ajustes' && (
                                <button onClick={() => { setShowPrintModal(false); handlePrint('simplificado'); }}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b dark:border-slate-700">
                                    <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center flex-shrink-0">
                                        <FileText size={20} className="text-sky-500" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">Simplificado</p>
                                        <p className="text-xs text-slate-400 mt-0.5">{simplificadoRows.length} artículo(s) con al menos 1 escaneo</p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300" />
                                </button>
                                )}

                                {/* Opción 3: Exportar Excel */}
                                <button onClick={() => { setShowPrintModal(false); exportExcel(); }}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                                        <Download size={20} className="text-emerald-500" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">Exportar Excel <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold ml-1">.xls</span></p>
                                        <p className="text-xs text-slate-400 mt-0.5">Con colores por estado · faltante, sobrante, parcial</p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300" />
                                </button>

                                {/* Opción 4: Exportar CSV */}
                                <button onClick={() => { setShowPrintModal(false); exportCSV(); }}
                                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                        <Download size={20} className="text-slate-400" />
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white">Exportar CSV</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Datos planos para Google Sheets u otras herramientas</p>
                                    </div>
                                    <ChevronRight size={16} className="text-slate-300" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Vista Ajustes Posibles */}
            {vista === 'ajustes' && (
            <div className="space-y-3 no-print">
                {ajustesSugeridos.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 bg-white rounded-xl border">
                        <p className="font-semibold">Sin ajustes posibles</p>
                        <p className="text-xs mt-1">No hay sobrantes y faltantes compensables en el mismo modelo</p>
                    </div>
                ) : (
                    <>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                            <p className="text-xs text-amber-700 font-semibold">Estos son ajustes <span className="font-bold">sugeridos</span> — indican que un sobrante de un modelo podría compensar un faltante del mismo modelo en distinta talla o color. Verifica físicamente antes de aplicar.</p>
                        </div>
                        {ajustesSugeridos.map((a, i) => (
                            <div key={i} className="bg-white rounded-xl border shadow-sm overflow-hidden">
                                <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${a.tipo === 'talla' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                                    {a.tipo === 'talla' ? '↕ Ajuste de talla' : '🎨 Ajuste de color'} · {a.mod} · {a.piezas} {a.piezas === 1 ? 'pieza' : 'piezas'}
                                </div>
                                <div className="grid grid-cols-2 divide-x">
                                    <div className="p-3">
                                        <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Sobrante</p>
                                        <p className="text-sm font-semibold text-slate-700">{a.sobrante.color}</p>
                                        <p className="text-xs text-slate-500">Talla {formatTallaFromVkey(a.sobrante.talla, a.sobrante.vkey)}</p>
                                        <p className="text-lg font-bold text-emerald-600 mt-1">+{a.sobrante.exceso}</p>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-[10px] text-red-500 font-bold uppercase mb-1">Faltante</p>
                                        <p className="text-sm font-semibold text-slate-700">{a.faltante.color}</p>
                                        <p className="text-xs text-slate-500">Talla {formatTallaFromVkey(a.faltante.talla, a.faltante.vkey)}</p>
                                        <p className="text-lg font-bold text-red-500 mt-1">-{a.faltante.falta}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}
            </div>
            )}


            {/* Vista ajustes posibles en pantalla — listado de tabla */}
            {filter === 'ajustes' && (
            <div className="space-y-3 no-print">
                {/* Resumen */}
                <div className="grid grid-cols-4 gap-2">
                    {[
                        { val: ajustesSugeridos.length,                                         lbl: 'Total ajustes',  cls: 'text-amber-500' },
                        { val: ajustesSugeridos.filter(a => a.tipo === 'talla').length,         lbl: 'Por talla',      cls: 'text-sky-500' },
                        { val: ajustesSugeridos.filter(a => a.tipo === 'color').length,         lbl: 'Por color',      cls: 'text-purple-500' },
                        { val: ajustesSugeridos.reduce((s, a) => s + a.piezas, 0),             lbl: 'Piezas a mover', cls: 'text-amber-500' },
                    ].map(({ val, lbl, cls }) => (
                        <div key={lbl} className="bg-white border rounded-xl p-3 text-center shadow-sm">
                            <p className={`text-xl font-bold ${cls}`}>{val}</p>
                            <p className="text-[10px] text-slate-400 uppercase font-semibold mt-0.5">{lbl}</p>
                        </div>
                    ))}
                </div>

                {/* Barra de búsqueda y filtros */}
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        value={ajusteSearch}
                        onChange={e => setAjusteSearch(e.target.value)}
                        placeholder="Buscar modelo…"
                        className="flex-1 text-sm border rounded-lg px-3 py-2 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    {(['all', 'talla', 'color'] as const).map(t => (
                        <button key={t} onClick={() => setAjusteTipoFil(t)}
                            className={`px-3 py-2 text-xs font-bold rounded-lg border transition-colors ${
                                ajusteTipoFil === t
                                    ? t === 'talla' ? 'bg-sky-100 border-sky-400 text-sky-700'
                                    : t === 'color' ? 'bg-purple-100 border-purple-400 text-purple-700'
                                    : 'bg-amber-100 border-amber-400 text-amber-700'
                                    : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}>
                            {t === 'all' ? 'Todos' : t === 'talla' ? 'Talla' : 'Color'}
                        </button>
                    ))}
                    <button onClick={printAjustes}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors whitespace-nowrap">
                        <Printer size={13} /> Imprimir
                    </button>
                </div>

                {/* Tabla */}
                {ajustesFiltrados.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 bg-white rounded-xl border">
                        <p className="font-medium">{ajustesSugeridos.length === 0 ? 'Sin ajustes posibles' : 'Sin resultados'}</p>
                        <p className="text-xs mt-1">{ajustesSugeridos.length === 0 ? 'No hay sobrantes y faltantes compensables en el mismo modelo' : 'Intenta con otro filtro o búsqueda'}</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
                        <table className="w-full text-sm min-w-[600px]">
                            <thead className="bg-slate-50 border-b">
                                <tr>
                                    <th className="px-3 py-2.5 text-left text-slate-400 font-semibold w-8">#</th>
                                    <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Modelo</th>
                                    <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Tipo</th>
                                    <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Sobrante</th>
                                    <th className="px-1 py-2.5 text-center text-slate-300 w-6"></th>
                                    <th className="px-3 py-2.5 text-left text-slate-500 font-semibold">Faltante</th>
                                    <th className="px-3 py-2.5 text-center text-slate-500 font-semibold w-14">Piezas</th>
                                    <th className="px-3 py-2.5 text-center text-slate-400 font-semibold w-10">✓</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {ajustesFiltrados.map((a, i) => (
                                    <tr key={i} className={`transition-colors ${ajusteChecked.has(i) ? 'bg-slate-50 opacity-50' : 'hover:bg-amber-50/40'}`}>
                                        <td className="px-3 py-2.5 text-slate-400 text-center">{i + 1}</td>
                                        <td className="px-3 py-2.5 font-bold text-slate-800">{a.mod}</td>
                                        <td className="px-3 py-2.5">
                                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${a.tipo === 'talla' ? 'bg-sky-100 text-sky-700' : 'bg-purple-100 text-purple-700'}`}>
                                                {a.tipo === 'talla' ? 'Talla' : 'Color'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-emerald-700 font-semibold">{a.sobrante.color}</span>
                                            <span className="text-slate-300 mx-1">·</span>
                                            <span className="text-emerald-600">T{formatTallaFromVkey(a.sobrante.talla, a.sobrante.vkey)}</span>
                                            <span className="text-emerald-600 font-bold ml-1">+{a.sobrante.exceso}</span>
                                        </td>
                                        <td className="px-1 py-2.5 text-slate-300 text-center font-bold">→</td>
                                        <td className="px-3 py-2.5">
                                            <span className="text-red-700 font-semibold">{a.faltante.color}</span>
                                            <span className="text-slate-300 mx-1">·</span>
                                            <span className="text-red-600">T{formatTallaFromVkey(a.faltante.talla, a.faltante.vkey)}</span>
                                            <span className="text-red-600 font-bold ml-1">-{a.faltante.falta}</span>
                                        </td>
                                        <td className="px-3 py-2.5 text-center font-bold text-amber-600">{a.piezas}</td>
                                        <td className="px-3 py-2.5 text-center">
                                            <input type="checkbox" checked={ajusteChecked.has(i)} onChange={e => {
                                                const n = new Set(ajusteChecked);
                                                if (e.target.checked) n.add(i); else n.delete(i);
                                                setAjusteChecked(n);
                                            }} className="w-4 h-4 accent-emerald-500 cursor-pointer" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            )}
            {/* Rows list */}
            {vista === 'reporte' && filter !== 'ajustes' && (
            <div className="space-y-1 no-print">
                {filtered.map(r => (
                    <div key={r.vkey} className="bg-white rounded-xl border overflow-hidden shadow-sm">
                        <button onClick={() => setExpandedKey(expandedKey === r.vkey ? null : r.vkey)} className="w-full text-left px-4 py-3 flex items-center gap-2">
                            <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-800 truncate">{r.mod}</p><p className="text-xs text-slate-500">{r.color} · Talla {formatTallaConCategoria(r.talla, r.vkey)}</p></div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-sm font-bold text-slate-700"><span className="text-sky-600">{r.fis}</span><span className="text-slate-300">/</span><span className="text-slate-500">{r.teo}</span></span>
                                <span className={`text-sm font-bold w-8 text-right ${r.diff < 0 ? 'text-red-500' : r.diff > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>{r.diff > 0 ? '+' : ''}{r.diff}</span>
                                <div className={`w-2.5 h-2.5 rounded-full ${r.status === 'ok' ? 'bg-emerald-400' : r.status === 'faltante' ? 'bg-red-400' : r.status === 'parcial' ? 'bg-orange-400' : 'bg-amber-400'}`} />
                                {expandedKey === r.vkey ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                            </div>
                        </button>
                        {expandedKey === r.vkey && Object.keys(r.areaMap).length > 0 && (
                            <div className="border-t bg-slate-50 px-4 py-2">
                                {Object.entries(r.areaMap).map(([a, c]) => <div key={a} className="flex justify-between text-xs text-slate-600 py-0.5"><span>{a}</span><span className="font-bold">{c as number}</span></div>)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            )}
        </div>
    );
};

