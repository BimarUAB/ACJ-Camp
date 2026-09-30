const pool = require('../config/database');
const { expirePendingReservations } = require('../utils/reservationExpiry');

const isAdmin = (req) => req.user?.rol === 'admin';

exports.getAllReservas = async (req, res) => {
  try {
    await expirePendingReservations();
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
                  SELECT r.*, l.nombre AS lugar_nombre, l.telefono AS lugar_telefono, l.contacto AS lugar_contacto,
                    l.propietario AS lugar_propietario, c.nombre AS club_nombre, c.tipo AS club_tipo,
              u.nombre AS usuario_nombre, u.email AS usuario_email, u.telefono AS usuario_telefono
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
    await expirePendingReservations();
    const result = await pool.query(`
            SELECT r.*, l.nombre AS lugar_nombre, l.telefono AS lugar_telefono,
              l.contacto AS lugar_contacto, l.propietario AS lugar_propietario, c.nombre AS club_nombre,
              u.nombre AS usuario_nombre, u.email AS usuario_email
      FROM reservas r
      LEFT JOIN lugares_camping l ON r.lugar_id = l.id
      LEFT JOIN clubs c ON r.club_id = c.id
            LEFT JOIN usuarios u ON r.usuario_id = u.id
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
      SELECT r.id, r.fecha_inicio, r.fecha_fin, r.estado
      FROM reservas r
      WHERE r.lugar_id = $1 AND r.estado IN ('confirmada', 'completada')
      ORDER BY r.fecha_inicio ASC
    `, [id]);

    res.json({ success: true, reservas: result.rows });
  } catch (error) {
    console.error('Error listando reservas del lugar:', error);
    res.status(500).json({ success: false, error: 'Error al listar reservas del lugar' });
  }
};

exports.createReserva = async (req, res) => {
  let client;
  try {
    await expirePendingReservations();
    const { lugar_id, club_id, fecha_inicio, fecha_fin, proposito, notas } = req.body;

    if (!lugar_id || !fecha_inicio || !fecha_fin || !proposito?.trim()) {
      return res.status(400).json({ success: false, error: 'Lugar, fechas y motivo son obligatorios' });
    }

    if (new Date(fecha_inicio) > new Date(fecha_fin)) {
      return res.status(400).json({ success: false, error: 'La fecha de inicio no puede ser mayor que la fecha de fin' });
    }

    if (req.user.rol !== 'admin' && !club_id) {
      return res.status(400).json({ success: false, error: 'Selecciona un club para asociar la reserva' });
    }

    if (club_id) {
      const club = req.user.rol === 'admin'
        ? await pool.query('SELECT id FROM clubs WHERE id = $1', [club_id])
        : req.user.rol === 'director'
          ? await pool.query('SELECT id FROM clubs WHERE id = $1 AND director_id = $2', [club_id, req.user.id])
          : await pool.query(
            `SELECT c.id FROM clubs c
             JOIN usuarios u ON u.iglesia_id = c.iglesia_id
             WHERE c.id = $1 AND u.id = $2`,
            [club_id, req.user.id]
          );
      if (club.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'El club seleccionado no existe' });
      }
    }

    client = await pool.connect();
    await client.query('BEGIN');

    const lugar = await client.query(
      'SELECT id, estado FROM lugares_camping WHERE id = $1 FOR UPDATE',
      [lugar_id]
    );
    if (lugar.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Lugar no encontrado' });
    }
    if (lugar.rows[0].estado !== 'activo') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'El lugar no está disponible para reservas' });
    }

    const conflicto = await client.query(
      `SELECT id FROM reservas
        WHERE lugar_id = $1 AND estado IN ('confirmada', 'completada')
         AND (fecha_inicio, fecha_fin + 1) OVERLAPS ($2::date, $3::date + 1)
       LIMIT 1`,
      [lugar_id, fecha_inicio, fecha_fin]
    );
    if (conflicto.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'El lugar ya está reservado en esas fechas' });
    }

    const result = await client.query(
      `INSERT INTO reservas (lugar_id, club_id, usuario_id, fecha_inicio, fecha_fin, proposito, notas, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '48 hours')
       RETURNING *`,
      [lugar_id, club_id || null, req.user.id, fecha_inicio, fecha_fin, proposito.trim(), notas || null]
    );
    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Solicitud creada. Tienes 48 horas para contactar el lugar y confirmar tu reserva.',
      reserva: result.rows[0]
    });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    if (error.code === '23P01') {
      return res.status(400).json({ success: false, error: 'El lugar ya está reservado en esas fechas' });
    }
    console.error('Error creando reserva:', error);
    res.status(500).json({ success: false, error: 'Error al crear reserva' });
  } finally {
    client?.release();
  }
};

