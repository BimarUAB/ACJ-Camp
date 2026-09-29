import api from './api';

const uploadService = {
  image: (file) => {
    const form = new FormData();
    form.append('image', file);
    return api.post('/upload', form);
  },
};

export default uploadService;