import OpenAI from "openai";

// Use OpenRouter for story generation with Claude Sonnet 4.5
const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY || "default_key",
  timeout: 60000, // 60 second timeout
  defaultHeaders: {
    "HTTP-Referer": "https://dreamweaver.app",
    "X-Title": "Dreamweaver"
  }
});

export interface StoryChapter {
  content: string;
  choices: Array<{
    id: string;
    text: string;
    description: string;
  }>;
}

export async function generateStoryChapter(
  genre: string,
  chapterNumber: number,
  previousChoice?: string,
  storyState?: any
): Promise<StoryChapter> {
  const systemPrompt = `You are a master storyteller specializing in bedtime stories. Create soothing, immersive narratives that help listeners drift off to sleep. 

Guidelines:
- Write in a gentle, calming tone perfect for bedtime
- Create vivid but peaceful imagery
- Use approximately 2000-2500 characters for the chapter content
- Always end with exactly 2 meaningful choices that advance the story
- Make choices feel consequential but not stressful
- Focus on wonder, exploration, and gentle adventure
- Avoid any scary, violent, or overly exciting content

Respond with JSON in this exact format:
{
  "content": "The story chapter text here...",
  "choices": [
    {
      "id": "choice_1",
      "text": "Short choice description",
      "description": "Longer description of what this choice leads to"
    },
    {
      "id": "choice_2", 
      "text": "Short choice description",
      "description": "Longer description of what this choice leads to"
    }
  ]
}`;

  let userPrompt = `Generate chapter ${chapterNumber} of a ${genre} bedtime story.`;
  
  if (chapterNumber === 1) {
    userPrompt += ` This is the opening chapter. Set a peaceful, dreamy scene that draws the listener into a magical ${genre} world.`;
  } else {
    userPrompt += ` Continue the story based on the previous choice: "${previousChoice}". Story context: ${JSON.stringify(storyState)}`;
  }

  try {
    console.log(`[OpenRouter/Claude] Generating ${genre} story chapter ${chapterNumber}`);
    console.log(`[OpenRouter/Claude] Previous choice: ${previousChoice || 'None (first chapter)'}`);

    const response = await openrouter.chat.completions.create({
      model: "anthropic/claude-sonnet-4.5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt + "\n\nRespond ONLY with valid JSON, no other text." }
      ],
      temperature: 0.8,
      max_tokens: 2000
    });

    console.log(`[OpenRouter/Claude] Response received, parsing JSON...`);
    const content = response.choices[0].message.content || "{}";
    // Extract JSON from response (Claude may include markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const result = JSON.parse(jsonStr);
    console.log(`[OpenRouter/Claude] Story generated - Content length: ${result.content?.length || 0}, Choices: ${result.choices?.length || 0}`);

    return {
      content: result.content || "",
      choices: result.choices || []
    };
  } catch (error) {
    console.error("[OpenRouter/Claude] API error:", error);
    throw new Error("Failed to generate story chapter: " + (error as Error).message);
  }
}
