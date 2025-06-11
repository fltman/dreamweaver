import { useState, useEffect, useRef } from "react";
import { StoryChoice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface VoiceChoiceSelectorProps {
  choices: StoryChoice[];
  onChoiceSelect: (choiceId: string) => void;
  autoStartListening?: boolean;
}

export default function VoiceChoiceSelector({ 
  choices, 
  onChoiceSelect,
  autoStartListening = true
}: VoiceChoiceSelectorProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [sleepTimeoutId, setSleepTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [silenceTimeoutId, setSilenceTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Initialize media recorder for audio recording
    const initializeMediaRecorder = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        const recorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });
        
        let recordingChunks: Blob[] = [];
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordingChunks.push(event.data);
          }
        };
        
        recorder.onstop = () => {
          // Process audio chunks when recording stops
          if (recordingChunks.length > 0) {
            const audioBlob = new Blob(recordingChunks, { type: 'audio/webm;codecs=opus' });
            transcribeAudio(audioBlob);
            recordingChunks = [];
          }
        };
        
        setMediaRecorder(recorder);
      } catch (error) {
        console.error('Failed to initialize media recorder:', error);
      }
    };
    
    initializeMediaRecorder();
    
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Auto-start listening when component mounts with longer delay
  useEffect(() => {
    if (autoStartListening && mediaRecorder && !isListening) {
      setTimeout(() => {
        startListening();
      }, 3000); // Longer delay to ensure audio has finished completely
    }
  }, [mediaRecorder, autoStartListening]);

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      console.log('[VoiceChoice] Transcribing audio blob, size:', audioBlob.size);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.webm');
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      const transcribedText = result.text || '';
      
      console.log('[VoiceChoice] Transcription result:', transcribedText);
      setTranscript(transcribedText);
      
      if (transcribedText.trim()) {
        checkForChoiceMatch(transcribedText.toLowerCase().trim());
      }
    } catch (error) {
      console.error('[VoiceChoice] Transcription error:', error);
    }
  };

  const checkForChoiceMatch = (spokenText: string) => {
    const normalizedText = spokenText.replace(/[^\w\s]/g, '').toLowerCase();
    
    // Check for exact matches or key words in choices
    for (const choice of choices) {
      const choiceText = choice.text.toLowerCase();
      const choiceWords = choiceText.split(' ');
      
      // Check if spoken text contains key words from choice
      const hasKeyWords = choiceWords.some(word => 
        word.length > 3 && normalizedText.includes(word.toLowerCase())
      );
      
      // Check for number-based selection (e.g., "one", "first", "two", "second")
      const choiceIndex = choices.indexOf(choice);
      const numberWords = ['first', 'one', '1', 'second', 'two', '2', 'third', 'three', '3'];
      const hasNumberMatch = numberWords.slice(choiceIndex * 2, choiceIndex * 2 + 2).some(num => 
        normalizedText.includes(num)
      );
      
      if (hasKeyWords || hasNumberMatch) {
        setSelectedChoice(choice.id);
        setTimeout(() => onChoiceSelect(choice.id), 1000); // Small delay to show selection
        return;
      }
    }
  };

  const startListening = () => {
    if (!mediaRecorder || isListening || mediaRecorder.state !== 'inactive') return;
    
    setIsListening(true);
    setIsRecording(true);
    setTranscript("");
    setSelectedChoice(null);
    
    try {
      console.log('[VoiceChoice] Starting audio recording');
      mediaRecorder.start(1000); // Collect data every 1 second
      
      // Set a 60-second timeout for sleep detection
      if (sleepTimeoutId) {
        clearTimeout(sleepTimeoutId);
      }
      
      const newSleepTimeout = setTimeout(() => {
        console.log('User seems to be asleep, stopping voice recording');
        stopListening();
        onChoiceSelect('__SLEEP__'); // Special signal to indicate sleep
      }, 60000); // 60 seconds
      
      setSleepTimeoutId(newSleepTimeout);
      
      // Auto-stop recording after 5 seconds to get a voice sample
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          console.log('[VoiceChoice] Auto-stopping recording after 5 seconds');
          stopListening();
        }
      }, 5000);
      
    } catch (error) {
      console.error('Error starting audio recording:', error);
      setIsListening(false);
      setIsRecording(false);
    }
  };

  const stopListening = () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      console.log('[VoiceChoice] Stopping audio recording');
      mediaRecorder.stop();
    }
    setIsListening(false);
    setIsRecording(false);
    
    // Clear timeouts
    if (sleepTimeoutId) {
      clearTimeout(sleepTimeoutId);
      setSleepTimeoutId(null);
    }
    if (silenceTimeoutId) {
      clearTimeout(silenceTimeoutId);
      setSilenceTimeoutId(null);
    }
  };

  const handleManualChoice = (choiceId: string) => {
    setSelectedChoice(choiceId);
    onChoiceSelect(choiceId);
  };

  return (
    <div className="space-y-6 pt-6 animate-fade-in">
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-light">What happens next?</h3>
        <p className="text-muted-foreground">Speak your choice (using AI transcription) or tap to select</p>
      </div>
      
      {/* Voice Control Section */}
      <div className="text-center space-y-4 p-6 bg-card/30 rounded-2xl border border-border/50">
        <div className="flex items-center justify-center space-x-4">
          <Button
            onClick={isListening ? stopListening : startListening}
            variant={isListening ? "destructive" : "default"}
            size="lg"
            className="rounded-full"
          >
            {isListening ? (
              <>
                <MicOff className="w-5 h-5 mr-2" />
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Start Voice Command
              </>
            )}
          </Button>
        </div>
        
        {isListening && (
          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-muted-foreground">Listening...</span>
            </div>
            {transcript && (
              <p className="text-sm italic bg-muted/50 p-2 rounded">
                "{transcript}"
              </p>
            )}
          </div>
        )}
      </div>
      
      {/* Choice Buttons */}
      <div className="grid gap-4 md:grid-cols-2">
        {choices.map((choice, index) => (
          <Button
            key={choice.id}
            onClick={() => handleManualChoice(choice.id)}
            variant={selectedChoice === choice.id ? "default" : "outline"}
            className={`choice-btn p-6 h-auto text-left transition-all duration-300 ${
              selectedChoice === choice.id ? 'ring-2 ring-primary bg-primary text-primary-foreground' : 'hover:bg-accent'
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium bg-primary/20 px-2 py-1 rounded">
                  Option {index + 1}
                </span>
              </div>
              <div className="font-medium">{choice.text}</div>
              {choice.description && (
                <div className="text-sm opacity-80">{choice.description}</div>
              )}
            </div>
          </Button>
        ))}
      </div>
      
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Say "Option one", "Option two", or speak keywords from your choice
        </p>
      </div>
    </div>
  );
}