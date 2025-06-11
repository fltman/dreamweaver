import { useState, useEffect, useRef } from "react";
import { StoryChoice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";

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
  const [recognition, setRecognition] = useState<any>(null);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);

  useEffect(() => {
    // Check if browser supports speech recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      
      recognitionInstance.continuous = true;
      recognitionInstance.interimResults = true;
      recognitionInstance.lang = 'en-US';
      
      recognitionInstance.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }
        
        const currentTranscript = finalTranscript || interimTranscript;
        setTranscript(currentTranscript);
        
        // Check if transcript matches any choice
        if (finalTranscript) {
          checkForChoiceMatch(finalTranscript.toLowerCase().trim());
        }
      };
      
      recognitionInstance.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };
      
      recognitionInstance.onend = () => {
        setIsListening(false);
      };
      
      setRecognition(recognitionInstance);
    }
  }, []);

  // Auto-start listening when component mounts
  useEffect(() => {
    if (autoStartListening && recognition && !isListening) {
      setTimeout(() => {
        startListening();
      }, 1000); // Small delay to ensure component is ready
    }
  }, [recognition, autoStartListening]);

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
    if (recognition) {
      setTranscript("");
      setSelectedChoice(null);
      recognition.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
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
        <p className="text-muted-foreground">Speak your choice or tap to select</p>
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