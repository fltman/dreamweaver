import { users, stories, chapters, type User, type InsertUser, type Story, type InsertStory, type Chapter, type InsertChapter } from "@shared/schema";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createStory(story: InsertStory): Promise<Story>;
  getStory(id: number): Promise<Story | undefined>;
  updateStory(id: number, updates: Partial<Story>): Promise<Story | undefined>;
  
  createChapter(chapter: InsertChapter): Promise<Chapter>;
  getChapter(id: number): Promise<Chapter | undefined>;
  getChaptersByStory(storyId: number): Promise<Chapter[]>;
  updateChapter(id: number, updates: Partial<Chapter>): Promise<Chapter | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private stories: Map<number, Story>;
  private chapters: Map<number, Chapter>;
  private currentUserId: number;
  private currentStoryId: number;
  private currentChapterId: number;

  constructor() {
    this.users = new Map();
    this.stories = new Map();
    this.chapters = new Map();
    this.currentUserId = 1;
    this.currentStoryId = 1;
    this.currentChapterId = 1;
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createStory(insertStory: InsertStory): Promise<Story> {
    const id = this.currentStoryId++;
    const story: Story = { 
      ...insertStory, 
      id, 
      createdAt: new Date(),
      currentChapter: 1,
      storyState: {}
    };
    this.stories.set(id, story);
    return story;
  }

  async getStory(id: number): Promise<Story | undefined> {
    return this.stories.get(id);
  }

  async updateStory(id: number, updates: Partial<Story>): Promise<Story | undefined> {
    const story = this.stories.get(id);
    if (!story) return undefined;
    
    const updatedStory = { ...story, ...updates };
    this.stories.set(id, updatedStory);
    return updatedStory;
  }

  async createChapter(insertChapter: InsertChapter): Promise<Chapter> {
    const id = this.currentChapterId++;
    const chapter: Chapter = { 
      ...insertChapter, 
      id, 
      createdAt: new Date(),
      choices: insertChapter.choices || [],
      audioUrl: insertChapter.audioUrl || null,
      userChoice: insertChapter.userChoice || null
    };
    this.chapters.set(id, chapter);
    return chapter;
  }

  async getChapter(id: number): Promise<Chapter | undefined> {
    return this.chapters.get(id);
  }

  async getChaptersByStory(storyId: number): Promise<Chapter[]> {
    return Array.from(this.chapters.values()).filter(
      (chapter) => chapter.storyId === storyId
    );
  }

  async updateChapter(id: number, updates: Partial<Chapter>): Promise<Chapter | undefined> {
    const chapter = this.chapters.get(id);
    if (!chapter) return undefined;
    
    const updatedChapter = { ...chapter, ...updates };
    this.chapters.set(id, updatedChapter);
    return updatedChapter;
  }
}

export const storage = new MemStorage();
