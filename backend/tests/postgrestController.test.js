const { test } = require('node:test');
const assert = require('node:assert/strict');
const postgrestController = require('../controllers/postgrestController');

const configureTest = (context, postgrestUrl = 'http://127.0.0.1:3001') => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.POSTGREST_URL;

  process.env.POSTGREST_URL = postgrestUrl;
  context.after(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.POSTGREST_URL;
    else process.env.POSTGREST_URL = originalUrl;
  });
};

const createResponse = () => ({
  statusCode: 200,
  body: undefined,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const callController = async (query = {}) => {
  const response = createResponse();
  await postgrestController.getLugaresCercanos({ query }, response);
  return response;
};

const successResponse = (places) => ({
  ok: true,
  json: async () => places,
});

test('devuelve 503 cuando POSTGREST_URL no está configurada', async (context) => {
  configureTest(context);
  delete process.env.POSTGREST_URL;
  global.fetch = async () => assert.fail('No debe llamar a PostgREST');

  const response = await callController();

  assert.equal(response.statusCode, 503);
  assert.equal(response.body.success, false);
});

test('envía una solicitud POST al RPC esperado', async (context) => {
  configureTest(context);
  let requestUrl;
  let requestOptions;
  global.fetch = async (url, options) => {
    requestUrl = String(url);
    requestOptions = options;
    return successResponse([]);
  };

  await callController({ lat: '-16.5', lng: '-68.1', radio: '25' });

  assert.equal(requestUrl, 'http://127.0.0.1:3001/rpc/lugares_cercanos');
  assert.equal(requestOptions.method, 'POST');
  assert.equal(requestOptions.headers['Content-Type'], 'application/json');
});

test('convierte latitud, longitud y radio a números en el payload', async (context) => {
  configureTest(context);
  let payload;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return successResponse([]);
  };

  await callController({ lat: '-16.5', lng: '-68.1', radio: '25' });

  assert.deepEqual(payload, { p_lat: -16.5, p_lng: -68.1, p_radio_km: 25 });
});

test('usa 50 km cuando no se especifica el radio', async (context) => {
  configureTest(context);
  let payload;
  global.fetch = async (_url, options) => {
    payload = JSON.parse(options.body);
    return successResponse([]);
  };

  await callController({ lat: '-16.5', lng: '-68.1' });

  assert.equal(payload.p_radio_km, 50);
});

test('devuelve los lugares y su cantidad cuando PostgREST responde bien', async (context) => {
  configureTest(context);
  const places = [{ id: 7, nombre: 'Campamento de prueba', distancia_km: 12.5 }];
  global.fetch = async () => successResponse(places);

  const response = await callController({ lat: '-16.5', lng: '-68.1' });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { success: true, count: 1, lugares: places });
});

test('acepta una respuesta vacía con cantidad cero', async (context) => {
  configureTest(context);
  global.fetch = async () => successResponse([]);

  const response = await callController({ lat: '-16.5', lng: '-68.1' });

  assert.deepEqual(response.body, { success: true, count: 0, lugares: [] });
});

test('traduce respuestas HTTP fallidas de PostgREST a 502', async (context) => {
  configureTest(context);
  const originalConsoleError = console.error;
  console.error = () => {};
  context.after(() => { console.error = originalConsoleError; });
  global.fetch = async () => ({ ok: false, status: 500 });

  const response = await callController({ lat: '-16.5', lng: '-68.1' });

  assert.equal(response.statusCode, 502);
  assert.equal(response.body.success, false);
});

test('traduce errores de conexión a 502', async (context) => {
  configureTest(context);
  global.fetch = async () => { throw new Error('connection refused'); };

  const response = await callController({ lat: '-16.5', lng: '-68.1' });

  assert.equal(response.statusCode, 502);
  assert.equal(response.body.success, false);
});

test('traduce timeouts de PostgREST a 504', async (context) => {
  configureTest(context);
  global.fetch = async () => {
    const error = new Error('request timed out');
    error.name = 'TimeoutError';
    throw error;
  };

  const response = await callController({ lat: '-16.5', lng: '-68.1' });

  assert.equal(response.statusCode, 504);
  assert.equal(response.body.success, false);
});