import { GoogleGenAI, Type } from '@google/genai';

// Initialize the Gemini client
export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define tools for the chat model
export const chatTools = [
  {
    functionDeclarations: [
      {
        name: 'generate_image',
        description: 'Generate an image based on a prompt. Use this when the user asks to create, draw, or generate a picture or image.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: 'The detailed prompt describing the image to generate.' },
            aspectRatio: { type: Type.STRING, description: 'The aspect ratio (e.g., "1:1", "16:9", "9:16", "4:3", "3:4"). Default is "1:1".' },
            quality: { type: Type.STRING, description: 'Quality of the image. Can be "standard" or "high". Default is "standard".' }
          },
          required: ['prompt']
        }
      },
      {
        name: 'edit_image',
        description: 'Edit an existing image based on a prompt. Use this when the user asks to modify, change, or edit an image they have uploaded.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: 'The detailed prompt describing how to edit the image.' }
          },
          required: ['prompt']
        }
      },
      {
        name: 'generate_video',
        description: 'Generate a video based on a prompt. Use this when the user asks to create or generate a video.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: 'The detailed prompt describing the video to generate.' },
            aspectRatio: { type: Type.STRING, description: 'The aspect ratio (e.g., "16:9", "9:16"). Default is "16:9".' },
            resolution: { type: Type.STRING, description: 'The resolution of the video (e.g., "720p", "1080p"). Default is "720p".' }
          },
          required: ['prompt']
        }
      },
      {
        name: 'generate_music',
        description: 'Generate a music track or clip based on a prompt. Use this when the user asks to create or generate music, a song, or a beat.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            prompt: { type: Type.STRING, description: 'The detailed prompt describing the music to generate.' },
            length: { type: Type.STRING, description: 'Length of the track. Can be "clip" (up to 30s) or "full". Default is "clip".' },
            genre: { type: Type.STRING, description: 'The genre of the music (e.g., "pop", "rock", "classical", "jazz").' },
            mood: { type: Type.STRING, description: 'The mood of the music (e.g., "upbeat", "sad", "energetic", "chill").' }
          },
          required: ['prompt']
        }
      }
    ]
  }
];

// Helper to generate an image
export async function generateImage(prompt: string, aspectRatio = '1:1', quality = 'standard') {
  const model = quality === 'high' ? 'gemini-3-pro-image-preview' : 'gemini-3.1-flash-image-preview';
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      imageConfig: {
        aspectRatio,
        imageSize: quality === 'high' ? '2K' : '1K'
      }
    }
  });
  
  // Extract base64 image
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error('Failed to generate image');
}

// Helper to edit an image
export async function editImage(prompt: string, base64Image: string, mimeType: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { data: base64Image.split(',')[1], mimeType } },
        { text: prompt }
      ]
    }
  });
  
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  throw new Error('Failed to edit image');
}

// Helper to generate a video
export async function generateVideo(prompt: string, aspectRatio = '16:9', resolution = '720p', quality = 'standard', codec = 'default') {
  let finalPrompt = prompt;
  if (quality === '4K') finalPrompt += ' in 4K resolution';
  if (codec !== 'default') finalPrompt += ` using ${codec} codec`;

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: finalPrompt,
    config: {
      numberOfVideos: 1,
      resolution: (resolution === '1080p' || quality === 'HD' || quality === '4K') ? '1080p' : '720p',
      aspectRatio
    }
  });

  // Poll for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error('Failed to generate video');
  
  // Return the URI (needs API key to fetch, handled in UI)
  return downloadLink;
}

// Helper to generate music
export async function generateMusic(prompt: string, length = 'clip', genre?: string, mood?: string, language?: string, tempo?: string, onChunk?: (base64: string) => void) {
  const model = length === 'full' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
  
  let finalPrompt = prompt;
  if (genre) finalPrompt += `, Genre: ${genre}`;
  if (mood) finalPrompt += `, Mood: ${mood}`;
  if (language) finalPrompt += `, Language: ${language}`;
  if (tempo) finalPrompt += `, Tempo: ${tempo}`;

  const response = await ai.models.generateContentStream({
    model,
    contents: finalPrompt,
  });

  let audioBase64 = "";
  let mimeType = "audio/wav";

  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part.inlineData?.data) {
        if (!audioBase64 && part.inlineData.mimeType) {
          mimeType = part.inlineData.mimeType;
        }
        audioBase64 += part.inlineData.data;
        if (onChunk) onChunk(part.inlineData.data);
      }
    }
  }
  
  return { audioBase64, mimeType };
}
