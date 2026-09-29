const pool = require('../config/database');

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isAdmin = (req) => req.user?.rol === 'admin';

exports.getAllReseñas = async (req, res) => {
  try {
    const { lugar_id, usuario_id } = req.query;
    let conditions = [];
    let params = [];
    let paramCount = 0;

    if (lugar_id) {
      conditions.push(`r.lugar_id = $${++paramCount}`);
      params.push(lugar_id);
    }
    if (usuario_id) {
      conditions.push(`r.usuario_id = $${++paramCount}`);
      params.push(usuario_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT r.*, u.nombre AS usuario_nombre, l.nombre AS lugar_nombre
      FROM resenas r
      LEFT JOIN usuarios u ON r.usuario_id = u.id
      LEFT JOIN lugares_camping l ON r.lugar_id = l.id
      ${whereClause}
      ORDER BY r.created_at DESC
    `, params);

    res.json({ success: true, count: result.rows.length, resenas: result.rows });
  } catch (error) {
    console.error('Error listando resenas:', error);
    res.status(500).json({ success: false, error: 'Error al listar resenas' });
  }
};

exports.createReseña = async (req, res) => {
  try {
    const { lugar_id, reserva_id, calificacion, comentario, fotos, fecha_visita } = req.body;

    if (!lugar_id || !reserva_id || calificacion == null) {
      return res.status(400).json({ success: false, error: 'Lugar, reserva completada y calificación son obligatorios' });
    }

    if (calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ success: false, error: 'La calificación debe estar entre 1 y 5' });
    }

    const lugarResult = await pool.query('SELECT id FROM lugares_camping WHERE id = $1', [lugar_id]);
    if (lugarResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lugar no encontrado' });
    }

    const reservaResult = await pool.query(
      'SELECT id FROM reservas WHERE id = $1 AND lugar_id = $2 AND usuario_id = $3 AND estado = \'completada\'',
      [reserva_id, lugar_id, req.user.id]
    );
    if (reservaResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'Solo se pueden reseñar reservas completadas propias de este lugar' });
    }

    const fotosArray = parseJsonArray(fotos);

    const result = await pool.query(
      `INSERT INTO resenas (lugar_id, usuario_id, reserva_id, calificacion, comentario, fotos, fecha_visita)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
       RETURNING *`,
      [lugar_id, req.user.id, reserva_id || null, calificacion, comentario, JSON.stringify(fotosArray), fecha_visita || null]
    );

    res.status(201).json({ success: true, message: 'Reseña creada exitosamente', reseña: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'Esta reserva ya tiene una reseña' });
    }
    console.error('Error creando reseña:', error);
    res.status(500).json({ success: false, error: 'Error al crear reseña' });
  }
};

exports.updateReseña = async (req, res) => {
  try {
    const { id } = req.params;
    const { calificacion, comentario, fotos, fecha_visita } = req.body;

    const existing = await pool.query('SELECT * FROM resenas WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reseña no encontrada' });
    }

    if (existing.rows[0].usuario_id !== req.user.id && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para modificar esta reseña' });
    }

    if (calificacion != null && (calificacion < 1 || calificacion > 5)) {
      return res.status(400).json({ success: false, error: 'La calificación debe estar entre 1 y 5' });
    }

    const fotosArray = fotos != null ? parseJsonArray(fotos) : null;

    const result = await pool.query(
      `UPDATE resenas
       SET calificacion = COALESCE($1, calificacion),
           comentario = COALESCE($2, comentario),
           fotos = COALESCE($3::jsonb, fotos),
           fecha_visita = COALESCE($4, fecha_visita)
       WHERE id = $5
       RETURNING *`,
      [
        calificacion,
        comentario,
        fotosArray ? JSON.stringify(fotosArray) : null,
        fecha_visita,
        id
      ]
    );

    res.json({ success: true, message: 'Reseña actualizada exitosamente', reseña: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando reseña:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar reseña' });
  }
};

exports.deleteReseña = async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await pool.query('SELECT usuario_id FROM resenas WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Reseña no encontrada' });
    }

    if (existing.rows[0].usuario_id !== req.user.id && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para eliminar esta reseña' });
    }

    await pool.query('DELETE FROM resenas WHERE id = $1', [id]);
    res.json({ success: true, message: 'Reseña eliminada exitosamente' });
  } catch (error) {
    console.error('Error eliminando reseña:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar reseña' });
  }
};
