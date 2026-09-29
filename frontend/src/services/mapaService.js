import api from './api';

const mapaService = {
  getCampingsOsm: (bbox, config = {}) => api.get('/mapa/campings-osm', {
    params: { bbox: bbox.join(','), actualizar: config.actualizar || undefined },
    signal: config.signal,
  }),
};

export default mapaService;