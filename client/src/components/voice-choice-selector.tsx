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

  const analyzeAudioForSpeech = async (audioBlob: Blob): Promise<boolean> => {
    return new Promise((resolve) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const fileReader = new FileReader();
      
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          
          // Analyze audio for speech characteristics
          const channelData = audioBuffer.getChannelData(0);
          const duration = audioBuffer.duration;
          
          // Calculate RMS (Root Mean Square) to detect audio level
          let sum = 0;
          let peakCount = 0;
          const threshold = 0.01; // Minimum threshold for speech detection
          
          for (let i = 0; i < channelData.length; i++) {
            const sample = Math.abs(channelData[i]);
            sum += sample * sample;
            
            // Count peaks above threshold
            if (sample > threshold) {
              peakCount++;
            }
          }
          
          const rms = Math.sqrt(sum / channelData.length);
          const peakRatio = peakCount / channelData.length;
          
          console.log('[VoiceChoice] Audio analysis:', {
            duration: duration.toFixed(2) + 's',
            rms: rms.toFixed(4),
            peakRatio: peakRatio.toFixed(4),
            peakCount
          });
          
          // Consider it speech if:
          // - RMS is above minimum threshold (has audio content)
          // - Peak ratio indicates dynamic audio (not just noise)
          // - Duration is reasonable (not too short)
          const hasSpeech = rms > 0.005 && peakRatio > 0.02 && duration > 0.5;
          
          resolve(hasSpeech);
        } catch (error) {
          console.error('[VoiceChoice] Audio analysis error:', error);
          // If analysis fails, assume there might be speech to be safe
          resolve(true);
        }
      };
      
      fileReader.onerror = () => {
        console.error('[VoiceChoice] FileReader error');
        resolve(true); // Default to true if we can't analyze
      };
      
      fileReader.readAsArrayBuffer(audioBlob);
    });
  };

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
            
            // Check if audio contains speech before sending to backend
            analyzeAudioForSpeech(audioBlob).then((hasSpeech: boolean) => {
              if (hasSpeech) {
                console.log('[VoiceChoice] Speech detected, transcribing...');
                transcribeAudio(audioBlob);
              } else {
                console.log('[VoiceChoice] No speech detected, skipping transcription');
                setIsListening(false);
                setIsRecording(false);
              }
            });
            
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
    } finally {
      setIsListening(false);
      setIsRecording(false);
    }
  };

  const checkForChoiceMatch = (spokenText: string) => {
    const normalizedText = spokenText.replace(/[^\w\s]/g, '').toLowerCase();
    
    // Check for exact matches or key words in choices
    for (const choice of choices) {
      const choiceText = choice.text.toLowerCase();
      const choiceWords = choiceText.split(' ').filter(word => word.length > 2);
      
      // Check if any significant words from the choice appear in the spoken text
      const hasKeyWords = choiceWords.some(word => 
        normalizedText.includes(word.toLowerCase())
      );
      
      // Check for number-based selection (e.g., "one", "first", "two", "second")
      const choiceIndex = choices.indexOf(choice);
      const numberWords = ['first', 'one', '1', 'second', 'two', '2', 'third', 'three', '3'];
      const hasNumberMatch = numberWords.slice(choiceIndex * 2, choiceIndex * 2 + 2).some(num => 
        normalizedText.includes(num)
      );
      
      if (hasKeyWords || hasNumberMatch) {
        // Clear all timeouts when voice choice is detected
        if (sleepTimeoutId) {
          clearTimeout(sleepTimeoutId);
          setSleepTimeoutId(null);
        }
        if (silenceTimeoutId) {
          clearTimeout(silenceTimeoutId);
          setSilenceTimeoutId(null);
        }
        
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
    // Clear all timeouts when user manually selects a choice
    if (sleepTimeoutId) {
      clearTimeout(sleepTimeoutId);
      setSleepTimeoutId(null);
    }
    if (silenceTimeoutId) {
      clearTimeout(silenceTimeoutId);
      setSilenceTimeoutId(null);
    }
    
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
                {isRecording ? "Stop Recording" : "Stop Listening"}
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
              <span className="text-sm text-muted-foreground">
                {isRecording ? "Recording your voice..." : "Processing..."}
              </span>
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
            className={`p-6 h-auto text-left justify-start transition-all duration-300 ${
              selectedChoice === choice.id ? 'ring-2 ring-primary' : ''
            }`}
            disabled={selectedChoice !== null}
          >
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Choice {index + 1}
                </span>
              </div>
              <p className="text-base">{choice.text}</p>
              {choice.description && (
                <p className="text-sm text-muted-foreground">{choice.description}</p>
              )}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}