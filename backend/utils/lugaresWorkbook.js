const ExcelJS = require('exceljs');

const createLugaresWorkbook = (lugares, generatedAt = new Date()) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ACJ-Camp';
  workbook.created = generatedAt;
  workbook.title = 'Reporte de lugares de campamento';
  const sheet = workbook.addWorksheet('Lugares', {
    properties: { defaultRowHeight: 24, tabColor: { argb: 'FF244936' } },
    views: [{ state: 'frozen', ySplit: 7, showGridLines: false }],
    pageSetup: {
      paperSize: 9, orientation: 'landscape', fitToPage: true,
      fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:7',
      margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    },
  });
  sheet.columns = [
    { key: 'nombre', width: 32 }, { key: 'direccion', width: 44 },
    { key: 'estado', width: 17 }, { key: 'capacidad_maxima', width: 18 },
    { key: 'precio_aprox', width: 22 }, { key: 'creador', width: 28 },
    { key: 'promedio', width: 20 },
  ];
  const banner = (range, text, background, foreground, size) => {
    sheet.mergeCells(range);
    const cell = sheet.getCell(range.split(':')[0]);
    cell.value = text;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: background } };
    cell.font = { name: 'Calibri', size, bold: true, color: { argb: foreground } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1, wrapText: true };
  };
  banner('A1:G1', 'ACJ-CAMP  |  REPORTE DE LUGARES', 'FF244936', 'FFFFFFFF', 22);
  sheet.getRow(1).height = 48;
  banner('A2:G2', `Generado: ${generatedAt.toLocaleString('es-BO', { timeZone: 'America/La_Paz' })} · Hora de Bolivia`, 'FFEDF2ED', 'FF244936', 11);
  sheet.getRow(2).height = 28;
  banner('A4:B4', `TOTAL DE LUGARES: ${lugares.length}`, 'FF244936', 'FFFFFFFF', 12);
  banner('C4:D4', `ACTIVOS: ${lugares.filter((l) => l.estado === 'activo').length}`, 'FFDCF0E2', 'FF245C36', 12);
  banner('E4:G4', `PENDIENTES: ${lugares.filter((l) => l.estado === 'pendiente').length}   |   INACTIVOS: ${lugares.filter((l) => l.estado === 'inactivo').length}`, 'FFFFF0CF', 'FF775719', 12);
  sheet.getRow(4).height = 34;
  banner('A5:G5', 'Precio referencial en bolivianos · Calificación de 0 a 5 · — indica un dato no registrado', 'FFFFFFFF', 'FF647067', 10);
  sheet.getRow(5).height = 26;
  const header = sheet.getRow(7);
  header.values = ['Nombre del lugar', 'Dirección', 'Estado', 'Capacidad máxima', 'Precio aprox. (Bs.)', 'Registrado por', 'Calificación / 5'];
  header.height = 34;
  header.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF244936' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FFC9A45E' } } };
  });
  const states = {
    activo: ['Activo', 'FFDCF0E2', 'FF245C36'],
    pendiente: ['Pendiente', 'FFFFF0CF', 'FF775719'],
    inactivo: ['Inactivo', 'FFF7E2DE', 'FF913D30'],
  };
  const numberOrMissing = (value) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value);
  lugares.forEach((lugar, index) => {
    const state = states[lugar.estado] || [lugar.estado || '—', 'FFEDF2ED', 'FF244936'];
    const row = sheet.addRow({
      nombre: lugar.nombre || '—', direccion: lugar.direccion || '—', estado: state[0],
      capacidad_maxima: numberOrMissing(lugar.capacidad_maxima),
      precio_aprox: numberOrMissing(lugar.precio_aprox), creador: lugar.creador || '—',
      promedio: numberOrMissing(lugar.promedio),
    });
    row.height = Math.max(42, Math.min(150, Math.max(...[lugar.nombre, lugar.direccion, lugar.creador].map((value, i) => {
      const width = [30, 42, 26][i];
      return String(value || '').split('\n').reduce((lines, line) => lines + Math.max(1, Math.ceil(line.length / width)), 0);
    })) * 16 + 12));
    row.eachCell((cell, col) => {
      cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF26342B' }, bold: col === 1 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 ? 'FFF0F5F0' : 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: [3, 4, 7].includes(col) ? 'center' : col === 5 ? 'right' : 'left' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFDCE5DC' } } };
    });
    row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: state[1] } };
    row.getCell(3).font = { name: 'Calibri', size: 11, bold: true, color: { argb: state[2] } };
    row.getCell(4).numFmt = '#,##0';
    row.getCell(5).numFmt = '"Bs." #,##0.00';
    row.getCell(7).numFmt = '0.00';
  });
  sheet.autoFilter = { from: 'A7', to: `G${Math.max(7, sheet.rowCount)}` };
  sheet.pageSetup.printArea = `A1:G${Math.max(7, sheet.rowCount)}`;
  sheet.headerFooter.oddFooter = '&LACJ-Camp · Reporte administrativo&RPágina &P de &N';
  return workbook;
};

module.exports = { createLugaresWorkbook };
