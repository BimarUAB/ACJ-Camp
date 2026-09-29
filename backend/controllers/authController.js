const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const jwtSecret = process.env.JWT_SECRET || 'acj-camp-dev-secret';

const buildUserPayload = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  telefono: user.telefono,
  rol: user.rol,
  iglesia_id: user.iglesia_id,
  iglesia_nombre: user.iglesia_nombre,
  estado: user.estado || 'activo',
  iglesia_latitud: user.iglesia_latitud,
  iglesia_longitud: user.iglesia_longitud,
  created_at: user.created_at,
  ultimo_login: user.ultimo_login
});

exports.register = async (req, res) => {
  try {
    const { nombre, email, password, telefono, iglesia_id } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ success: false, error: 'Nombre, email y contraseña son obligatorios' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailExiste = await pool.query('SELECT id FROM usuarios WHERE email = $1', [normalizedEmail]);
    if (emailExiste.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'El correo electrónico ya está registrado' });
    }

    if (iglesia_id) {
      const iglesiaExiste = await pool.query('SELECT id FROM iglesias WHERE id = $1', [iglesia_id]);
      if (iglesiaExiste.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'La iglesia seleccionada no existe' });
      }
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const role = 'lider';

    const result = await pool.query(
      `INSERT INTO usuarios (nombre, email, password_hash, telefono, iglesia_id, rol, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'activo')
       RETURNING id, nombre, email, telefono, rol, iglesia_id, created_at`,
      [nombre.trim(), normalizedEmail, hashedPassword, telefono || null, iglesia_id || null, role]
    );

    const iglesiaResult = iglesia_id
      ? await pool.query('SELECT latitud AS iglesia_latitud, longitud AS iglesia_longitud, nombre AS iglesia_nombre FROM iglesias WHERE id = $1', [iglesia_id])
      : { rows: [{}] };

    const token = jwt.sign({ id: result.rows[0].id, email: result.rows[0].email, rol: role }, jwtSecret, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      user: buildUserPayload({ ...result.rows[0], ...iglesiaResult.rows[0], rol: role })
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, error: 'Error al registrar usuario. Intente nuevamente.' });
  }
};

exports.login = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña son obligatorios' });
    }

    const result = await pool.query(
      `SELECT u.*, i.nombre AS iglesia_nombre, i.latitud AS iglesia_latitud, i.longitud AS iglesia_longitud
       FROM usuarios u
       LEFT JOIN iglesias i ON u.iglesia_id = i.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      await bcrypt.compare(password, '$2a$12$AlcriFB4vab3weOIlB31YuXxcFXDjnaugnXzogUWKE9MG7co8Tv9q');
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      return res.status(429).json({ success: false, error: 'Credenciales inválidas o acceso temporalmente bloqueado' });
    }
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await pool.query(
        `UPDATE usuarios
         SET intentos_login_fallidos = CASE WHEN bloqueado_hasta <= NOW() THEN 1 ELSE intentos_login_fallidos + 1 END,
             bloqueado_hasta = CASE
               WHEN bloqueado_hasta > NOW() THEN bloqueado_hasta
               WHEN bloqueado_hasta <= NOW() THEN NULL
               WHEN intentos_login_fallidos + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
               ELSE NULL
             END
         WHERE id = $1`,
        [user.id]
      );
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    if (user.estado === 'inactivo') {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, jwtSecret, { expiresIn: '7d' });

    await pool.query(
      'UPDATE usuarios SET ultimo_login = CURRENT_TIMESTAMP, intentos_login_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1',
      [user.id]
    );

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: buildUserPayload(user)
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, error: 'Error al iniciar sesión. Intente nuevamente.' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.nombre, u.email, u.telefono, u.rol, u.iglesia_id, u.created_at, u.ultimo_login,
              COALESCE(u.estado, 'activo') AS estado,
              i.nombre AS iglesia_nombre, i.direccion AS iglesia_direccion, i.zona, i.distrito,
              i.latitud AS iglesia_latitud, i.longitud AS iglesia_longitud
       FROM usuarios u
       LEFT JOIN iglesias i ON u.iglesia_id = i.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const clubsResult = await pool.query(
      `SELECT c.id, c.nombre, c.tipo, c.logo_url, i.nombre AS iglesia_nombre
       FROM clubs c
       LEFT JOIN iglesias i ON c.iglesia_id = i.id
       WHERE c.director_id = $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      user: {
        ...buildUserPayload(result.rows[0]),
        clubs: clubsResult.rows
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ success: false, error: 'Error al obtener perfil' });
  }
};

