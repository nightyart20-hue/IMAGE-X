import { GoogleGenAI } from "@google/genai";
import { ModelType, AspectRatio } from "../types";

const getApiKey = async (model: ModelType): Promise<string | undefined> => {
  // Always ensure key selection for Pro model
  if (model === ModelType.PRO && window.aistudio) {
    const hasKey = await window.aistudio.hasSelectedApiKey();
    if (!hasKey) {
      await window.aistudio.openSelectKey();
    }
  }
  return process.env.API_KEY;
};

const generateSingleImage = async (
  ai: GoogleGenAI,
  prompt: string,
  model: ModelType,
  aspectRatio: AspectRatio,
  config: any,
  seed: number
): Promise<string> => {
  // Map 3:2 to 4:3 and 4:5 to 3:4 as they are not natively supported by the API
  let apiAspectRatio = aspectRatio;
  if (aspectRatio === '3:2') apiAspectRatio = '4:3';
  if (aspectRatio === '4:5') apiAspectRatio = '3:4';

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [{ text: prompt }],
    },
    config: {
      ...config,
      // Add random seed to ensure variety and prevent caching/deduplication of identical requests
      seed: seed,
      imageConfig: {
        ...config.imageConfig,
        aspectRatio: apiAspectRatio,
      }
    },
  });

  if (response.candidates && response.candidates.length > 0) {
    for (const candidate of response.candidates) {
      if (candidate.finishReason === 'SAFETY') {
        throw new Error("Image generation blocked by safety filters.");
      }

      const parts = candidate.content?.parts;
      if (parts) {
        for (const part of parts) {
          if (part.inlineData && part.inlineData.data) {
            return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          }
        }
      }
    }
  }
  throw new Error("No image data found.");
};

// Distinct angles to apply when generating multiple images
const VARIATION_ANGLES = [
  "cinematic front view",
  "dynamic three-quarter angle",
  "dramatic side profile",
  "low angle perspective",
  "overhead high angle"
];

export const generateImages = async (
  prompt: string,
  style: string,
  model: ModelType,
  aspectRatio: AspectRatio = '1:1',
  count: number = 1
): Promise<string[]> => {
  const apiKey = await getApiKey(model);
  
  if (!apiKey) {
      throw new Error("API Key not available.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  // Prompt Construction
  const qualitySuffix = "professional photography, ultra high resolution, sharp focus";
  
  // OPTIMIZATION FOR FAST MODEL (FREE PLAN) - "Human Touch" & "Logic Look"
  // Enhanced to aggressively counter the "AI plastic" look.
  // We use "masterpiece" and specific film stock references (Kodak, Fujifilm) to ground the aesthetic.
  // "Visible pores" and "natural imperfections" fight the smoothing effect.
  const humanTouchKeywords = model === ModelType.FLASH 
    ? ", masterpiece, best quality, raw photo, shot on 35mm, kodak portra 400, fujifilm, natural skin texture, visible pores, slight film grain, atmospheric lighting, candid, authentic, natural imperfections, anatomical accuracy, physically plausible, depth of field, soft natural shadows, high fidelity, micro details, no cgi, no 3d render, no plastic skin, no artificial smoothing"
    : "";

  const cleanPrompt = prompt.trim().replace(/[.,;]+$/, "");
  const cleanStyle = style.trim();
  
  let finalPrompt = "";
  if (cleanStyle) {
    finalPrompt = `${cleanPrompt}, ${cleanStyle}, ${qualitySuffix}${humanTouchKeywords}`;
  } else {
    // If no style, force the realistic/human baseline
    finalPrompt = `${cleanPrompt}, realistic environment, natural lighting, ${qualitySuffix}${humanTouchKeywords}`;
  }

  const config: any = {
    imageConfig: {},
  };

  if (model === ModelType.PRO) {
      config.imageConfig.imageSize = '2K';
  }

  // Batch Generation Logic
  const safeCount = Math.min(Math.max(1, count), 4);
  
  // Create an array of promises with staggering to avoid rate limits
  const promises = Array.from({ length: safeCount }).map(async (_, index) => {
    // Stagger requests: Wait 0ms, 400ms, 800ms...
    const delay = index * 400; 
    await new Promise(resolve => setTimeout(resolve, delay));

    // Generate a large random seed for each request to guarantee unique variations
    const seed = Math.floor(Math.random() * 2147483647);

    // Dynamic Angle Injection for Batches
    // If generating multiple images, append a distinct camera angle to each to ensure variety
    let variedPrompt = finalPrompt;
    if (safeCount > 1) {
       const angle = VARIATION_ANGLES[index % VARIATION_ANGLES.length];
       variedPrompt = `${finalPrompt}, ${angle}`;
    }

    try {
      return await generateSingleImage(ai, variedPrompt, model, aspectRatio, config, seed);
    } catch (err: any) {
      console.warn(`Image generation ${index + 1}/${safeCount} failed:`, err.message);
      return null;
    }
  });

  try {
    const results = await Promise.all(promises);
    const successfulImages = results.filter((img): img is string => img !== null);
    
    if (successfulImages.length === 0) {
      throw new Error("All image generations failed. Please check your prompt or try again.");
    }

    return successfulImages;

  } catch (error: any) {
    console.error("Gemini API Batch Error:", error);
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes("403") || errorMessage.includes("permission") || errorMessage.includes("not found")) {
        if (window.aistudio) {
             await window.aistudio.openSelectKey();
             throw new Error("Access denied. Please select a valid API Key.");
        }
    }
    
    throw error;
  }
};