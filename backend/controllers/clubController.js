const pool = require('../config/database');

const isAdmin = (req) => req.user?.rol === 'admin';
const canCreateClub = (req) => req.user?.rol === 'director';

const getManagedClub = async (clubId, req) => {
  const result = await pool.query('SELECT id, iglesia_id, director_id FROM clubs WHERE id = $1', [clubId]);
  const club = result.rows[0];
  if (!club) return { error: { status: 404, message: 'Club no encontrado' } };
  if (!isAdmin(req) && Number(club.director_id) !== Number(req.user.id)) {
    const userResult = req.user.rol === 'director'
      ? await pool.query('SELECT iglesia_id FROM usuarios WHERE id = $1', [req.user.id])
      : { rows: [] };
    const canManageUnassignedClub = req.user.rol === 'director'
      && club.director_id == null
      && Number(userResult.rows[0]?.iglesia_id) === Number(club.iglesia_id);
    if (!canManageUnassignedClub) {
      return { error: { status: 403, message: 'No tiene permisos para gestionar este club' } };
    }
  }
  return { club };
};

exports.getAllClubs = async (req, res) => {
  try {
    const { iglesia_id } = req.query;
    let conditions = [];
    let params = [];
    let paramCount = 0;

      if (iglesia_id && req.user.rol !== 'director') {
        conditions.push(`c.iglesia_id = $${++paramCount}`);
        params.push(iglesia_id);
    }

    if (req.user.rol === 'director') {
      const directorParam = ++paramCount;
      const churchParam = ++paramCount;
      conditions.push(`(c.director_id = $${directorParam} OR (c.director_id IS NULL AND c.iglesia_id = (SELECT iglesia_id FROM usuarios WHERE id = $${churchParam})))`);
      params.push(req.user.id);
      params.push(req.user.id);
    } else if (req.user.rol === 'lider' && iglesia_id) {
      // Leaders may choose an existing club for the church selected in their profile.
    } else if (req.user.rol !== 'admin') {
      conditions.push(`c.iglesia_id = (SELECT iglesia_id FROM usuarios WHERE id = $${++paramCount})`);
      params.push(req.user.id);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT c.*, u.nombre AS director_nombre, i.nombre AS iglesia_nombre
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

exports.getChurchClubDirectory = async (req, res) => {
  try {
    const [churchesResult, clubsResult] = await Promise.all([
      pool.query('SELECT id, nombre, direccion, zona, distrito FROM iglesias ORDER BY nombre'),
      pool.query(
        `SELECT c.id, c.iglesia_id, c.nombre, c.tipo, c.logo_url,
                director.nombre AS director_nombre,
                COALESCE(
                  json_agg(json_build_object(
                    'id', lider.id,
                    'nombre', lider.nombre,
                    'email', lider.email,
                    'telefono', lider.telefono,
                    'estado', lider.estado
                  ) ORDER BY lider.nombre) FILTER (WHERE lider.id IS NOT NULL),
                  '[]'::json
                ) AS lideres
         FROM clubs c
         LEFT JOIN usuarios director ON director.id = c.director_id
         LEFT JOIN club_lideres cl ON cl.club_id = c.id
         LEFT JOIN usuarios lider ON lider.id = cl.lider_id AND lider.rol = 'lider'
         GROUP BY c.id, director.nombre
         ORDER BY c.nombre`
      )
    ]);

    const clubsByChurch = new Map();
    for (const club of clubsResult.rows) {
      const churchId = Number(club.iglesia_id);
      if (!clubsByChurch.has(churchId)) clubsByChurch.set(churchId, []);
      clubsByChurch.get(churchId).push(club);
    }

    const churches = churchesResult.rows.map((church) => ({
      ...church,
      clubs: clubsByChurch.get(Number(church.id)) || []
    }));
    res.json({ success: true, iglesias: churches });
  } catch (error) {
    console.error('Error listando directorio de iglesias y clubes:', error);
    res.status(500).json({ success: false, error: 'Error al listar iglesias, clubes y líderes' });
  }
};

exports.getClubById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT c.*, u.nombre AS director_nombre, i.nombre AS iglesia_nombre
      FROM clubs c
      LEFT JOIN usuarios u ON c.director_id = u.id
      LEFT JOIN iglesias i ON c.iglesia_id = i.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Club no encontrado' });
    }

    const club = result.rows[0];
    if (!isAdmin(req)) {
      const access = await pool.query('SELECT iglesia_id FROM usuarios WHERE id = $1', [req.user.id]);
      if (club.director_id !== req.user.id && club.iglesia_id !== access.rows[0]?.iglesia_id) {
        return res.status(403).json({ success: false, error: 'No tiene permisos para ver este club' });
      }
    }

    res.json({ success: true, club: result.rows[0] });
  } catch (error) {
    console.error('Error obteniendo club:', error);
    res.status(500).json({ success: false, error: 'Error al obtener club' });
  }
};

