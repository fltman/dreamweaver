import { Voice } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

interface VoiceSelectorProps {
  selectedVoice?: string;
  onVoiceSelect: (voice: string) => void;
}

export default function VoiceSelector({ selectedVoice, onVoiceSelect }: VoiceSelectorProps) {
  const { data: voices = [], isLoading } = useQuery<Voice[]>({
    queryKey: ['/api/voices']
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-light text-center">Select Your Storyteller</h3>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-light text-center">Select Your Storyteller</h3>
      <div className="flex flex-wrap justify-center gap-3">
        {voices.map((voice) => (
          <button
            key={voice.id}
            onClick={() => onVoiceSelect(voice.id)}
            className={`voice-btn bg-secondary/30 hover:bg-primary/30 border border-border hover:border-primary/50 rounded-full px-6 py-3 transition-all duration-300 ${
              selectedVoice === voice.id ? 'selected' : ''
            }`}
          >
            <span className="mr-2">
              {voice.id === 'sarah' && '👩'}
              {voice.id === 'david' && '👨'} 
              {voice.id === 'luna' && '🌙'}
            </span>
            {voice.name} - {voice.description}
          </button>
        ))}
      </div>
    </div>
  );
}
