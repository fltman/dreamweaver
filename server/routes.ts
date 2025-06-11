import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateStoryChapter } from "./services/openai";
import { convertTextToSpeech, getAvailableVoices } from "./services/elevenlabs";
import { insertStorySchema, insertChapterSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get available voices
  app.get("/api/voices", async (req, res) => {
    try {
      const voices = getAvailableVoices();
      res.json(voices);
    } catch (error) {
      console.error("Failed to get voices:", error);
      res.status(500).json({ message: "Failed to get available voices" });
    }
  });

  // Create a new story
  app.post("/api/stories", async (req, res) => {
    try {
      const validatedData = insertStorySchema.parse(req.body);
      const story = await storage.createStory(validatedData);
      res.json(story);
    } catch (error) {
      console.error("Failed to create story:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid story data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create story" });
      }
    }
  });

  // Get all stories
  app.get("/api/stories", async (req, res) => {
    try {
      const stories = await storage.getAllStories();
      console.log(`[Stories API] Returning ${stories.length} stories`);
      res.json(stories);
    } catch (error) {
      console.error("Failed to get stories:", error);
      res.status(500).json({ message: "Failed to get stories" });
    }
  });

  // Get story by ID
  app.get("/api/stories/:id", async (req, res) => {
    try {
      const storyId = parseInt(req.params.id);
      const story = await storage.getStory(storyId);
      
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      res.json(story);
    } catch (error) {
      console.error("Failed to get story:", error);
      res.status(500).json({ message: "Failed to get story" });
    }
  });

  // Generate and create a new chapter
  app.post("/api/stories/:id/chapters", async (req, res) => {
    try {
      const storyId = parseInt(req.params.id);
      console.log(`[Chapter Generation] Starting for story ${storyId}`);
      
      const story = await storage.getStory(storyId);
      
      if (!story) {
        console.log(`[Chapter Generation] Story ${storyId} not found`);
        return res.status(404).json({ message: "Story not found" });
      }

      const { previousChoice } = req.body;
      console.log(`[Chapter Generation] Story found: ${story.title}, genre: ${story.genre}, voice: ${story.voice}`);
      
      // Generate story content using OpenAI
      console.log(`[Chapter Generation] Generating story content with OpenAI...`);
      const generatedChapter = await generateStoryChapter(
        story.genre,
        story.currentChapter || 1,
        previousChoice,
        story.storyState
      );
      console.log(`[Chapter Generation] Story content generated, length: ${generatedChapter.content.length} characters`);

      // Convert text to speech using ElevenLabs
      console.log(`[Chapter Generation] Converting to speech with ElevenLabs...`);
      const audioBuffer = await convertTextToSpeech(
        generatedChapter.content,
        story.voice
      );
      console.log(`[Chapter Generation] Audio conversion completed`);

      // Create a data URL for the audio
      const audioBase64 = audioBuffer.toString('base64');
      const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;
      console.log(`[Chapter Generation] Audio data URL created, base64 length: ${audioBase64.length}`);

      // Create chapter in storage
      const chapterData = {
        storyId: storyId,
        chapterNumber: story.currentChapter || 1,
        content: generatedChapter.content,
        audioUrl: audioUrl,
        choices: generatedChapter.choices
      };

      const validatedChapterData = insertChapterSchema.parse(chapterData);
      const chapter = await storage.createChapter(validatedChapterData);
      console.log(`[Chapter Generation] Chapter created with ID: ${chapter.id}`);

      // Update story's current chapter and state
      await storage.updateStory(storyId, {
        currentChapter: (story.currentChapter || 1) + 1,
        storyState: { ...story.storyState, lastChapterId: chapter.id }
      });
      console.log(`[Chapter Generation] Story updated, next chapter: ${(story.currentChapter || 1) + 1}`);

      res.json(chapter);
    } catch (error) {
      console.error("[Chapter Generation] Error:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid chapter data", errors: error.errors });
      } else {
        res.status(500).json({ 
          message: "Failed to generate chapter", 
          error: (error as Error).message 
        });
      }
    }
  });

  // Update chapter with user choice
  app.patch("/api/chapters/:id", async (req, res) => {
    try {
      const chapterId = parseInt(req.params.id);
      const { userChoice } = req.body;
      
      const updatedChapter = await storage.updateChapter(chapterId, { userChoice });
      
      if (!updatedChapter) {
        return res.status(404).json({ message: "Chapter not found" });
      }
      
      res.json(updatedChapter);
    } catch (error) {
      console.error("Failed to update chapter:", error);
      res.status(500).json({ message: "Failed to update chapter" });
    }
  });

  // Get chapters for a story
  app.get("/api/stories/:id/chapters", async (req, res) => {
    try {
      const storyId = parseInt(req.params.id);
      console.log(`[Chapters API] Getting chapters for story ${storyId}`);
      const chapters = await storage.getChaptersByStory(storyId);
      console.log(`[Chapters API] Found ${chapters.length} chapters`);
      if (chapters.length > 0) {
        console.log(`[Chapters API] First chapter keys:`, Object.keys(chapters[0]));
        console.log(`[Chapters API] First chapter preview:`, JSON.stringify(chapters[0], null, 2).substring(0, 500));
      }
      res.json(chapters);
    } catch (error) {
      console.error("Failed to get chapters:", error);
      res.status(500).json({ message: "Failed to get chapters" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