exports.confirmarConLugar = async (req, res) => {
  let client;
  try {
    await expirePendingReservations();
    client = await pool.connect();
    await client.query('BEGIN');

    const existingResult = await client.query(
      'SELECT * FROM reservas WHERE id = $1 FOR UPDATE',
      [req.params.id]
    );
    if (!existingResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }

    const reserva = existingResult.rows[0];
    if (Number(reserva.usuario_id) !== Number(req.user.id) && !isAdmin(req)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'Solo quien solicitó la reserva puede confirmarla' });
    }
    if (reserva.estado !== 'pendiente') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Esta reserva ya no está pendiente de confirmación' });
    }
    if (!reserva.expires_at || new Date(reserva.expires_at) <= new Date()) {
      await client.query("UPDATE reservas SET estado = 'cancelada' WHERE id = $1", [reserva.id]);
      await client.query('COMMIT');
      return res.status(410).json({ success: false, error: 'El plazo de 48 horas venció y las fechas quedaron disponibles' });
    }

    await client.query('SELECT id FROM lugares_camping WHERE id = $1 FOR UPDATE', [reserva.lugar_id]);
    const conflicto = await client.query(
      `SELECT id FROM reservas
       WHERE lugar_id = $1 AND id <> $2 AND estado IN ('confirmada', 'completada')
         AND (fecha_inicio, fecha_fin + 1) OVERLAPS ($3::date, $4::date + 1)
       LIMIT 1`,
      [reserva.lugar_id, reserva.id, reserva.fecha_inicio, reserva.fecha_fin]
    );
    if (conflicto.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: 'Otro evento ya confirmó fechas que se cruzan con esta reserva' });
    }

    const updated = await client.query(
      `UPDATE reservas SET estado = 'confirmada'
       WHERE id = $1 AND estado = 'pendiente' AND expires_at > NOW()
       RETURNING *`,
      [reserva.id]
    );
    if (!updated.rows.length) {
      await client.query('ROLLBACK');
      return res.status(410).json({ success: false, error: 'El plazo de confirmación venció' });
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Reserva confirmada. Las fechas ahora aparecen ocupadas.', reserva: updated.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23P01') {
      return res.status(409).json({ success: false, error: 'Otro evento ya confirmó estas fechas' });
    }
    console.error('Error confirmando reserva con el lugar:', error);
    res.status(500).json({ success: false, error: 'Error al confirmar la reserva' });
  } finally {
    client?.release();
  }
};

exports.updateReserva = async (req, res) => {
  let client;
  try {
    const { id } = req.params;
    const { lugar_id, club_id, fecha_inicio, fecha_fin, proposito, notas, estado } = req.body;

    client = await pool.connect();
    await client.query('BEGIN');
    const existingResult = await client.query('SELECT * FROM reservas WHERE id = $1 FOR UPDATE', [id]);
    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Reserva no encontrada' });
    }
    const existing = existingResult.rows[0];

    if (existing.usuario_id !== req.user.id && !isAdmin(req)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'No tiene permisos para modificar esta reserva' });
    }

    if (!isAdmin(req) && (lugar_id || club_id || fecha_inicio || fecha_fin || proposito || notas)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ success: false, error: 'Solo puedes cancelar tu reserva; contacta al administrador para otros cambios' });
    }

    const newFechaInicio = fecha_inicio || existing.fecha_inicio;
    const newFechaFin = fecha_fin || existing.fecha_fin;
    const newLugarId = lugar_id || existing.lugar_id;
    let newEstado = estado;
    if (estado && !isAdmin(req)) {
      newEstado = estado === 'cancelada' ? 'cancelada' : existing.estado;
    }

    const transicionesAdmin = {
      pendiente: ['cancelada'],
      confirmada: ['completada', 'cancelada'],
      completada: [],
      cancelada: [],
    };
    if (isAdmin(req) && estado && estado !== existing.estado && !transicionesAdmin[existing.estado]?.includes(estado)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'El cambio de estado de esta reserva no está permitido' });
    }

    if (new Date(newFechaInicio) > new Date(newFechaFin)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Fechas inválidas' });
    }

    const lugaresABloquear = [...new Set([Number(existing.lugar_id), Number(newLugarId)])].sort((a, b) => a - b);
    await client.query(
      'SELECT id FROM lugares_camping WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
      [lugaresABloquear]
    );

    const estadoFinal = newEstado || existing.estado;
    if (['confirmada', 'completada'].includes(estadoFinal)) {
      const conflicto = await client.query(
        `SELECT id FROM reservas
         WHERE lugar_id = $1 AND id <> $2 AND estado IN ('confirmada', 'completada')
           AND (fecha_inicio, fecha_fin + 1) OVERLAPS ($3::date, $4::date + 1)
         LIMIT 1`,
        [newLugarId, id, newFechaInicio, newFechaFin]
      );
      if (conflicto.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, error: 'El lugar ya está reservado en esas fechas' });
      }
    }

    const result = await client.query(
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
    await client.query('COMMIT');

    res.json({ success: true, message: 'Reserva actualizada exitosamente', reserva: result.rows[0] });
  } catch (error) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    if (error.code === '23P01') {
      return res.status(400).json({ success: false, error: 'El lugar ya está reservado en esas fechas' });
    }
    console.error('Error actualizando reserva:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar reserva' });
  } finally {
    client?.release();
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

    await pool.query("UPDATE reservas SET estado = 'cancelada' WHERE id = $1", [id]);
    res.json({ success: true, message: 'Reserva cancelada exitosamente' });
  } catch (error) {
    console.error('Error cancelando reserva:', error);
    res.status(500).json({ success: false, error: 'Error al cancelar reserva' });
  }
};
