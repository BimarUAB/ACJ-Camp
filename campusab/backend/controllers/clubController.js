const pool = require('../config/database');

const isAdmin = (req) => req.user?.rol === 'admin';
const isDirectorOrAdmin = (req) => req.user?.rol === 'director' || isAdmin(req);

exports.getAllClubs = async (req, res) => {
  try {
    const { iglesia_id } = req.query;
    let conditions = [];
    let params = [];
    let paramCount = 0;

    if (iglesia_id) {
      conditions.push(`c.iglesia_id = $${++paramCount}`);
      params.push(iglesia_id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT c.*, u.nombre AS director_nombre, u.email AS director_email, i.nombre AS iglesia_nombre
      FROM clubs c
      LEFT JOIN usuarios u ON c.director_id = u.id
      LEFT JOIN iglesias i ON c.iglesia_id = i.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `, params);

    res.json({ success: true, count: result.rows.length, clubs: result.rows });
  } catch (error) {
    console.error('Error listando clubs:', error);
    res.status(500).json({ success: false, error: 'Error al listar clubs' });
  }
};

exports.getClubById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*, u.nombre AS director_nombre, u.email AS director_email, i.nombre AS iglesia_nombre
      FROM clubs c
      LEFT JOIN usuarios u ON c.director_id = u.id
      LEFT JOIN iglesias i ON c.iglesia_id = i.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Club no encontrado' });
    }

    res.json({ success: true, club: result.rows[0] });
  } catch (error) {
    console.error('Error obteniendo club:', error);
    res.status(500).json({ success: false, error: 'Error al obtener club' });
  }
};

exports.createClub = async (req, res) => {
  try {
    if (!isDirectorOrAdmin(req)) {
      return res.status(403).json({ success: false, error: 'Solo directores o administradores pueden crear clubs' });
    }

    const { nombre, tipo, iglesia_id, director_id, logo_url } = req.body;

    if (!nombre || !tipo || !iglesia_id) {
      return res.status(400).json({ success: false, error: 'Nombre, tipo e iglesia son obligatorios' });
    }

    const tiposPermitidos = ['conquistadores', 'aventureros', 'ja'];
    if (!tiposPermitidos.includes(tipo)) {
      return res.status(400).json({ success: false, error: 'Tipo de club no válido' });
    }

    const iglesiaResult = await pool.query('SELECT id FROM iglesias WHERE id = $1', [iglesia_id]);
    if (iglesiaResult.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'La iglesia seleccionada no existe' });
    }

    const finalDirectorId = director_id || req.user.id;

    const result = await pool.query(
      `INSERT INTO clubs (nombre, tipo, iglesia_id, director_id, logo_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre, tipo, iglesia_id, finalDirectorId, logo_url || null]
    );

    res.status(201).json({ success: true, message: 'Club creado exitosamente', club: result.rows[0] });
  } catch (error) {
    console.error('Error creando club:', error);
    res.status(500).json({ success: false, error: 'Error al crear club' });
  }
};

exports.updateClub = async (req, res) => {
  try {
    const { id } = req.params;

    const existingResult = await pool.query('SELECT director_id, iglesia_id FROM clubs WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Club no encontrado' });
    }

    const existing = existingResult.rows[0];
    if (existing.director_id !== req.user.id && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para modificar este club' });
    }

    const { nombre, tipo, iglesia_id, director_id, logo_url } = req.body;

    if (tipo) {
      const tiposPermitidos = ['conquistadores', 'aventureros', 'ja'];
      if (!tiposPermitidos.includes(tipo)) {
        return res.status(400).json({ success: false, error: 'Tipo de club no válido' });
      }
    }

    if (iglesia_id) {
      const iglesiaResult = await pool.query('SELECT id FROM iglesias WHERE id = $1', [iglesia_id]);
      if (iglesiaResult.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'La iglesia seleccionada no existe' });
      }
    }

    const result = await pool.query(
      `UPDATE clubs
       SET nombre = COALESCE($1, nombre),
           tipo = COALESCE($2, tipo),
           iglesia_id = COALESCE($3, iglesia_id),
           director_id = COALESCE($4, director_id),
           logo_url = COALESCE($5, logo_url)
       WHERE id = $6
       RETURNING *`,
      [nombre, tipo, iglesia_id, director_id, logo_url, id]
    );

    res.json({ success: true, message: 'Club actualizado exitosamente', club: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando club:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar club' });
  }
};

exports.deleteClub = async (req, res) => {
  try {
    const { id } = req.params;

    const existingResult = await pool.query('SELECT director_id FROM clubs WHERE id = $1', [id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Club no encontrado' });
    }

    if (existingResult.rows[0].director_id !== req.user.id && !isAdmin(req)) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para eliminar este club' });
    }

    await pool.query('DELETE FROM clubs WHERE id = $1', [id]);
    res.json({ success: true, message: 'Club eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando club:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar club' });
  }
};
