import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings } from "lucide-react";
import { Story, Chapter, AppState } from "@/lib/types";
import AudioPlayer from "./audio-player";
import VoiceChoiceSelector from "./voice-choice-selector";
import SettingsModal from "./settings-modal";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface StoryPlayerProps {
  story: Story;
  currentChapter?: Chapter;
  onBack: () => void;
}

export default function StoryPlayer({ story, currentChapter, onBack }: StoryPlayerProps) {
  const [showChoices, setShowChoices] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    speechSpeed: 1.0,
    voiceTone: 'normal',
    choiceTimeout: 45,
    fadeOut: true
  });

  const queryClient = useQueryClient();

  // Debug logging for StoryPlayer
  console.log('[StoryPlayer Debug] story:', story);
  console.log('[StoryPlayer Debug] currentChapter prop:', currentChapter);
  console.log('[StoryPlayer Debug] currentChapter exists?', !!currentChapter);
  console.log('[StoryPlayer Debug] currentChapter.content exists?', !!currentChapter?.content);



  const generateChapterMutation = useMutation({
    mutationFn: async ({ storyId, previousChoice }: { storyId: number; previousChoice?: string }) => {
      const response = await apiRequest('POST', `/api/stories/${storyId}/chapters`, {
        previousChoice
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stories', story.id.toString(), 'chapters'] });
    }
  });

  const updateChapterMutation = useMutation({
    mutationFn: async ({ chapterId, userChoice }: { chapterId: number; userChoice: string }) => {
      const response = await apiRequest('PATCH', `/api/chapters/${chapterId}`, {
        userChoice
      });
      return response.json();
    }
  });

  useEffect(() => {
    if (!currentChapter) {
      // Generate first chapter
      generateChapterMutation.mutate({ storyId: story.id });
    }
  }, [story.id, currentChapter]);

  const handlePlaybackComplete = () => {
    if (currentChapter?.choices && currentChapter.choices.length > 0) {
      // Delay showing choices to ensure audio has completely stopped
      setTimeout(() => {
        setShowChoices(true);
      }, 2000);
    }
  };

  const handleChoiceSelect = (choiceId: string) => {
    if (!currentChapter) return;
    
    const choice = currentChapter.choices.find(c => c.id === choiceId);
    if (choice) {
      // Update current chapter with user choice
      updateChapterMutation.mutate({
        chapterId: currentChapter.id,
        userChoice: choice.text
      });

      // Generate next chapter
      generateChapterMutation.mutate({
        storyId: story.id,
        previousChoice: choice.text
      });

      setShowChoices(false);
    }
  };



  return (
    <div className="flex-1 flex flex-col">
      {/* Story Header */}
      <div className="border-b border-border p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="w-10 h-10 rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h2 className="text-xl font-medium">{story.title}</h2>
              <p className="text-sm text-muted-foreground">
                Chapter {currentChapter?.chapterNumber || 1}
              </p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-full"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Story Content */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 py-8">
        
        {/* Story Text Area */}
        <div className="flex-1 space-y-6">
          <div className="bg-card/30 rounded-2xl p-8 border border-border">
            {generateChapterMutation.isPending ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Crafting your story...</span>
              </div>
            ) : currentChapter && currentChapter.content ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/20 rounded-full flex items-center justify-center">
                  <div className="w-8 h-8 bg-primary/40 rounded-full animate-pulse"></div>
                </div>
                <p>Listening to your dream...</p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Preparing your dream journey...
              </div>
            )}
          </div>

          {/* Audio Player */}
          {currentChapter?.audioUrl && (
            <AudioPlayer
              audioUrl={currentChapter.audioUrl}
              onPlaybackComplete={handlePlaybackComplete}
              autoPlay={true}
            />
          )}
        </div>

        {/* Voice Choice Selection */}
        {showChoices && currentChapter?.choices && (
          <VoiceChoiceSelector
            choices={currentChapter.choices}
            onChoiceSelect={handleChoiceSelect}
          />
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  );
}
