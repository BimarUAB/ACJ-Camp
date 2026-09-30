const pool = require('../config/database');

const expirePendingReservations = async (client = pool) => {
  const result = await client.query(
    `UPDATE reservas
     SET estado = 'cancelada'
     WHERE estado = 'pendiente'
       AND expires_at IS NOT NULL
       AND expires_at <= NOW()
     RETURNING id`
  );
  return result.rows;
};

module.exports = { expirePendingReservations };