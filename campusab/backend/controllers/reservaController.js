const pool = require('../config/database');

const isAdmin = (req) => req.user?.rol === 'admin';
const isDirectorOrAdmin = (req) => req.user?.rol === 'director' || isAdmin(req);

const hayConflictoReserva = async (lugarId, fechaInicio, fechaFin, excludeId = null) => {
  const query = `
    SELECT id FROM reservas
    WHERE lugar_id = $1
      AND estado NOT IN ('cancelada')
      AND fecha_inicio <= $2
      AND fecha_fin >= $3
      ${excludeId ? 'AND id != $4' : ''}
  `;
  const params = [lugarId, fechaFin, fechaInicio];
  if (excludeId) params.push(excludeId);
  const result = await pool.query(query, params);
  return result.rows.length > 0;
};

exports.getAllReservas = async (req, res) => {
  try {
    const { lugar_id, estado, club_id } = req.query;
    let conditions = [];
    let params = [];
    let paramCount = 0;

    if (lugar_id) {
      conditions.push(`r.lugar_id = $${++paramCount}`);
      params.push(lugar_id);
    }
    if (estado) {
      conditions.push(`r.estado = $${++paramCount}`);
      params.push(estado);
    }
    if (club_id) {
      conditions.push(`r.club_id = $${++paramCount}`);
      params.push(club_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT r.*, l.nombre AS lugar_nombre, c.nombre AS club_nombre, u.nombre AS usuario_nombre
      FROM reservas r
      LEFT JOIN lugares_camping l ON r.lugar_id = l.id
      LEFT JOIN clubs c ON r.club_id = c.id
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      ${whereClause}
      ORDER BY r.fecha_inicio DESC
    `, params);

    res.json({ success: true, count: result.rows.length, reservas: result.rows });
  } catch (error) {
    console.error('Error listando reservas:', error);
    res.status(500).json({ success: false, error: 'Error al listar reservas' });
  }
};

exports.getMyReservas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, l.nombre AS lugar_nombre, c.nombre AS club_nombre
      FROM reservas r
      LEFT JOIN lugares_camping l ON r.lugar_id = l.id
      LEFT JOIN clubs c ON r.club_id = c.id
      WHERE r.usuario_id = $1
      ORDER BY r.fecha_inicio DESC
    `, [req.user.id]);

    res.json({ success: true, count: result.rows.length, reservas: result.rows });
  } catch (error) {
    console.error('Error listando mis reservas:', error);
    res.status(500).json({ success: false, error: 'Error al listar reservas' });
  }
};

exports.getReservasByLugar = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT r.id, r.fecha_inicio, r.fecha_fin, r.estado, r.proposito, c.nombre AS club_nombre
      FROM reservas r
      LEFT JOIN clubs c ON r.club_id = c.id
      WHERE r.lugar_id = $1 AND r.estado NOT IN ('cancelada')
      ORDER BY r.fecha_inicio ASC
    `, [id]);

    res.json({ success: true, reservas: result.rows });
  } catch (error) {
    console.error('Error listando reservas del lugar:', error);
    res.status(500).json({ success: false, error: 'Error al listar reservas del lugar' });
  }
};

exports.createReserva = async (req, res) => {
  try {
    const { lugar_id, club_id, fecha_inicio, fecha_fin, proposito, notas } = req.body;

    if (!lugar_id || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ success: false, error: 'Lugar, fecha de inicio y fecha de fin son obligatorios' });
    }

    if (new Date(fecha_inicio) > new Date(fecha_fin)) {
      return res.status(400).json({ success: false, error: 'La fecha de inicio no puede ser mayor que la fecha de fin' });
    }

    const lugar = await pool.query('SELECT id, estado FROM lugares_camping WHERE id = $1', [lugar_id]);
    if (lugar.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lugar no encontrado' });
    }
    if (lugar.rows[0].estado !== 'activo') {
      return res.status(400).json({ success: false, error: 'El lugar no está disponible para reservas' });
    }

    if (club_id) {
      const club = await pool.query('SELECT id FROM clubs WHERE id = $1', [club_id]);
      if (club.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'El club seleccionado no existe' });
      }
    }

    if (await hayConflictoReserva(lugar_id, fecha_inicio, fecha_fin)) {
      return res.status(409).json({ success: false, error: 'El lugar ya tiene una reserva en esas fechas' });
    }

    const result = await pool.query(
      `INSERT INTO reservas (lugar_id, club_id, usuario_id, fecha_inicio, fecha_fin, proposito, notas)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [lugar_id, club_id || null, req.user.id, fecha_inicio, fecha_fin, proposito || null, notas || null]
    );

    res.status(201).json({
      success: true,
      message: 'Reserva creada exitosamente. Pendiente de confirmación.',
      reserva: result.rows[0]
    });
  } catch (error) {
    console.error('Error creando reserva:', error);
    res.status(500).json({ success: false, error: 'Error al crear reserva' });
  }
};

exports.updateReserva = async (req, res) => {
  try {
    const { id } = req.params;
    const { lugar_id, club_id, fecha_inicio, fecha_fin, proposito, notas, estado } = req.body;

    const existingResult = await pool.query('SELECT * FROM reservas WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }
    const existing = existingResult.rows[0];

    if (existing.usuario_id !== req.user.id && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para modificar esta reserva' });
    }

    const newFechaInicio = fecha_inicio || existing.fecha_inicio;
    const newFechaFin = fecha_fin || existing.fecha_fin;
    const newLugarId = lugar_id || existing.lugar_id;

    if (new Date(newFechaInicio) > new Date(newFechaFin)) {
      return res.status(400).json({ success: false, error: 'Fechas inválidas' });
    }

    if (newLugarId !== existing.lugar_id || newFechaInicio !== existing.fecha_inicio || newFechaFin !== existing.fecha_fin) {
      if (await hayConflictoReserva(newLugarId, newFechaInicio, newFechaFin, id)) {
        return res.status(409).json({ success: false, error: 'Conflicto con otra reserva existente' });
      }
    }

    let newEstado = estado;
    if (estado && !isAdmin(req)) {
      newEstado = existing.estado;
    }

    const result = await pool.query(
      `UPDATE reservas
       SET lugar_id = COALESCE($1, lugar_id),
           club_id = COALESCE($2, club_id),
           fecha_inicio = COALESCE($3, fecha_inicio),
           fecha_fin = COALESCE($4, fecha_fin),
           proposito = COALESCE($5, proposito),
           notas = COALESCE($6, notas),
           estado = COALESCE($7, estado)
       WHERE id = $8
       RETURNING *`,
      [lugar_id, club_id, fecha_inicio, fecha_fin, proposito, notas, newEstado, id]
    );

    res.json({ success: true, message: 'Reserva actualizada exitosamente', reserva: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando reserva:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar reserva' });
  }
};

exports.deleteReserva = async (req, res) => {
  try {
    const { id } = req.params;
    const existingResult = await pool.query('SELECT usuario_id FROM reservas WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }
    if (existingResult.rows[0].usuario_id !== req.user.id && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para cancelar esta reserva' });
    }

    await pool.query('DELETE FROM reservas WHERE id = $1', [id]);
    res.json({ success: true, message: 'Reserva cancelada exitosamente' });
  } catch (error) {
    console.error('Error cancelando reserva:', error);
    res.status(500).json({ success: false, error: 'Error al cancelar reserva' });
  }
};
