import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, 
  Languages, 
  Type, 
  Sparkles, 
  Video, 
  Sliders, 
  Paintbrush, 
  Download, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw,
  Edit2,
  Trash2,
  Plus
} from 'lucide-react';

interface Word {
  text: string;
  start: number;
  end: number;
}

export default function App() {
  // Input states
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string>('');
  const [language, setLanguage] = useState<string>('es');
  
  // Custom design states
  const [activeColor, setActiveColor] = useState<string>('#EAB308'); // Amber/Yellow
  const [inactiveColor, setInactiveColor] = useState<string>('#FFFFFF'); // White
  const [bounceIntensity, setBounceIntensity] = useState<number>(0.3);
  const [fontName, setFontName] = useState<string>('Impact');
  const [fontSize, setFontSize] = useState<number>(54);

  // Job orchestration states
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('idle'); // idle, uploading, processing, ready, rendering, completed, failed
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [jobMessage, setJobMessage] = useState<string>('');
  const [jobPhase, setJobPhase] = useState<string>('');
  
  // Subtiles transcription state
  const [subtitles, setSubtitles] = useState<Word[]>([]);
  const [editingWordIndex, setEditingWordIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Video playback preview state
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [renderFinishedUrl, setRenderFinishedUrl] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Poll job status
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (jobId && (jobStatus === 'processing' || jobStatus === 'rendering')) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${jobId}`);
          if (!res.ok) return;
          const data = await res.json();
          setJobProgress(data.progress);
          setJobMessage(data.message);
          setJobPhase(data.phase);
          
          if (data.status === 'completed') {
            setJobStatus('completed');
            setRenderFinishedUrl(`/api/jobs/${jobId}/output-video?t=${Date.now()}`);
          } else if (data.status === 'failed') {
            setJobStatus('failed');
          } else if (data.phase === 'ready_to_style' && jobStatus === 'processing') {
            setSubtitles(data.transcription || []);
            setJobStatus('ready');
          }
        } catch (err) {
          console.error('Error tracking job:', err);
        }
      }, 1500);
    }
    return () => clearInterval(intervalId);
  }, [jobId, jobStatus]);

  // Synchronize local preview with video playback
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [videoPreviewUrl, jobStatus]);

  // Handle Drag & Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith('video/')) {
      alert('Por favor, selecciona un archivo de video válido.');
      return;
    }
    setVideoFile(file);
    setVideoPreviewUrl(URL.createObjectURL(file));
    setJobStatus('idle');
    setJobId(null);
    setSubtitles([]);
    setRenderFinishedUrl('');
  };

  // Submit for audio extraction and transcription
  const startTranscription = async () => {
    if (!videoFile) return;

    setJobStatus('processing');
    setJobProgress(5);
    setJobMessage('Subiendo archivo al servidor local...');
    setJobPhase('uploading');

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('language', language);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('La carga falló.');
      }

      const data = await res.json();
      setJobId(data.jobId);
    } catch (err: any) {
      setJobStatus('failed');
      setJobMessage(err.message || 'Error en la conexión con el servidor.');
    }
  };

  // Trigger Remotion compile output
  const compileVideo = async () => {
    if (!jobId) return;

    setJobStatus('rendering');
    setJobProgress(75);
    setJobMessage('Inicializando el compilador Remotion...');

    try {
      const res = await fetch(`/api/jobs/${jobId}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activeColor,
          inactiveColor,
          bounce: bounceIntensity,
          fontName,
          fontSize
        })
      });

      if (!res.ok) {
        throw new Error('Fallo al disparar el renderizado.');
      }
    } catch (err: any) {
      setJobStatus('failed');
      setJobMessage(err.message || 'Error al compilar el video.');
    }
  };

  // Update words on edit
  const saveEditedWord = async (index: number) => {
    if (editingText.trim() === '' || !jobId) return;

    const updated = [...subtitles];
    updated[index].text = editingText.toUpperCase();
    setSubtitles(updated);
    setEditingWordIndex(null);

    // Sync back to server
    try {
      await fetch(`/api/jobs/${jobId}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcription: updated }),
      });
    } catch (err) {
      console.error('Error synchronizing word edit:', err);
    }
  };

  // Group subtitles in blocks of 3-4 words for live-preview calculation
  const getActiveGroupWords = () => {
    const groupSize = 3;
    const wordGroups: Word[][] = [];
    for (let i = 0; i < subtitles.length; i += groupSize) {
      wordGroups.push(subtitles.slice(i, i + groupSize));
    }

    const activeGroup = wordGroups.find((words) => {
      if (words.length === 0) return false;
      const start = words[0].start;
      const end = words[words.length - 1].end + 0.1;
      return currentTime >= start && currentTime <= end;
    });

    return activeGroup || null;
  };

  const activeGroup = getActiveGroupWords();

  // Highlight bounce logic calculation for DOM preview
  const getWordBounceStyle = (word: Word) => {
    const isActive = currentTime >= word.start && currentTime <= word.end;
    if (!isActive) return { color: inactiveColor, transform: 'scale(1)' };

    // Standard CSS scale animation simulation based on timing
    return {
      color: activeColor,
      transform: `scale(${1 + bounceIntensity})`,
      transition: 'transform 0.08s ease-out, color 0.05s ease'
    };
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-black">
      {/* Upper Navigation Bar */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-xl text-black shadow-lg shadow-amber-500/10">
              <Sparkles className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white mb-0.5">Reels Automator</h1>
              <span className="text-xs font-mono text-slate-400">REMOTE WHISPER ENGINE v1.2</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-full text-xs font-mono text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              SERVER ONLINE
            </span>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side Controls (Lg: 7 Columns) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Section 1: Video Import */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4">
              <Video className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-white">1. Cargar Video Origen (9:16)</h2>
            </div>

            {!videoFile ? (
              <div
                ref={dragRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('video-input')?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging 
                    ? 'border-amber-500 bg-amber-500/5' 
                    : 'border-slate-850 hover:border-slate-700 bg-slate-950/40'
                }`}
              >
                <input
                  id="video-input"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-4 border border-slate-800">
                  <Upload className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-semibold text-white mb-1">Arrastra tu video vertical aquí</p>
                <p className="text-xs text-slate-500">O haz clic para seleccionar (MP4, MOV, etc. hasta 100MB)</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-10 h-10 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0">
                    <Video className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-white truncate">{videoFile.name}</p>
                    <p className="text-xs text-slate-500">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setVideoFile(null);
                    setVideoPreviewUrl('');
                    setJobStatus('idle');
                    setSubtitles([]);
                  }}
                  className="p-2 hover:bg-red-500/10 hover:text-red-400 text-slate-400 rounded-lg transition-colors"
                  title="Eliminar archivo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Section 2: Transcription Prompt and Config */}
          {videoFile && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2 mb-4">
                <Languages className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-white">2. Configuración de Transcripción</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Idiomas Esperados</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    disabled={jobStatus !== 'idle'}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                  >
                    <option value="es">Español (es)</option>
                    <option value="en">Inglés (en)</option>
                    <option value="pt">Portugués (pt)</option>
                    <option value="fr">Francés (fr)</option>
                  </select>
                </div>

                <div>
                  {jobStatus === 'idle' && (
                    <button
                      onClick={startTranscription}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black py-2.5 px-6 rounded-xl font-semibold text-sm transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Iniciar Extracción Directa
                    </button>
                  )}

                  {['processing', 'uploading'].includes(jobStatus) && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs text-slate-400">
                        <span className="font-mono text-amber-500 font-semibold">{jobProgress}%</span>
                        <span>{jobPhase.replace('_', ' ').toUpperCase()}</span>
                      </div>
                      <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300" 
                          style={{ width: `${jobProgress}%` }}
                        ></div>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug truncate">{jobMessage}</p>
                    </div>
                  )}

                  {['ready', 'rendering', 'completed'].includes(jobStatus) && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>Transcripción de voz completada correctamente.</span>
                    </div>
                  )}

                  {jobStatus === 'failed' && (
                    <div className="space-y-3">
                      <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>Módulo de voz offline u ocurrió un problema.</span>
                      </div>
                      <button
                        onClick={startTranscription}
                        className="text-xs text-amber-500 hover:text-amber-400 underline font-semibold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reintentar proceso
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Section 3: Subtitle Correction */}
          {subtitles.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md flex-1 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Type className="w-5 h-5 text-amber-500" />
                  <h2 className="text-lg font-semibold text-white">3. Corrección de Palabras Interactivas</h2>
                </div>
                <span className="text-xs font-mono text-slate-400">{subtitles.length} palabras detectadas</span>
              </div>
              
              <p className="text-xs text-slate-400 mb-4">
                Haz clic en cualquier palabra para corregir ortografías o mayúsculas. Presiona Enter o haz clic en Guardar para confirmar los cambios interactivos.
              </p>

              <div className="flex-1 bg-slate-950/50 rounded-xl border border-slate-850 p-4 max-h-[320px] overflow-y-auto">
                <div className="flex flex-wrap gap-2.5">
                  {subtitles.map((word, idx) => {
                    const isPassed = currentTime > word.end;
                    const isActive = currentTime >= word.start && currentTime <= word.end;
                    
                    return (
                      <div key={idx} className="relative group">
                        {editingWordIndex === idx ? (
                          <div className="flex items-center gap-1 border border-amber-500 bg-slate-900 rounded-lg p-1 z-10 shadow-lg">
                            <input
                              type="text"
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditedWord(idx);
                              }}
                              className="bg-slate-950 border-0 focus:ring-0 outline-none p-1 text-xs text-white max-w-[80px]"
                              autoFocus
                            />
                            <button
                              onClick={() => saveEditedWord(idx)}
                              className="bg-amber-500 text-black p-1 rounded hover:bg-amber-400 text-[10px] font-bold"
                            >
                              SÍ
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingWordIndex(idx);
                              setEditingText(word.text);
                            }}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all flex items-center gap-1.5 ${
                              isActive 
                                ? 'bg-amber-500 border-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20' 
                                : isPassed
                                  ? 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                                  : 'bg-slate-900 border-slate-850 text-slate-200 hover:border-slate-650'
                            }`}
                          >
                            <span>{word.text}</span>
                            <span className="text-[9px] opacity-40 group-hover:opacity-100 transition-opacity">
                              {word.start}s
                            </span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Section 4: Remotion Visual Styling Panel */}
          {subtitles.length > 0 && (
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center gap-2 mb-4">
                <Paintbrush className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-white">4. Personalización del Estilo Reel</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Visual Colors & Fonts */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-450 uppercase mb-2">Palabras Activas (Highlight)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={activeColor}
                        onChange={(e) => setActiveColor(e.target.value)}
                        className="w-10 h-10 rounded-xl bg-transparent border border-slate-800 cursor-pointer overflow-hidden p-0"
                      />
                      <input
                        type="text"
                        value={activeColor}
                        onChange={(e) => setActiveColor(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-mono uppercase text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-450 uppercase mb-2">Color Base Alrededor</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={inactiveColor}
                        onChange={(e) => setInactiveColor(e.target.value)}
                        className="w-10 h-10 rounded-xl bg-transparent border border-slate-800 cursor-pointer overflow-hidden p-0"
                      />
                      <input
                        type="text"
                        value={inactiveColor}
                        onChange={(e) => setInactiveColor(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs font-mono uppercase text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-450 uppercase mb-2">Tipografía Principal</label>
                    <select
                      value={fontName}
                      onChange={(e) => setFontName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-xs text-white"
                    >
                      <option value="Impact">Impact (Classic Bold)</option>
                      <option value="Montserrat">Montserrat Black</option>
                      <option value="Space Grotesk">Space Grotesk</option>
                      <option value="Bungee">Bungee (Rounded Retro)</option>
                      <option value="Arial">Arial Black</option>
                    </select>
                  </div>
                </div>

                {/* Sizes and Bounce Intensity */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-slate-450 uppercase">Intensidad Bounce (Física)</label>
                      <span className="text-xs font-mono text-amber-500 font-semibold">{bounceIntensity.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.0"
                      max="0.6"
                      step="0.05"
                      value={bounceIntensity}
                      onChange={(e) => setBounceIntensity(parseFloat(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Plano (0.0x)</span>
                      <span>Estándar (0.3x)</span>
                      <span>Brutal (0.6x)</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-semibold text-slate-450 uppercase">Tamaño de Fuente (PX)</label>
                      <span className="text-xs font-mono text-amber-500 font-semibold">{fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="24"
                      max="80"
                      value={fontSize}
                      onChange={(e) => setFontSize(parseInt(e.target.value))}
                      className="w-full accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>Pequeño</span>
                      <span>Normal</span>
                      <span>Inmenso</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    {['ready', 'failed'].includes(jobStatus) && (
                      <button
                        onClick={compileVideo}
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black hover:from-amber-400 hover:to-amber-500 py-3 rounded-xl font-bold text-sm shadow-lg shadow-amber-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                      >
                        <Sparkles className="w-4 h-4 fill-black" />
                        Renderizar Video con Remotion
                      </button>
                    )}

                    {jobStatus === 'rendering' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                            Escribiendo fotogramas...
                          </span>
                          <span className="font-mono text-amber-500 font-semibold">{jobProgress}%</span>
                        </div>
                        <div className="h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-850">
                          <div 
                            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-300" 
                            style={{ width: `${jobProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-snug">{jobMessage}</p>
                      </div>
                    )}

                    {jobStatus === 'completed' && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>Compilación finalizada con éxito. Descarga abajo.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Right Side Video Layout Area (Lg: 5 Columns) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex-1 flex flex-col">
            
            <div className="flex items-center justify-between mb-4 border-b border-slate-850 pb-3">
              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-500" />
                Live Preview E-Shorts
              </span>
              <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-850">
                {currentTime.toFixed(2)}s
              </span>
            </div>

            {/* Simulated 9:16 vertical viewport device */}
            <div className="flex-1 min-h-[460px] relative bg-slate-950 rounded-xl overflow-hidden border border-slate-850 flex items-center justify-center">
              {videoPreviewUrl ? (
                <>
                  <video
                    ref={videoRef}
                    src={jobStatus === 'completed' && renderFinishedUrl ? renderFinishedUrl : videoPreviewUrl}
                    className="w-full h-full object-cover max-h-[620px]"
                    controls={false}
                    onClick={() => {
                      if (videoRef.current) {
                        if (isPlaying) {
                          videoRef.current.pause();
                        } else {
                          videoRef.current.play();
                        }
                      }
                    }}
                  />

                  {/* Render final overlay watermark if compiled */}
                  {jobStatus === 'completed' && (
                    <div className="absolute top-4 left-4 bg-emerald-500 text-black font-mono font-black text-[10px] px-2.5 py-1 rounded shadow-lg flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> VERSIÓN PROCESADA
                    </div>
                  )}

                  {/* Realtime HTML-simulated high-impact subtitle overlay! */}
                  {subtitles.length > 0 && activeGroup && (
                    <div 
                      className="absolute left-0 right-0 text-center pointer-events-none"
                      style={{
                        top: '70%',
                        transform: 'translateY(-50%)'
                      }}
                    >
                      <div 
                        className="flex justify-center flex-wrap gap-x-3 gap-y-2 px-6"
                        style={{
                          fontFamily: fontName,
                          fontSize: `${fontSize * 0.7}px`, // slightly scaled down to fit mobile viewport
                          textTransform: 'uppercase',
                          textShadow: '3px 3px 0px #000000',
                          letterSpacing: '1px'
                        }}
                      >
                        {activeGroup.map((word, wordIdx) => {
                          const wordStyle = getWordBounceStyle(word);
                          return (
                            <span 
                              key={wordIdx} 
                              style={wordStyle}
                              className="inline-block transition-all"
                            >
                              {word.text}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Centered Big Play button when paused */}
                  {!isPlaying && (
                    <button 
                      onClick={() => videoRef.current?.play()}
                      className="absolute p-4 rounded-full bg-black/60 border border-slate-700 text-white backdrop-blur-sm shadow-xl active:scale-[0.9] hover:bg-black/80 transition-all"
                    >
                      <Play className="w-6 h-6 fill-white" />
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center p-8 text-slate-500">
                  <Video className="w-16 h-16 stroke-[1.2] mx-auto mb-4 opacity-25" />
                  <p className="text-sm">Tu reproductor de video se activará cargando un origen.</p>
                </div>
              )}
            </div>

            {/* Video Action Bar & Metadata */}
            {videoPreviewUrl && (
              <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between gap-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        if (isPlaying) {
                          videoRef.current.pause();
                        } else {
                          videoRef.current.play();
                        }
                      }
                    }}
                    className="p-2.5 bg-slate-950 border border-slate-850 rounded-xl text-white hover:bg-slate-90 shadow min-w-[42px] flex justify-center"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                  </button>
                  
                  <button
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = 0;
                        setCurrentTime(0);
                      }
                    }}
                    className="p-2.5 bg-slate-950 border border-slate-850 rounded-xl text-slate-300 hover:bg-slate-900"
                    title="Reiniciar video"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {jobStatus === 'completed' && renderFinishedUrl && (
                  <a
                    href={`/api/jobs/${jobId}/download`}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black py-2.5 px-4 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 transition-all text-center"
                    download
                  >
                    <Download className="w-4 h-4 stroke-[2.5]" />
                    DESCARGAR SHORT FINAL
                  </a>
                )}
              </div>
            )}

          </div>
        </div>

      </main>

      <footer className="border-t border-slate-900 bg-slate-950 mt-12 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6">
          <p>© 2026 Reels Automator - Herramienta de compilación local de shorts de alto impacto.</p>
        </div>
      </footer>
    </div>
  );
}
