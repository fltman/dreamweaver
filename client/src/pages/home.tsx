import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Moon } from "lucide-react";
import StorySelector from "@/components/story-selector";
import VoiceSelector from "@/components/voice-selector";
import StoryPlayer from "@/components/story-player";
import { Story, Chapter } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'player'>('welcome');
  const [selectedGenre, setSelectedGenre] = useState<string>();
  const [selectedVoice, setSelectedVoice] = useState<string>();
  const [currentStory, setCurrentStory] = useState<Story>();
  const queryClient = useQueryClient();

  const { data: chapters, isLoading: chaptersLoading, error: chaptersError, isSuccess: chaptersSuccess } = useQuery<Chapter[]>({
    queryKey: ['/api/stories', currentStory?.id.toString(), 'chapters'],
    enabled: !!currentStory
  });

  const currentChapter = chapters?.[chapters.length - 1];

  // Comprehensive logging
  console.log('[Home Debug] currentStory:', currentStory);
  console.log('[Home Debug] currentScreen:', currentScreen);
  console.log('[Home Debug] chaptersLoading:', chaptersLoading);
  console.log('[Home Debug] chaptersError:', chaptersError);
  console.log('[Home Debug] chaptersSuccess:', chaptersSuccess);
  console.log('[Home Debug] chapters array:', chapters);
  console.log('[Home Debug] currentChapter:', currentChapter);
  console.log('[Home Debug] chapters length:', chapters?.length || 0);

  const createStoryMutation = useMutation({
    mutationFn: async (storyData: { genre: string; voice: string; title: string }) => {
      console.log('[CreateStory] Making API request with:', storyData);
      const response = await apiRequest('POST', '/api/stories', storyData);
      const story = await response.json();
      console.log('[CreateStory] API response:', story);
      return story;
    },
    onSuccess: (story: Story) => {
      console.log('[CreateStory] onSuccess called with story:', story);
      setCurrentStory(story);
      setCurrentScreen('player');
      queryClient.invalidateQueries({ queryKey: ['/api/stories'] });
    }
  });

  const handleStartStory = () => {
    if (!selectedGenre || !selectedVoice) return;

    const title = generateStoryTitle(selectedGenre);
    
    createStoryMutation.mutate({
      genre: selectedGenre,
      voice: selectedVoice,
      title
    });
  };

  const generateStoryTitle = (genre: string): string => {
    const titles = {
      fantasy: ["The Enchanted Forest", "Moonlit Kingdoms", "The Crystal Caves", "Whispers of Magic"],
      adventure: ["Journey to Tomorrow", "The Hidden Valley", "Across Distant Lands", "The Explorer's Tale"],
      mystery: ["Secrets in the Shadows", "The Midnight Puzzle", "Whispers in the Dark", "The Silent Clue"],
      peaceful: ["Garden of Dreams", "Gentle Streams", "The Quiet Valley", "Harmony's Embrace"]
    };
    
    const genreTitle = titles[genre as keyof typeof titles] || titles.peaceful;
    return genreTitle[Math.floor(Math.random() * genreTitle.length)];
  };

  const handleBack = () => {
    setCurrentScreen('welcome');
    setCurrentStory(undefined);
    setSelectedGenre(undefined);
    setSelectedVoice(undefined);
  };

  const isStartEnabled = selectedGenre && selectedVoice && !createStoryMutation.isPending;

  if (currentScreen === 'player' && currentStory) {
    return (
      <StoryPlayer
        story={currentStory}
        currentChapter={currentChapter}
        onBack={handleBack}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-8 animate-fade-in">
        <div className="max-w-2xl mx-auto text-center space-y-8">
          
          {/* App Header */}
          <div className="space-y-4">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center animate-breathe">
              <Moon className="text-3xl text-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-light">Eternal Storyteller</h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              Drift into dreams with personalized stories that adapt to your choices... or let sleep naturally take over.
            </p>
          </div>

          {/* Story Selection */}
          <StorySelector
            selectedGenre={selectedGenre}
            onGenreSelect={setSelectedGenre}
          />

          {/* Voice Selection */}
          <VoiceSelector
            selectedVoice={selectedVoice}
            onVoiceSelect={setSelectedVoice}
          />

          {/* Debug Info */}
          <div className="text-xs text-muted-foreground space-y-1 p-4 bg-muted/20 rounded-lg">
            <div>Selected Genre: {selectedGenre || 'None'}</div>
            <div>Selected Voice: {selectedVoice || 'None'}</div>
            <div>Start Enabled: {isStartEnabled ? 'Yes' : 'No'}</div>
            <div>Mutation Pending: {createStoryMutation.isPending ? 'Yes' : 'No'}</div>
          </div>

          {/* Start Button */}
          <div className="pt-6">
            <Button
              onClick={() => {
                console.log('[StartButton] Clicked with genre:', selectedGenre, 'voice:', selectedVoice);
                handleStartStory();
              }}
              disabled={!isStartEnabled}
              size="lg"
              className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/80 hover:to-primary text-primary-foreground font-medium px-12 py-6 rounded-full text-lg transition-all duration-300 transform hover:scale-105 animate-gentle-pulse disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:animate-none"
            >
              {createStoryMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-foreground mr-2"></div>
                  Creating Your Story...
                </>
              ) : (
                <>
                  Begin Your Dream Journey
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
