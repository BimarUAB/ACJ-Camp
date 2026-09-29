const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const router = express.Router();
const auth = require('../middleware/auth');

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) return callback(new Error('Solo se permiten imágenes JPEG, PNG, WebP o GIF'));
    callback(null, true);
  }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryConfigurado = () => [
  process.env.CLOUDINARY_CLOUD_NAME,
  process.env.CLOUDINARY_API_KEY,
  process.env.CLOUDINARY_API_SECRET,
].every((value) => value && !/^(tu_|your_|placeholder)/i.test(value));

const guardarLocalmente = async (req, file) => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Configura Cloudinary para subir imágenes en producción.');
  }
  const directory = path.join(__dirname, '..', 'uploads');
  await fs.mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.${MIME_EXTENSIONS[file.mimetype]}`;
  await fs.writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' });
  const baseUrl = process.env.PUBLIC_API_URL || `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${filename}`;
};

router.post('/', auth.verifyToken, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  }

  if (!cloudinaryConfigurado()) {
    try {
      const url = await guardarLocalmente(req, req.file);
      return res.status(201).json({ url, almacenamiento: 'local' });
    } catch (error) {
      return res.status(503).json({ error: error.message || 'No se pudo guardar la imagen.' });
    }
  }

  const streamUpload = (buffer) => {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream((error, result) => {
        if (result) resolve(result);
        else reject(error);
      });

      streamifier.createReadStream(buffer).pipe(stream);
    });
  };

  try {
    const result = await streamUpload(req.file.buffer);
    res.json({ url: result.secure_url, almacenamiento: 'cloudinary' });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      try {
        const url = await guardarLocalmente(req, req.file);
        return res.status(201).json({ url, almacenamiento: 'local' });
      } catch (localError) {
        return res.status(503).json({ error: localError.message || 'No se pudo guardar la imagen.' });
      }
    }
    res.status(502).json({ error: 'No se pudo subir la imagen a Cloudinary. Intenta más tarde.' });
  }
});

module.exports = router;
