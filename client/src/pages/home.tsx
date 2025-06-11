import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Moon } from "lucide-react";
import StorySelector from "@/components/story-selector";
import VoiceSelector from "@/components/voice-selector";
import StoryPlayer from "@/components/story-player";
import { Story, Chapter } from "@/lib/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import BackgroundMusic from "@/components/background-music";

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<'welcome' | 'player'>('welcome');
  const [selectedGenre, setSelectedGenre] = useState<string>();
  const [selectedVoice, setSelectedVoice] = useState<string>();
  const [currentStory, setCurrentStory] = useState<Story>();
  const [isKioskMode, setIsKioskMode] = useState(false);
  const queryClient = useQueryClient();

  // Handle escape key to exit kiosk mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isKioskMode) {
        exitKioskMode();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isKioskMode]);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement || 
        (document as any).webkitFullscreenElement || 
        (document as any).msFullscreenElement);
      
      if (!isFullscreen && isKioskMode) {
        // User exited fullscreen manually, update state
        document.body.classList.remove('kiosk-mode');
        document.documentElement.classList.remove('kiosk-mode');
        setIsKioskMode(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, [isKioskMode]);

  const { data: chapters, isLoading: chaptersLoading, error: chaptersError } = useQuery({
    queryKey: [`/api/stories/${currentStory?.id}/chapters`],
    enabled: !!currentStory,
    staleTime: 0
  });

  const currentChapter = chapters && Array.isArray(chapters) ? chapters[chapters.length - 1] : undefined;

  // Comprehensive logging
  console.log('[Home Debug] currentStory:', currentStory);
  console.log('[Home Debug] currentScreen:', currentScreen);
  console.log('[Home Debug] chaptersLoading:', chaptersLoading);
  console.log('[Home Debug] chaptersError:', chaptersError);
  console.log('[Home Debug] chapters array:', chapters);
  console.log('[Home Debug] currentChapter:', currentChapter);
  console.log('[Home Debug] chapters length:', Array.isArray(chapters) ? chapters.length : 0);
  
  // Deep dive into chapter structure
  if (chapters && Array.isArray(chapters) && chapters.length > 0) {
    console.log('[Home Debug] First chapter structure:', JSON.stringify(chapters[0], null, 2));
    console.log('[Home Debug] Chapter content property:', chapters[0]?.content);
    console.log('[Home Debug] Chapter keys:', Object.keys(chapters[0] || {}));
  }

  const createStoryMutation = useMutation({
    mutationFn: async (storyData: { genre: string; voice: string; title: string }) => {
      console.log('[CreateStory] Making API request with:', storyData);
      const response = await apiRequest('POST', '/api/stories', storyData);
      const story = await response.json();
      console.log('[CreateStory] API response:', story);
      return story;
    },
    onSuccess: async (story: Story) => {
      console.log('[CreateStory] onSuccess called with story:', story);
      setCurrentStory(story);
      setCurrentScreen('player');
      
      // Immediately trigger chapter generation
      console.log('[CreateStory] Triggering first chapter generation...');
      try {
        const chapterResponse = await apiRequest('POST', `/api/stories/${story.id}/chapters`, {});
        console.log('[CreateStory] First chapter generated:', chapterResponse);
        
        // Invalidate chapters query to fetch the new chapter
        queryClient.invalidateQueries({ queryKey: [`/api/stories/${story.id}/chapters`] });
      } catch (error) {
        console.error('[CreateStory] Failed to generate first chapter:', error);
      }
    }
  });

  const enterKioskMode = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      } else if ((document.documentElement as any).msRequestFullscreen) {
        await (document.documentElement as any).msRequestFullscreen();
      }
      
      // Apply kiosk mode styling for maximum darkness
      document.body.classList.add('kiosk-mode');
      document.documentElement.classList.add('kiosk-mode');
      setIsKioskMode(true);
      
      console.log('[KioskMode] Entered fullscreen kiosk mode');
    } catch (error) {
      console.warn('[KioskMode] Failed to enter fullscreen:', error);
      // Still set kiosk mode even if fullscreen fails
      document.body.classList.add('kiosk-mode');
      document.documentElement.classList.add('kiosk-mode');
      setIsKioskMode(true);
    }
  };

  const exitKioskMode = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        await (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        await (document as any).msExitFullscreen();
      }
    } catch (error) {
      console.warn('[KioskMode] Failed to exit fullscreen:', error);
    }
    
    // Remove kiosk mode styling
    document.body.classList.remove('kiosk-mode');
    document.documentElement.classList.remove('kiosk-mode');
    setIsKioskMode(false);
    console.log('[KioskMode] Exited kiosk mode');
  };

  const handleStartStory = async () => {
    if (!selectedGenre || !selectedVoice) return;

    // Enter kiosk mode before starting story
    await enterKioskMode();

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

  const handleBack = async () => {
    if (isKioskMode) {
      await exitKioskMode();
    }
    setCurrentScreen('welcome');
    setCurrentStory(undefined);
    setSelectedGenre(undefined);
    setSelectedVoice(undefined);
  };

  const isStartEnabled = selectedGenre && selectedVoice && !createStoryMutation.isPending;

  if (currentScreen === 'player' && currentStory) {
    return (
      <div className={`min-h-screen ${isKioskMode ? 'bg-black' : ''}`}>
        {isKioskMode && (
          <div className="fixed top-4 right-4 z-50 bg-gray-900/80 text-white text-xs px-3 py-1 rounded-full opacity-50">
            Kiosk Mode • Press ESC to exit
          </div>
        )}
        <StoryPlayer
          story={currentStory}
          currentChapter={currentChapter}
          onBack={handleBack}
        />
      </div>
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

      {/* Background Music - Always Available */}
      <BackgroundMusic />
    </div>
  );
}
