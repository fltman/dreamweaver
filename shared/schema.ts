import { pgTable, text, serial, integer, boolean, json, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const stories = pgTable("stories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  genre: text("genre").notNull(),
  voice: text("voice").notNull(),
  title: text("title").notNull(),
  currentChapter: integer("current_chapter").default(1),
  storyState: json("story_state").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chapters = pgTable("chapters", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id").notNull(),
  chapterNumber: integer("chapter_number").notNull(),
  content: text("content").notNull(),
  audioUrl: text("audio_url"),
  choices: json("choices").default([]),
  userChoice: text("user_choice"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertStorySchema = createInsertSchema(stories).omit({
  id: true,
  createdAt: true,
});

export const insertChapterSchema = createInsertSchema(chapters).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Story = typeof stories.$inferSelect;
export type Chapter = typeof chapters.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type InsertChapter = z.infer<typeof insertChapterSchema>;
