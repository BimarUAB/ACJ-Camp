exports.getLugaresCercanos = async (req, res) => {
  const postgrestUrl = process.env.POSTGREST_URL;
  if (!postgrestUrl) {
    return res.status(503).json({
      success: false,
      error: 'La consulta PostgREST no está configurada.'
    });
  }

  const pLat = Number(req.query.lat);
  const pLng = Number(req.query.lng);
  const pRadioKm = Number(req.query.radio ?? 50);

  try {
    const response = await fetch(new URL('/rpc/lugares_cercanos', postgrestUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_lat: pLat, p_lng: pLng, p_radio_km: pRadioKm }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      console.error(`PostgREST respondió ${response.status} al buscar lugares cercanos`);
      return res.status(502).json({
        success: false,
        error: 'No se pudo completar la consulta de lugares cercanos.'
      });
    }

    const lugares = await response.json();
    return res.json({ success: true, count: lugares.length, lugares });
  } catch (error) {
    const status = error.name === 'TimeoutError' || error.name === 'AbortError' ? 504 : 502;
    return res.status(status).json({
      success: false,
      error: 'PostgREST no está disponible para consultar lugares cercanos.'
    });
  }
};