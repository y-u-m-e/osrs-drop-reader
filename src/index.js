import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { processImage } from './processor.js';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

app.use(cors());
app.use(express.json({ limit: '20mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Multipart upload: POST /extract with file field "screenshot"
app.post('/extract', upload.single('screenshot'), async (req, res) => {
  try {
    let imageBuffer;

    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body?.image) {
      // base64 fallback
      const base64 = req.body.image.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64, 'base64');
    } else {
      return res.status(400).json({ error: 'No image provided. Use multipart field "screenshot" or base64 field "image".' });
    }

    const result = await processImage(imageBuffer);
    res.json(result);
  } catch (err) {
    console.error('Error processing image:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`OSRS Drop Reader running on port ${PORT}`));
