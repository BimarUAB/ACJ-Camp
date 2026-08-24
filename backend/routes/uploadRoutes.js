const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

router.post('/', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se recibió ninguna imagen' });
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

  streamUpload(req.file.buffer)
    .then((result) => res.json({ url: result.secure_url }))
    .catch((error) => res.status(500).json({ error: error.message }));
});

module.exports = router;
