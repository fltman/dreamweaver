import OpenAI from "openai";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key",
  timeout: 60000 // 60 second timeout
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
    console.log(`[OpenAI] Generating ${genre} story chapter ${chapterNumber}`);
    console.log(`[OpenAI] Previous choice: ${previousChoice || 'None (first chapter)'}`);
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.8,
      max_tokens: 2000
    });

    console.log(`[OpenAI] Response received, parsing JSON...`);
    const result = JSON.parse(response.choices[0].message.content || "{}");
    console.log(`[OpenAI] Story generated - Content length: ${result.content?.length || 0}, Choices: ${result.choices?.length || 0}`);
    
    return {
      content: result.content || "",
      choices: result.choices || []
    };
  } catch (error) {
    console.error("[OpenAI] API error:", error);
    throw new Error("Failed to generate story chapter: " + (error as Error).message);
  }
}