exports.getClubLeaders = async (req, res) => {
  try {
    const access = await getManagedClub(req.params.id, req);
    if (access.error) return res.status(access.error.status).json({ success: false, error: access.error.message });

    const [leadersResult, availableResult] = await Promise.all([
      pool.query(
        `SELECT u.id, u.nombre, u.email, u.telefono
         FROM club_lideres cl
         JOIN usuarios u ON u.id = cl.lider_id
         WHERE cl.club_id = $1 AND u.rol = 'lider'
         ORDER BY u.nombre`,
        [access.club.id]
      ),
      pool.query(
        `SELECT u.id, u.nombre, u.email, u.telefono
         FROM usuarios u
         WHERE u.rol = 'lider' AND u.estado = 'activo' AND u.iglesia_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM club_lideres cl WHERE cl.club_id = $2 AND cl.lider_id = u.id
           )
         ORDER BY u.nombre`,
        [access.club.iglesia_id, access.club.id]
      )
    ]);

    res.json({ success: true, leaders: leadersResult.rows, available: availableResult.rows });
  } catch (error) {
    console.error('Error listando líderes del club:', error);
    res.status(500).json({ success: false, error: 'Error al listar líderes del club' });
  }
};

exports.addClubLeader = async (req, res) => {
  try {
    const access = await getManagedClub(req.params.id, req);
    if (access.error) return res.status(access.error.status).json({ success: false, error: access.error.message });

    const leaderResult = await pool.query(
      `SELECT id, nombre, email, telefono
       FROM usuarios
       WHERE id = $1 AND rol = 'lider' AND estado = 'activo' AND iglesia_id = $2`,
      [req.body.lider_id, access.club.iglesia_id]
    );
    if (!leaderResult.rows.length) {
      return res.status(400).json({ success: false, error: 'El usuario debe ser un líder activo de la misma iglesia' });
    }

    await pool.query(
      'INSERT INTO club_lideres (club_id, lider_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [access.club.id, leaderResult.rows[0].id]
    );
    res.status(201).json({ success: true, leader: leaderResult.rows[0] });
  } catch (error) {
    console.error('Error asignando líder al club:', error);
    res.status(500).json({ success: false, error: 'Error al asignar líder al club' });
  }
};

exports.removeClubLeader = async (req, res) => {
  try {
    const access = await getManagedClub(req.params.id, req);
    if (access.error) return res.status(access.error.status).json({ success: false, error: access.error.message });

    const result = await pool.query(
      'DELETE FROM club_lideres WHERE club_id = $1 AND lider_id = $2 RETURNING lider_id',
      [access.club.id, req.params.liderId]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'El líder no pertenece a este club' });
    res.json({ success: true, message: 'Líder retirado del club' });
  } catch (error) {
    console.error('Error retirando líder del club:', error);
    res.status(500).json({ success: false, error: 'Error al retirar líder del club' });
  }
};

exports.createClub = async (req, res) => {
  let client;
  try {
    if (!canCreateClub(req)) {
      return res.status(403).json({ success: false, error: 'Solo líderes, directores o administradores pueden crear clubs' });
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

    let finalIglesiaId = iglesia_id;
    let finalDirectorId = director_id || req.user.id;
    if (req.user.rol === 'director') {
      const director = await pool.query('SELECT iglesia_id FROM usuarios WHERE id = $1', [req.user.id]);
      if (!director.rows[0]?.iglesia_id || Number(director.rows[0].iglesia_id) !== Number(iglesia_id)) {
        return res.status(403).json({ success: false, error: 'Solo puede crear clubes asociados a su iglesia' });
      }
      finalIglesiaId = director.rows[0].iglesia_id;
      finalDirectorId = req.user.id;
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO clubs (nombre, tipo, iglesia_id, director_id, logo_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre, tipo, finalIglesiaId, finalDirectorId, logo_url || null]
    );
    await client.query('COMMIT');

    res.status(201).json({ success: true, message: 'Club creado exitosamente', club: result.rows[0] });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error creando club:', error);
    res.status(500).json({ success: false, error: 'Error al crear club' });
  } finally {
    client?.release();
  }
};

exports.updateClub = async (req, res) => {
  try {
    const { id } = req.params;

    const access = await getManagedClub(id, req);
    if (access.error) return res.status(access.error.status).json({ success: false, error: access.error.message });
    const directorChurch = isAdmin(req)
      ? null
      : await pool.query('SELECT iglesia_id FROM usuarios WHERE id = $1', [req.user.id]);
    if (!isAdmin(req) && !directorChurch.rows[0]?.iglesia_id) {
      return res.status(400).json({ success: false, error: 'Asocia una iglesia a tu cuenta antes de gestionar clubes' });
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
        [nombre, tipo, isAdmin(req) ? iglesia_id : directorChurch.rows[0].iglesia_id,
          isAdmin(req) ? director_id : req.user.id, logo_url, id]
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

    const access = await getManagedClub(id, req);
    if (access.error) return res.status(access.error.status).json({ success: false, error: access.error.message });
    const bookings = await pool.query('SELECT COUNT(*)::int AS total FROM reservas WHERE club_id = $1', [id]);
    if (bookings.rows[0].total > 0) {
      return res.status(409).json({ success: false, error: 'No se puede eliminar este club porque tiene reservas vinculadas' });
    }

    await pool.query('DELETE FROM clubs WHERE id = $1', [id]);
    res.json({ success: true, message: 'Club eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando club:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar club' });
  }
};
