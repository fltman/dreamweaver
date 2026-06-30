# Dreamweaver

[![Support me on Patreon](https://img.shields.io/badge/Patreon-Support%20my%20work-FF424D?style=flat&logo=patreon&logoColor=white)](https://www.patreon.com/AndersBjarby)

An interactive, AI-generated bedtime story app. Pick a genre and a narrator voice, and Dreamweaver generates a soothing branching story chapter by chapter — each one narrated aloud, with two gentle choices that steer where the story goes next.

## Features

- AI-written bedtime stories generated per chapter via OpenRouter (Claude Sonnet)
- Real-time voice narration with ElevenLabs text-to-speech (streaming playback)
- Branching choices that advance the story without stress or scares
- Selectable narrator voices and ambient background music
- Stories and chapters persisted in Postgres via Drizzle ORM

## Setup

```bash
npm install
npm run dev        # starts the app on port 5000
```

Set these environment variables (e.g. in a `.env` file):

- `OPENROUTER_API_KEY` – story generation
- `ELEVENLABS_API_KEY` – voice narration
- `DATABASE_URL` – Postgres connection (Neon serverless)

Run `npm run db:push` to sync the schema. Build for production with `npm run build` then `npm run start`.

## Tech

React 18 + Vite + Tailwind + Radix UI on the frontend; Express + TypeScript backend; Drizzle ORM with Neon Postgres; OpenRouter and ElevenLabs APIs. Configured to run on Replit.
