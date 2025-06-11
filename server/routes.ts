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
      const story = await storage.getStory(storyId);
      
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }

      const { previousChoice } = req.body;
      
      // Generate story content using OpenAI
      const generatedChapter = await generateStoryChapter(
        story.genre,
        story.currentChapter || 1,
        previousChoice,
        story.storyState
      );

      // Convert text to speech using ElevenLabs
      const audioBuffer = await convertTextToSpeech(
        generatedChapter.content,
        story.voice
      );

      // Create a data URL for the audio
      const audioBase64 = audioBuffer.toString('base64');
      const audioUrl = `data:audio/mpeg;base64,${audioBase64}`;

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

      // Update story's current chapter and state
      await storage.updateStory(storyId, {
        currentChapter: (story.currentChapter || 1) + 1,
        storyState: { ...story.storyState, lastChapterId: chapter.id }
      });

      res.json(chapter);
    } catch (error) {
      console.error("Failed to generate chapter:", error);
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
      const chapters = await storage.getChaptersByStory(storyId);
      res.json(chapters);
    } catch (error) {
      console.error("Failed to get chapters:", error);
      res.status(500).json({ message: "Failed to get chapters" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
