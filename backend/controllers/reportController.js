const pool = require('../config/database');
const ExcelJS = require('exceljs');

exports.getDashboardStats = async (req, res) => {
  try {
    const lugaresResult = await pool.query('SELECT COUNT(*) AS total FROM lugares_camping');
    const reservasResult = await pool.query('SELECT COUNT(*) AS total FROM reservas');
    const usuariosResult = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
    const clubsResult = await pool.query('SELECT COUNT(*) AS total FROM clubs');
    const pendientesResult = await pool.query("SELECT COUNT(*) AS total FROM lugares_camping WHERE estado = 'pendiente'");

    res.json({
      success: true,
      stats: {
        total_lugares: parseInt(lugaresResult.rows[0].total),
        total_reservas: parseInt(reservasResult.rows[0].total),
        total_usuarios: parseInt(usuariosResult.rows[0].total),
        total_clubs: parseInt(clubsResult.rows[0].total),
        lugares_pendientes: parseInt(pendientesResult.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error en reporte dashboard:', error);
    res.status(500).json({ success: false, error: 'Error al generar reporte' });
  }
};

exports.getLugaresPopulares = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.id, l.nombre, l.direccion,
             (SELECT COUNT(*) FROM reservas r WHERE r.lugar_id = l.id AND r.estado <> 'cancelada') AS total_reservas,
             COALESCE((SELECT AVG(res.calificacion) FROM resenas res WHERE res.lugar_id = l.id), 0)::numeric(3,2) AS promedio_calificacion
      FROM lugares_camping l
      ORDER BY total_reservas DESC, promedio_calificacion DESC
      LIMIT 10
    `);
    res.json({ success: true, lugares: result.rows });
  } catch (error) {
    console.error('Error en reporte lugares populares:', error);
    res.status(500).json({ success: false, error: 'Error al generar reporte' });
  }
};

exports.getReservasPorMes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT TO_CHAR(fecha_inicio, 'YYYY-MM') AS mes, COUNT(*) AS total
      FROM reservas
      WHERE estado NOT IN ('cancelada')
      GROUP BY TO_CHAR(fecha_inicio, 'YYYY-MM')
      ORDER BY mes DESC
      LIMIT 12
    `);
    res.json({ success: true, reservas: result.rows });
  } catch (error) {
    console.error('Error en reporte reservas por mes:', error);
    res.status(500).json({ success: false, error: 'Error al generar reporte' });
  }
};

exports.getReservasPorZona = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.zona, COUNT(r.id) AS total_reservas
      FROM reservas r
      LEFT JOIN lugares_camping l ON r.lugar_id = l.id
      LEFT JOIN clubs c ON r.club_id = c.id
      LEFT JOIN iglesias i ON c.iglesia_id = i.id
      GROUP BY i.zona
      ORDER BY total_reservas DESC
    `);
    res.json({ success: true, reservas: result.rows });
  } catch (error) {
    console.error('Error en reporte reservas por zona:', error);
    res.status(500).json({ success: false, error: 'Error al generar reporte' });
  }
};

exports.exportarLugaresExcel = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.nombre, l.direccion, l.estado, l.capacidad_maxima, l.precio_aprox,
             u.nombre AS creador,
             COALESCE((SELECT AVG(calificacion) FROM resenas WHERE lugar_id = l.id), 0)::numeric(3,2) AS promedio
      FROM lugares_camping l
      LEFT JOIN usuarios u ON l.creado_por = u.id
      ORDER BY l.created_at DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Lugares');
    sheet.columns = [
      { header: 'Nombre del lugar', key: 'nombre', width: 30 },
      { header: 'Dirección', key: 'direccion', width: 38 },
      { header: 'Estado', key: 'estado', width: 16 },
      { header: 'Capacidad máxima', key: 'capacidad_maxima', width: 20 },
      { header: 'Precio aproximado (Bs.)', key: 'precio_aprox', width: 24 },
      { header: 'Registrado por', key: 'creador', width: 24 },
      { header: 'Calificación promedio', key: 'promedio', width: 22 }
    ];
    sheet.addRows(result.rows);
    sheet.getRow(1).font = { bold: true };
    const file = await workbook.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="reporte-lugares.xlsx"');
    res.send(Buffer.from(file));
  } catch (error) {
    console.error('Error exportando Excel:', error);
    res.status(500).json({ success: false, error: 'Error al exportar reporte Excel' });
  }
};
