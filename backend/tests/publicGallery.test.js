const { test } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/database');
const { getGaleriaPublica } = require('../controllers/lugarController');

const response = () => ({
  statusCode: 200, headers: {},
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test('galería pública mezcla fotos del lugar y reseñas sin duplicados ni URLs ejecutables', async (t) => {
  t.mock.method(pool, 'query', async (sql) => {
    assert.equal((sql.match(/WHERE l\.estado = 'activo'/g) || []).length, 2);
    return { rows: [
      { lugar_id: 1, lugar_nombre: 'Uno', origen: 'lugar', fotos: ['https://example.com/a.jpg', 'javascript:alert(1)', null] },
      { lugar_id: 1, lugar_nombre: 'Uno', origen: 'resena', fotos: JSON.stringify([{ secure_url: 'https://example.com/b.jpg' }, 'https://example.com/a.jpg']) },
      { lugar_id: 2, lugar_nombre: 'Dos', origen: 'lugar', fotos: null },
    ] };
  });
  const res = response();
  await getGaleriaPublica({}, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.fotos.map((foto) => foto.url), ['https://example.com/a.jpg', 'https://example.com/b.jpg']);
  assert.equal(res.body.fotos[1].origen, 'resena');
});

test('galería vacía devuelve una lista vacía', async (t) => {
  t.mock.method(pool, 'query', async () => ({ rows: [] }));
  const res = response();
  await getGaleriaPublica({}, res);
  assert.deepEqual(res.body, { success: true, fotos: [] });
});

test('fallo de base de datos responde 503 sin exponer detalles internos', async (t) => {
  t.mock.method(pool, 'query', async () => { throw new Error('private database failure'); });
  t.mock.method(console, 'error', () => {});
  const res = response();
  await getGaleriaPublica({}, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
  assert.ok(!JSON.stringify(res.body).includes('private'));
});
