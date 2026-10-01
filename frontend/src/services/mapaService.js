import api from './api';

const mapaService = {
  getCampingsOsm: (bbox, config = {}) => api.get('/mapa/campings-osm', {
    params: { bbox: bbox.join(','), actualizar: config.actualizar || undefined },
    signal: config.signal,
  }),
  getAdventistChurches: () => api.get('/mapa/iglesias-adventistas'),
  importAdventistChurches: (osmIds) => api.post('/mapa/iglesias-adventistas/importar', { osm_ids: osmIds }),
};

export default mapaService;