exports.getIglesias = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nombre, direccion, zona, distrito, latitud, longitud FROM iglesias ORDER BY nombre'
    );
    res.json({ success: true, iglesias: result.rows });
  } catch (error) {
    console.error('Error listando iglesias:', error);
    res.status(500).json({ success: false, error: 'Error al listar iglesias' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { nombre, telefono, iglesia_id } = req.body;
    const userId = req.user.id;

    if (iglesia_id != null) {
      const church = await pool.query('SELECT id FROM iglesias WHERE id = $1', [iglesia_id]);
      if (!church.rows.length) return res.status(400).json({ success: false, error: 'La iglesia seleccionada no existe' });
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET nombre = COALESCE($1, nombre),
           telefono = COALESCE($2, telefono),
           iglesia_id = COALESCE($3, iglesia_id)
       WHERE id = $4
       RETURNING id, nombre, email, telefono, rol, iglesia_id`,
      [nombre, telefono, iglesia_id, userId]
    );

    res.json({ success: true, message: 'Perfil actualizado exitosamente', user: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar perfil' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;
    const userId = req.user.id;

    const result = await pool.query('SELECT password_hash FROM usuarios WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const validPassword = await bcrypt.compare(passwordActual, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(passwordNueva, salt);

    await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hashedPassword, userId]);

    res.json({ success: true, message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { rol, iglesia_id, busqueda } = req.query;

    let query = `
      SELECT u.id, u.nombre, u.email, u.telefono, u.rol, u.iglesia_id, COALESCE(u.estado, 'activo') AS estado,
             u.created_at, u.ultimo_login,
             i.nombre AS iglesia_nombre
      FROM usuarios u
      LEFT JOIN iglesias i ON u.iglesia_id = i.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (rol) {
      paramCount += 1;
      query += ` AND u.rol = $${paramCount}`;
      params.push(rol);
    }

    if (iglesia_id) {
      paramCount += 1;
      query += ` AND u.iglesia_id = $${paramCount}`;
      params.push(iglesia_id);
    }

    if (busqueda) {
      paramCount += 1;
      query += ` AND (u.nombre ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`;
      params.push(`%${busqueda}%`);
    }

    query += ' ORDER BY u.created_at DESC';

    const result = await pool.query(query, params);

    res.json({ success: true, count: result.rows.length, users: result.rows });
  } catch (error) {
    console.error('Error listando usuarios:', error);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, telefono, iglesia_id } = req.body;
    if (!nombre?.trim() || !email?.trim()) {
      return res.status(400).json({ success: false, error: 'Nombre y correo electrónico son obligatorios' });
    }
    if (iglesia_id != null) {
      const church = await pool.query('SELECT id FROM iglesias WHERE id = $1', [iglesia_id]);
      if (!church.rows.length) return res.status(400).json({ success: false, error: 'La iglesia seleccionada no existe' });
    }

    const result = await pool.query(
      `UPDATE usuarios
       SET nombre = $1, email = $2, telefono = $3, iglesia_id = $4
       WHERE id = $5
       RETURNING id, nombre, email, telefono, iglesia_id, rol, estado`,
      [nombre.trim(), email.trim().toLowerCase(), telefono || null, iglesia_id || null, id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, error: 'El correo electrónico ya está registrado' });
    }
    console.error('Error actualizando usuario:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar usuario' });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol } = req.body;

    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({ error: 'No puede cambiar su propio rol' });
    }

    const rolesPermitidos = ['lider', 'director', 'admin'];
    if (!rolesPermitidos.includes(rol)) {
      return res.status(400).json({ error: 'Rol no válido. Roles permitidos: lider, director, admin' });
    }

    const result = await pool.query('UPDATE usuarios SET rol = $1 WHERE id = $2 RETURNING id, nombre, email, rol', [rol, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ success: true, message: 'Rol actualizado exitosamente', user: result.rows[0] });
  } catch (error) {
    console.error('Error actualizando rol:', error);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'No puede desactivar su propia cuenta' });
    }

    const user = await pool.query('SELECT estado FROM usuarios WHERE id = $1', [id]);
    if (user.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nuevoEstado = user.rows[0].estado === 'activo' ? 'inactivo' : 'activo';
    const result = await pool.query('UPDATE usuarios SET estado = $1 WHERE id = $2 RETURNING id, nombre, estado', [nuevoEstado, id]);

    res.json({ success: true, message: `Usuario ${nuevoEstado === 'activo' ? 'activado' : 'desactivado'} exitosamente`, user: result.rows[0] });
  } catch (error) {
    console.error('Error cambiando estado:', error);
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
};
