const pool = require('../config/database');

exports.createIglesia = async (req, res) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const direccion = String(req.body.direccion || '').trim() || null;
    const zona = String(req.body.zona || '').trim() || null;
    const distrito = String(req.body.distrito || '').trim() || null;
    const { latitud, longitud } = req.body;

    if (!nombre) return res.status(400).json({ success: false, error: 'El nombre de la iglesia es obligatorio' });
    if (latitud == null || longitud == null) {
      return res.status(400).json({ success: false, error: 'La latitud y longitud son obligatorias para ubicar la iglesia en el mapa' });
    }

    const duplicate = await pool.query(
      `SELECT id FROM iglesias
       WHERE lower(trim(nombre)) = lower($1)
         AND lower(COALESCE(zona, '')) = lower(COALESCE($2, ''))
         AND lower(COALESCE(distrito, '')) = lower(COALESCE($3, ''))
       LIMIT 1`,
      [nombre, zona, distrito]
    );
    if (duplicate.rows.length) {
      return res.status(409).json({ success: false, error: 'Ya existe una iglesia con ese nombre en esa zona y distrito' });
    }

    const result = await pool.query(
      `INSERT INTO iglesias (nombre, direccion, zona, distrito, latitud, longitud)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nombre, direccion, zona, distrito, latitud, longitud`,
      [nombre, direccion, zona, distrito, latitud ?? null, longitud ?? null]
    );
    res.status(201).json({ success: true, iglesia: result.rows[0] });
  } catch (error) {
    console.error('Error creando iglesia:', error);
    res.status(500).json({ success: false, error: 'Error al registrar la iglesia' });
  }
};

exports.deleteIglesia = async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const church = await client.query('SELECT id FROM iglesias WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!church.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Iglesia no encontrada' });
    }

    const [users, clubs] = await Promise.all([
      client.query('SELECT COUNT(*)::int AS total FROM usuarios WHERE iglesia_id = $1', [req.params.id]),
      client.query('SELECT COUNT(*)::int AS total FROM clubs WHERE iglesia_id = $1', [req.params.id])
    ]);
    const usersCount = users.rows[0].total;
    const clubsCount = clubs.rows[0].total;
    if (usersCount || clubsCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: `No se puede eliminar: tiene ${usersCount} usuario(s) y ${clubsCount} club(es) asociados. Reasígnalos o elimínalos primero.`
      });
    }

    await client.query('DELETE FROM iglesias WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true, message: 'Iglesia eliminada' });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error eliminando iglesia:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar la iglesia' });
  } finally {
    client?.release();
  }
};