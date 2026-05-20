import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Music } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';

interface AudioPlayerProps {
  src: string;
  title?: string;
  albumArt?: string;
  artist?: string;
  autoPlay?: boolean;
}

export function AudioPlayer({ src, title = 'Generated Track', albumArt, artist = 'Chinna AI', autoPlay = false }: AudioPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || !src) return;

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(255, 255, 255, 0.2)',
      progressColor: '#D9F950',
      cursorColor: 'transparent',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      height: 40,
      normalize: true,
    });

    wavesurferRef.current = wavesurfer;

    wavesurfer.load(src);

    wavesurfer.on('ready', () => {
      setIsReady(true);
      setError(null);
      setDuration(wavesurfer.getDuration());
      if (autoPlay) {
        wavesurfer.play().catch(() => console.log('Autoplay prevented'));
      }
    });

    wavesurfer.on('error', (err) => {
      console.error('Wavesurfer error:', err);
      setError('Failed to load audio');
    });

    wavesurfer.on('audioprocess', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on('interaction', () => {
      setCurrentTime(wavesurfer.getCurrentTime());
    });

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    wavesurfer.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    return () => {
      wavesurfer.destroy();
    };
  }, [src, autoPlay]);

  const togglePlay = () => {
    if (wavesurferRef.current && isReady) {
      wavesurferRef.current.playPause();
    }
  };

  const toggleMute = () => {
    if (wavesurferRef.current) {
      const newMutedState = !isMuted;
      wavesurferRef.current.setMuted(newMutedState);
      setIsMuted(newMutedState);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-black/40 border border-white/10 rounded-2xl p-4 w-full flex flex-col gap-4 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-4">
        {/* Album Art */}
        <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-app-purple to-app-pink shadow-lg flex items-center justify-center">
          {albumArt ? (
            <img src={albumArt} alt="Album Art" className="w-full h-full object-cover" />
          ) : (
            <Music className="w-8 h-8 text-white/50" />
          )}
          {isPlaying && (
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
              <div className="flex gap-1 items-end h-4">
                <div className="w-1 bg-white rounded-full animate-[bounce_1s_infinite_0ms]" style={{ height: '100%' }} />
                <div className="w-1 bg-white rounded-full animate-[bounce_1s_infinite_200ms]" style={{ height: '60%' }} />
                <div className="w-1 bg-white rounded-full animate-[bounce_1s_infinite_400ms]" style={{ height: '80%' }} />
              </div>
            </div>
          )}
        </div>

        {/* Track Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-white font-medium text-sm truncate">{title}</h4>
          <p className="text-white/50 text-xs truncate">{artist}</p>
        </div>

        {/* Play/Pause Button */}
        <button 
          onClick={togglePlay}
          disabled={!isReady}
          className="w-12 h-12 shrink-0 rounded-full bg-app-lime text-black flex items-center justify-center hover:scale-105 transition-transform shadow-[0_0_15px_rgba(217,249,80,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
        </button>
      </div>

      {/* Waveform */}
      <div className="flex flex-col gap-1">
        {error ? (
          <div className="w-full h-10 flex items-center justify-center text-red-500 text-xs">
            {error}
          </div>
        ) : (
          <>
            <div ref={containerRef} className="w-full h-10 cursor-pointer" />
            <div className="flex justify-between text-[10px] text-white/50 font-mono mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </>
        )}
      </div>

      {/* Volume Control */}
      <div className="flex items-center gap-2 justify-end">
        <button onClick={toggleMute} className="text-white/50 hover:text-white transition-colors">
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
