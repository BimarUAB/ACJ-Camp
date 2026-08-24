const pool = require('../config/database');

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
      SELECT l.id, l.nombre, l.direccion, COUNT(r.id) AS total_reservas,
             COALESCE(AVG(res.calificacion), 0)::numeric(3,2) AS promedio_calificacion
      FROM lugares_camping l
      LEFT JOIN reservas r ON l.id = r.lugar_id
      LEFT JOIN resenas res ON l.id = res.lugar_id
      GROUP BY l.id, l.nombre, l.direccion
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

exports.exportarLugaresCSV = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.nombre, l.direccion, l.estado, l.capacidad_maxima, l.precio_aprox,
             u.nombre AS creador,
             COALESCE((SELECT AVG(calificacion) FROM resenas WHERE lugar_id = l.id), 0)::numeric(3,2) AS promedio
      FROM lugares_camping l
      LEFT JOIN usuarios u ON l.creado_por = u.id
      ORDER BY l.created_at DESC
    `);

    const headers = ['nombre', 'direccion', 'estado', 'capacidad_maxima', 'precio_aprox', 'creador', 'promedio'];
    const rows = result.rows.map(row => headers.map(h => `"${String(row[h] || '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=lugares.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exportando CSV:', error);
    res.status(500).json({ success: false, error: 'Error al exportar CSV' });
  }
};
