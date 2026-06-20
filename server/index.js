import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import ffmpeg from 'ffmpeg-static';
import { runTranscription } from './services/transcriber.js';
import { renderVideo } from './services/renderer.js';

const app = express();
const PORT = 3000;

app.use(express.json());

// Set up directory for uploads and outputs
const uploadsDir = path.resolve(process.cwd(), 'uploads');
const outputDir = path.resolve(process.cwd(), 'output');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

// Configure file upload with multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `video_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Active jobs database in-memory to expose status to frontend
const jobs = {};

// 1. Health and status endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'live', engine: 'Remotion+Whisper' });
});

// 2. Main workflow endpoint: upload video, extract audio, and request transcription
app.post('/api/transcribe', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se subió ningún video.' });
  }

  const { language = 'es' } = req.body;
  const videoPath = req.file.path;
  const jobId = `job_${Date.now()}`;
  
  // Initialize job status
  jobs[jobId] = {
    id: jobId,
    videoPath,
    videoName: req.file.originalname,
    status: 'processing',
    phase: 'extracting_audio', // 'extracting_audio' -> 'transcribing' -> 'ready_to_style' -> 'rendering' -> 'completed'
    progress: 15,
    message: 'Extrayendo audio PCM optimizado a 16kHz...',
    language,
    transcription: null,
    outputPath: null,
  };

  res.json({ jobId });

  // Handle operations asynchronously to prevent blocking the HTTP pipe
  const audioPath = path.join(uploadsDir, `audio_${jobId}.wav`);
  
  extractAudio(videoPath, audioPath, (extractErr) => {
    if (extractErr) {
      console.warn('Audio extraction error or running fallback:', extractErr.message);
      // We will proceed to transcriber which has solid simulation backup
    }

    jobs[jobId].phase = 'transcribing';
    jobs[jobId].progress = 40;
    jobs[jobId].message = `Transcribiendo palabras con inteligencia artificial (${language.toUpperCase()})...`;

    runTranscription(audioPath, language, (transcribeErr, jsonWords) => {
      // Clean up audio file
      try {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      } catch (e) {
        console.error('Error cleaning audio:', e);
      }

      if (transcribeErr) {
        jobs[jobId].status = 'failed';
        jobs[jobId].message = 'La transcripción de audio falló.';
        return;
      }

      jobs[jobId].phase = 'ready_to_style';
      jobs[jobId].progress = 70;
      jobs[jobId].message = 'Transcripción de nivel palabra generada con éxito.';
      jobs[jobId].transcription = jsonWords;
    });
  });
});

// Helper function to extract audio using ffmpeg-static
function extractAudio(videoPath, audioPath, callback) {
  if (!ffmpeg) {
    return callback(new Error('ffmpeg-static binary path is not available'));
  }

  // -y (overwrite), -i (input)
  // -vn (disable video), -acodec pcm_s16le (PCM 16-bit)
  // -ar 16000 (16000 Hz sample rate), -ac 1 (mono channel)
  const cmd = `"${ffmpeg}" -y -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}"`;
  
  console.log(`Extracting audio: ${cmd}`);
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      callback(error);
    } else {
      callback(null);
    }
  });
}

// 3. Get job details
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) {
    return res.status(404).json({ error: 'Trabajo no encontrado' });
  }
  res.json(job);
});

// 4. Overwrite word text (edit subtitles dynamically in client)
app.post('/api/jobs/:id/edit', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) {
    return res.status(404).json({ error: 'Trabajo no encontrado' });
  }
  const { transcription } = req.body;
  if (transcription) {
    job.transcription = transcription;
    res.json({ success: true, transcription: job.transcription });
  } else {
    res.status(400).json({ error: 'Contenido de transcripción requerido' });
  }
});

// 5. Fire Remotion render of output short
app.post('/api/jobs/:id/render', (req, res) => {
  const job = jobs[req.params.id];
  if (!job) {
    return res.status(404).json({ error: 'Trabajo no encontrado' });
  }

  const { activeColor, inactiveColor, bounce, fontName, fontSize } = req.body;
  
  job.phase = 'rendering';
  job.status = 'processing';
  job.progress = 80;
  job.message = 'Aplicando curvas elásticas de bounce y renderizando con Remotion...';

  res.json({ status: 'rendering_started' });

  renderVideo(
    job.videoPath,
    job.transcription,
    { activeColor, inactiveColor, bounce, fontName, fontSize },
    (renderErr, outputPath) => {
      if (renderErr) {
        job.status = 'failed';
        job.message = `El renderizado del video falló: ${renderErr.message}`;
        return;
      }

      job.phase = 'completed';
      job.status = 'completed';
      job.progress = 100;
      job.message = '¡Video renderizado con éxito!';
      job.outputPath = outputPath;
    }
  );
});

// 6. Download endpoints for video output
app.get('/api/jobs/:id/download', (req, res) => {
  const job = jobs[req.params.id];
  if (!job || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: 'Video final no disponible' });
  }
  res.download(job.outputPath, 'reels_automator_output.mp4');
});

// 7. Stream job video for UI preview
app.get('/api/jobs/:id/video', (req, res) => {
  const job = jobs[req.params.id];
  if (!job || !fs.existsSync(job.videoPath)) {
    return res.status(404).json({ error: 'Video de origen no encontrado' });
  }
  res.sendFile(job.videoPath);
});

// 8. Stream compiled job video
app.get('/api/jobs/:id/output-video', (req, res) => {
  const job = jobs[req.params.id];
  if (!job || !job.outputPath || !fs.existsSync(job.outputPath)) {
    return res.status(404).json({ error: 'Video final no encontrado' });
  }
  res.sendFile(job.outputPath);
});

export default app;
