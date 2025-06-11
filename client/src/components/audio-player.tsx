import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface AudioPlayerProps {
  audioUrl?: string;
  onPlaybackComplete?: () => void;
  autoPlay?: boolean;
}

export default function AudioPlayer({ audioUrl, onPlaybackComplete, autoPlay = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastAudioUrlRef = useRef<string | undefined>();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    // Skip if same audio URL to prevent unnecessary reloads
    if (lastAudioUrlRef.current === audioUrl) {
      console.log('[AudioPlayer] Skipping reload - same audio URL');
      return;
    }

    console.log('[AudioPlayer] Setting up audio with URL:', audioUrl?.substring(0, 50) + '...');
    lastAudioUrlRef.current = audioUrl;

    const handleLoadedMetadata = () => {
      console.log('[AudioPlayer] Audio loaded, duration:', audio.duration);
      setDuration(audio.duration);
      if (autoPlay) {
        console.log('[AudioPlayer] Auto-playing audio');
        audio.play();
        setIsPlaying(true);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      console.log('[AudioPlayer] Audio ended naturally');
      setIsPlaying(false);
      setCurrentTime(0);
      // Ensure audio doesn't restart
      audio.pause();
      audio.currentTime = 0;
      onPlaybackComplete?.();
    };

    const handlePlay = () => {
      console.log('[AudioPlayer] Audio started playing');
      setIsPlaying(true);
    };

    const handlePause = () => {
      console.log('[AudioPlayer] Audio paused');
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    // Ensure no loop attribute
    audio.loop = false;
    
    // Load the audio
    audio.load();

    return () => {
      console.log('[AudioPlayer] Cleaning up audio listeners');
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [audioUrl, autoPlay, onPlaybackComplete]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressChange = (value: number[]) => {
    const audio = audioRef.current;
    if (audio && duration > 0) {
      const newTime = (value[0] / 100) * duration;
      audio.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="audio-controls bg-card/50 rounded-2xl p-6 border border-border space-y-4">
      <audio 
        ref={audioRef} 
        preload="metadata"
        loop={false}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
          onPlaybackComplete?.();
        }}
      >
        {audioUrl && <source src={audioUrl} type="audio/mpeg" />}
      </audio>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            size="lg"
            onClick={togglePlayPause}
            disabled={!audioUrl}
            className="w-14 h-14 rounded-full bg-primary hover:bg-primary/80"
          >
            {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </Button>
          <div className="text-sm text-muted-foreground">
            <div>{formatTime(currentTime)}</div>
            <div className="text-xs">/ {formatTime(duration)}</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleMute}
            className="p-2"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <div className="w-24">
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={100}
              step={1}
              className="cursor-pointer"
            />
          </div>
        </div>
      </div>
      
      {/* Audio Progress Bar */}
      <div className="space-y-2">
        <Slider
          value={[progressPercent]}
          onValueChange={handleProgressChange}
          max={100}
          step={0.1}
          className="cursor-pointer"
        />
      </div>
      
      {/* Audio Status */}
      <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
        <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
        <span>
          {!audioUrl ? 'Generating audio...' : 
           isPlaying ? 'Playing chapter narration...' : 
           'Ready to play'}
        </span>
      </div>
    </div>
  );
}
