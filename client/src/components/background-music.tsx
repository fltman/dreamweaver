import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface BackgroundMusicProps {
  isPlaying: boolean;
  onVolumeChange?: (volume: number) => void;
  storyAudioPlaying?: boolean;
}

const MUSIC_FILES = [
  "Untitled.mp3",
  "Untitled (1).mp3",
  "Untitled (2).mp3",
  "Untitled (3).mp3",
  "Untitled (4).mp3",
  "Untitled (5).mp3",
  "Untitled (6).mp3",
  "Untitled (7).mp3",
  "Untitled (8).mp3",
  "Untitled (9).mp3",
  "Untitled (10).mp3",
  "Untitled (11).mp3",
  "Untitled (12).mp3",
  "Untitled (13).mp3",
  "Untitled (14).mp3",
  "Untitled (15).mp3"
];

export default function BackgroundMusic({ isPlaying, onVolumeChange, storyAudioPlaying = false }: BackgroundMusicProps) {
  const [volume, setVolume] = useState(30); // Lower default volume for background music
  const [isMuted, setIsMuted] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Select random starting track
  useEffect(() => {
    setCurrentTrack(Math.floor(Math.random() * MUSIC_FILES.length));
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    console.log('[BackgroundMusic] State change - isPlaying:', isPlaying, 'storyAudioPlaying:', storyAudioPlaying);

    if (isPlaying && !storyAudioPlaying) {
      console.log('[BackgroundMusic] Starting background music');
      // Small delay to ensure audio element is ready
      setTimeout(() => {
        audio.play().then(() => {
          console.log('[BackgroundMusic] Successfully started playing');
        }).catch(error => {
          console.error('[BackgroundMusic] Failed to start:', error);
        });
      }, 100);
    } else {
      console.log('[BackgroundMusic] Pausing background music');
      audio.pause();
    }
  }, [isPlaying, storyAudioPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = isMuted ? 0 : volume / 100;
      onVolumeChange?.(isMuted ? 0 : volume);
    }
  }, [volume, isMuted, onVolumeChange]);

  const handleTrackEnd = () => {
    // Move to next track, loop back to start when reaching end
    const nextTrack = (currentTrack + 1) % MUSIC_FILES.length;
    setCurrentTrack(nextTrack);
  };

  const handleVolumeChange = (value: number[]) => {
    setVolume(value[0]);
    setIsMuted(false);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="fixed bottom-4 right-4 bg-card/80 backdrop-blur-sm rounded-xl p-4 border border-border/50 space-y-3 min-w-[200px]">
      <audio
        ref={audioRef}
        loop={false}
        onEnded={handleTrackEnd}
        preload="auto"
        onLoadedData={() => console.log('[BackgroundMusic] Audio loaded')}
        onError={(e) => console.error('[BackgroundMusic] Audio error:', e)}
      >
        <source src={`/music/${MUSIC_FILES[currentTrack]}`} type="audio/mpeg" />
      </audio>
      
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Background Music</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleMute}
          className="h-8 w-8 p-0"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <VolumeX className="h-3 w-3 text-muted-foreground" />
          <Slider
            value={[volume]}
            onValueChange={handleVolumeChange}
            max={100}
            step={1}
            className="flex-1"
          />
          <Volume2 className="h-3 w-3 text-muted-foreground" />
        </div>
        <div className="text-xs text-muted-foreground text-center">
          Track {currentTrack + 1} of {MUSIC_FILES.length}
        </div>
      </div>
    </div>
  );
}