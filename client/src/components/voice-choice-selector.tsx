import { useState, useEffect, useRef } from "react";
import { StoryChoice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface VoiceChoiceSelectorProps {
  choices: StoryChoice[];
  onChoiceSelect: (choiceId: string) => void;
  autoStartListening?: boolean;
  chapterNumber?: number;
  voiceId?: string;
}

// Calculate sleep detection settings based on chapter number
// Later chapters = user more likely to fall asleep = more patient detection
function getSleepDetectionSettings(chapterNumber: number) {
  if (chapterNumber <= 2) {
    return { maxAttempts: 4, delayBetweenAttempts: 3000 };
  } else if (chapterNumber <= 4) {
    return { maxAttempts: 5, delayBetweenAttempts: 4000 };
  } else if (chapterNumber <= 6) {
    return { maxAttempts: 6, delayBetweenAttempts: 5000 };
  } else {
    return { maxAttempts: 8, delayBetweenAttempts: 6000 };
  }
}

export default function VoiceChoiceSelector({
  choices,
  onChoiceSelect,
  autoStartListening = true,
  chapterNumber = 1,
  voiceId = 'sarah'
}: VoiceChoiceSelectorProps) {
  const sleepSettings = getSleepDetectionSettings(chapterNumber);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [sleepTimeoutId, setSleepTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [silenceTimeoutId, setSilenceTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isReadingChoices, setIsReadingChoices] = useState(false);
  const [choicesRead, setChoicesRead] = useState(false);
  const [recorderReady, setRecorderReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const choicesAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Getter for mediaRecorder that always returns the ref value
  const mediaRecorder = mediaRecorderRef.current;

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
                setAttemptCount(0); // Reset attempt count on speech detection
                transcribeAudio(audioBlob);
              } else {
                console.log('[VoiceChoice] No speech detected, incrementing attempt count');
                const newAttemptCount = attemptCount + 1;
                setAttemptCount(newAttemptCount);
                
                // Trigger sleep detection after max attempts (varies by chapter)
                if (newAttemptCount >= sleepSettings.maxAttempts) {
                  console.log(`[VoiceChoice] ${newAttemptCount} failed attempts (chapter ${chapterNumber}), user may be asleep`);
                  onChoiceSelect('__SLEEP__');
                  return;
                }

                // Continue listening for more attempts
                setIsListening(false);
                setIsRecording(false);

                // Auto-restart listening after delay (longer for later chapters)
                setTimeout(() => {
                  if (!selectedChoice) {
                    startListening();
                  }
                }, sleepSettings.delayBetweenAttempts);
              }
            });
            
            recordingChunks = [];
          }
        };
        
        mediaRecorderRef.current = recorder;
        setRecorderReady(true);
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

  // Read choices aloud when component mounts
  const readChoicesAloud = async () => {
    if (choicesRead || isReadingChoices || choices.length === 0) return;

    setIsReadingChoices(true);
    console.log('[VoiceChoice] Reading choices aloud...');

    // Build the text to read
    const choicesText = choices.map((choice, index) =>
      `Choice ${index + 1}: ${choice.text}`
    ).join('. ');

    const fullText = `What happens next? ${choicesText}. Say one or two, or describe your choice.`;

    try {
      // Fetch streaming audio for choices
      const response = await fetch('/api/audio/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fullText, voiceId })
      });

      if (!response.ok) throw new Error('Failed to get audio');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);

      // Play the choices audio
      const audio = new Audio(url);
      choicesAudioRef.current = audio;

      audio.onended = () => {
        console.log('[VoiceChoice] Finished reading choices');
        URL.revokeObjectURL(url);
        setIsReadingChoices(false);
        setChoicesRead(true);
      };

      audio.onerror = () => {
        console.error('[VoiceChoice] Error playing choices audio');
        URL.revokeObjectURL(url);
        setIsReadingChoices(false);
        setChoicesRead(true);
      };

      await audio.play();
    } catch (error) {
      console.error('[VoiceChoice] Error reading choices:', error);
      setIsReadingChoices(false);
      setChoicesRead(true); // Continue even if TTS fails
    }
  };

  // Read choices aloud when component mounts
  useEffect(() => {
    readChoicesAloud();
  }, [choices]);

  // Auto-start listening after choices have been read
  useEffect(() => {
    if (autoStartListening && choicesRead && !selectedChoice && recorderReady) {
      // Small delay to ensure everything is ready
      const startTimer = setTimeout(() => {
        const recorder = mediaRecorderRef.current;
        if (recorder && !isListening) {
          if (recorder.state === 'inactive') {
            console.log('[VoiceChoice] Choices read, auto-starting voice recording...');
            startListening();
          } else {
            console.log('[VoiceChoice] MediaRecorder state is', recorder.state, '- will retry');
            // Retry after another delay
            setTimeout(() => {
              if (!isListening && !selectedChoice) {
                console.log('[VoiceChoice] Retry: starting voice recording...');
                startListening();
              }
            }, 500);
          }
        } else {
          console.log('[VoiceChoice] Waiting for recorder...', { recorder: !!recorder, isListening });
        }
      }, 300);

      return () => clearTimeout(startTimer);
    }
  }, [recorderReady, autoStartListening, choicesRead, selectedChoice, isListening]);

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
        setAttemptCount(0); // Reset attempt count on successful transcription
        checkForChoiceMatch(transcribedText.toLowerCase().trim());
      } else {
        // No transcription result, increment attempt count
        const newAttemptCount = attemptCount + 1;
        setAttemptCount(newAttemptCount);
        
        if (newAttemptCount >= sleepSettings.maxAttempts) {
          console.log(`[VoiceChoice] ${newAttemptCount} failed attempts (chapter ${chapterNumber}), user may be asleep`);
          onChoiceSelect('__SLEEP__');
          return;
        }

        // Auto-restart listening after delay (longer for later chapters)
        setTimeout(() => {
          if (!selectedChoice) {
            startListening();
          }
        }, sleepSettings.delayBetweenAttempts);
      }
    } catch (error) {
      console.error('[VoiceChoice] Transcription error:', error);
    } finally {
      setIsListening(false);
      setIsRecording(false);
    }
  };

  const checkForChoiceMatch = async (spokenText: string) => {
    console.log('[VoiceChoice] Asking LLM to interpret:', spokenText);

    try {
      // Use LLM to interpret the user's response
      const response = await fetch('/api/interpret-choice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: spokenText, choices })
      });

      if (!response.ok) {
        console.error('[VoiceChoice] API error:', response.status, response.statusText);
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();
      console.log('[VoiceChoice] LLM interpretation:', result);

      if (result.choiceId) {
        const choice = choices.find(c => c.id === result.choiceId);
        if (choice) {
          // Clear all timeouts when voice choice is detected
          if (sleepTimeoutId) {
            clearTimeout(sleepTimeoutId);
            setSleepTimeoutId(null);
          }
          if (silenceTimeoutId) {
            clearTimeout(silenceTimeoutId);
            setSilenceTimeoutId(null);
          }

          setAttemptCount(0);
          setSelectedChoice(choice.id);
          setTimeout(() => onChoiceSelect(choice.id), 1000);
          return;
        }
      }

      // No match - re-read choices and try again
      console.log('[VoiceChoice] No choice matched, re-reading choices...');
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);

      if (newAttemptCount >= sleepSettings.maxAttempts) {
        console.log(`[VoiceChoice] ${newAttemptCount} failed attempts (chapter ${chapterNumber}), user may be asleep`);
        onChoiceSelect('__SLEEP__');
        return;
      }

      // Re-read the choices and then listen again
      setChoicesRead(false);
      setIsReadingChoices(false);
      setTimeout(() => {
        readChoicesAloud();
      }, 1000);

    } catch (error) {
      console.error('[VoiceChoice] Error interpreting choice:', error);
      // On error, just retry listening
      setTimeout(() => {
        if (!selectedChoice && mediaRecorder) {
          startListening();
        }
      }, sleepSettings.delayBetweenAttempts);
    }
  };

  const startListening = () => {
    const recorder = mediaRecorderRef.current;

    if (!recorder) {
      console.log('[VoiceChoice] Cannot start - no mediaRecorder');
      return;
    }

    // If already listening, don't start again
    if (isListening) {
      console.log('[VoiceChoice] Already listening, skipping start');
      return;
    }

    // If recorder is not inactive, try to stop it first
    if (recorder.state !== 'inactive') {
      console.log('[VoiceChoice] MediaRecorder state is', recorder.state, '- stopping first');
      try {
        recorder.stop();
      } catch (e) {
        console.log('[VoiceChoice] Could not stop recorder:', e);
      }
      // Retry after a short delay
      setTimeout(() => startListening(), 200);
      return;
    }

    setIsListening(true);
    setIsRecording(true);
    setTranscript("");

    try {
      console.log('[VoiceChoice] Starting audio recording');
      recorder.start(1000); // Collect data every 1 second

      // Auto-stop recording after 5 seconds to get a voice sample
      setTimeout(() => {
        const currentRecorder = mediaRecorderRef.current;
        if (currentRecorder && currentRecorder.state === 'recording') {
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
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      console.log('[VoiceChoice] Stopping audio recording');
      recorder.stop();
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
        <p className="text-muted-foreground">
          {isListening ? "Just say your choice... or drift off to sleep" : "Speak your choice or tap to select"}
        </p>
      </div>

      {/* Voice Status - Always visible */}
      <div className="text-center space-y-4 p-6 bg-card/30 rounded-2xl border border-border/50">
        {isReadingChoices ? (
          <div className="space-y-4">
            {/* Reading choices indicator */}
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-primary/30 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-primary/50 rounded-full animate-pulse"></div>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-lg text-primary">Reading your choices...</span>
              <p className="text-sm text-muted-foreground">Listen carefully, then respond</p>
            </div>
          </div>
        ) : isListening ? (
          <div className="space-y-4">
            {/* Large pulsing mic indicator */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-16 h-16 bg-primary/20 rounded-full animate-ping absolute"></div>
                <div className="w-16 h-16 bg-primary/40 rounded-full flex items-center justify-center relative">
                  <Mic className="w-8 h-8 text-primary animate-pulse" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <span className="text-lg text-primary">
                {isRecording ? "Listening..." : "Processing..."}
              </span>
              <p className="text-sm text-muted-foreground">
                Say "one" or "two", or describe your choice
              </p>
              {attemptCount > 0 && (
                <div className="text-xs text-muted-foreground/70">
                  No response detected ({attemptCount}/{sleepSettings.maxAttempts})
                </div>
              )}
              {transcript && (
                <p className="text-sm italic bg-muted/50 p-2 rounded mt-2">
                  Heard: "{transcript}"
                </p>
              )}
            </div>
            {/* Small stop button */}
            <Button
              onClick={stopListening}
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground"
            >
              <MicOff className="w-3 h-3 mr-1" />
              Stop listening
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Voice recording stopped</p>
            <Button
              onClick={startListening}
              variant="outline"
              size="sm"
            >
              <Mic className="w-4 h-4 mr-2" />
              Resume listening
            </Button>
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