import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, Volume2, VolumeX, Loader2 } from "lucide-react";

interface StreamingAudioPlayerProps {
  text: string;
  voiceId: string;
  onPlaybackComplete?: () => void;
  autoPlay?: boolean;
  onPlayingChange?: (isPlaying: boolean) => void;
}

export default function StreamingAudioPlayer({
  text,
  voiceId,
  onPlaybackComplete,
  autoPlay = false,
  onPlayingChange
}: StreamingAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isMuted, setIsMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const fetchedRef = useRef<string | null>(null);

  // Fetch streaming audio and convert to blob URL
  const fetchStreamingAudio = async () => {
    // Prevent duplicate fetches for the same text
    if (fetchedRef.current === text) {
      console.log('[StreamingAudio] Already fetched for this text');
      return;
    }
    fetchedRef.current = text;

    setIsLoading(true);
    console.log(`[StreamingAudio] Fetching audio stream for ${text.length} chars, voice: ${voiceId}`);

    try {
      const response = await fetch('/api/audio/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voiceId })
      });

      if (!response.ok) {
        throw new Error(`Failed to stream audio: ${response.statusText}`);
      }

      // Collect chunks as they arrive
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;
      let firstChunkTime: number | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (!firstChunkTime) {
          firstChunkTime = Date.now();
          console.log('[StreamingAudio] First chunk received');
        }

        chunks.push(value);
        totalBytes += value.length;
      }

      console.log(`[StreamingAudio] Stream complete, total: ${totalBytes} bytes`);

      // Create blob and URL
      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      // Clean up old blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      blobUrlRef.current = url;

      // Set audio source
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
        setAudioReady(true);
      }

    } catch (error) {
      console.error('[StreamingAudio] Error:', error);
      fetchedRef.current = null; // Allow retry on error
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch audio when text changes
  useEffect(() => {
    if (text && voiceId) {
      fetchStreamingAudio();
    }

    return () => {
      // Cleanup blob URL on unmount
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [text, voiceId]);

  // Set up audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      console.log('[StreamingAudio] Audio loaded, duration:', audio.duration);
      setDuration(audio.duration);
      if (autoPlay && audioReady) {
        console.log('[StreamingAudio] Auto-playing audio');
        audio.play().catch(error => {
          console.error('[StreamingAudio] Auto-play failed:', error);
        });
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      console.log('[StreamingAudio] Audio ended');
      setIsPlaying(false);
      setCurrentTime(0);
      audio.pause();
      audio.currentTime = 0;
      onPlaybackComplete?.();
    };

    const handlePlay = () => {
      console.log('[StreamingAudio] Audio started playing');
      setIsPlaying(true);
      onPlayingChange?.(true);
    };

    const handlePause = () => {
      console.log('[StreamingAudio] Audio paused');
      setIsPlaying(false);
      onPlayingChange?.(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    audio.loop = false;

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [autoPlay, audioReady, onPlaybackComplete, onPlayingChange]);

  // Auto-play when audio becomes ready
  useEffect(() => {
    if (audioReady && autoPlay && audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, [audioReady, autoPlay]);

  // Volume control
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !audioReady) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
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
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            size="lg"
            onClick={togglePlayPause}
            disabled={isLoading || !audioReady}
            className="w-14 h-14 rounded-full bg-primary hover:bg-primary/80"
          >
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
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
          disabled={!audioReady}
        />
      </div>

      {/* Audio Status */}
      <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
        <div className={`w-2 h-2 rounded-full ${
          isLoading ? 'bg-yellow-400 animate-pulse' :
          isPlaying ? 'bg-green-400 animate-pulse' :
          audioReady ? 'bg-blue-400' : 'bg-gray-400'
        }`}></div>
        <span>
          {isLoading ? 'Streaming audio...' :
           isPlaying ? 'Playing chapter narration...' :
           audioReady ? 'Ready to play' :
           'Preparing audio...'}
        </span>
      </div>
    </div>
  );
}
