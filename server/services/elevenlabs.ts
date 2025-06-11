interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  description: string;
}

const VOICE_MAP: Record<string, string> = {
  sarah: "EXAVITQu4vr4xnSDxMaL", // Bella - warm and gentle
  david: "VR6AewLTigWG4xSOukaG", // Josh - deep and soothing  
  luna: "pNInz6obpgDQGcFmaJgB", // Adam - ethereal and dreamy
};

export async function convertTextToSpeech(
  text: string,
  voiceId: string,
  options: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
  } = {}
): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY_ENV_VAR || "default_key";
  
  if (!apiKey || apiKey === "default_key") {
    throw new Error("ElevenLabs API key not found in environment variables");
  }

  const voice = VOICE_MAP[voiceId] || VOICE_MAP.sarah;
  
  const requestBody = {
    text: text,
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: options.stability || 0.75,
      similarity_boost: options.similarity_boost || 0.75,
      style: options.style || 0.25,
      use_speaker_boost: true
    }
  };

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    return Buffer.from(audioBuffer);
  } catch (error) {
    console.error("ElevenLabs API error:", error);
    throw new Error("Failed to convert text to speech: " + (error as Error).message);
  }
}

export function getAvailableVoices(): Array<{ id: string; name: string; description: string }> {
  return [
    { id: 'sarah', name: 'Sarah', description: 'Gentle & Warm' },
    { id: 'david', name: 'David', description: 'Deep & Soothing' },
    { id: 'luna', name: 'Luna', description: 'Ethereal & Dreamy' }
  ];
}
