export interface StoryGenre {
  id: string;
  name: string;
  description: string;
  icon: string;
  gradient: string;
}

export interface Voice {
  id: string;
  name: string;
  description: string;
}

export interface StoryChoice {
  id: string;
  text: string;
  description: string;
}

export interface Chapter {
  id: number;
  storyId: number;
  chapterNumber: number;
  content: string;
  audioUrl?: string;
  choices: StoryChoice[];
  userChoice?: string;
  createdAt: Date;
}

export interface Story {
  id: number;
  userId?: number;
  genre: string;
  voice: string;
  title: string;
  currentChapter: number;
  storyState: any;
  createdAt: Date;
}

export interface AppState {
  currentScreen: 'welcome' | 'player';
  selectedGenre?: string;
  selectedVoice?: string;
  currentStory?: Story;
  currentChapter?: Chapter;
  isPlaying: boolean;
  choiceTimeout: number;
}
