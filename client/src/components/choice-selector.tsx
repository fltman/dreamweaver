import { useState, useEffect } from "react";
import { StoryChoice } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface ChoiceSelectorProps {
  choices: StoryChoice[];
  onChoiceSelect: (choiceId: string) => void;
  timeoutSeconds?: number;
  onTimeout?: () => void;
}

export default function ChoiceSelector({ 
  choices, 
  onChoiceSelect, 
  timeoutSeconds = 45, 
  onTimeout 
}: ChoiceSelectorProps) {
  const [timeLeft, setTimeLeft] = useState(timeoutSeconds);
  
  useEffect(() => {
    setTimeLeft(timeoutSeconds);
    
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeout?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeoutSeconds, onTimeout]);

  const progressPercent = (timeLeft / timeoutSeconds) * 100;

  return (
    <div className="space-y-6 pt-6 animate-fade-in">
      <div className="text-center space-y-4">
        <h3 className="text-2xl font-light">What happens next?</h3>
        <p className="text-muted-foreground">Make your choice, or let the story choose for you...</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {choices.map((choice, index) => (
          <Button
            key={choice.id}
            onClick={() => onChoiceSelect(choice.id)}
            variant="outline"
            className="choice-btn group h-auto p-6 text-left hover:border-primary/50 hover:bg-card transition-all duration-300"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium">{choice.text}</h4>
                <span className="text-2xl group-hover:scale-110 transition-transform">
                  {index === 0 ? '💫' : '🌙'}
                </span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {choice.description}
              </p>
            </div>
          </Button>
        ))}
      </div>
      
      {/* Choice Timer */}
      <div className="text-center space-y-3">
        <div className="text-sm text-muted-foreground">
          Auto-continue in <span className="text-primary font-medium">{timeLeft}</span> seconds
        </div>
        <div className="max-w-xs mx-auto">
          <Progress value={progressPercent} className="h-1" />
        </div>
      </div>
    </div>
  );
}
