
import { GoogleGenAI, Type, Schema, Modality } from "@google/genai";
import { getSystemInstruction } from "../constants";
import { AnalysisResult, Recipe } from "../types";

// Helper to convert file to Base64
export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1];
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const recipeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detectedIngredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of ingredients identified."
    },
    userIntent: {
      type: Type.STRING,
      description: "Summary of what the user asked for."
    },
    recipes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
          prepTimeMinutes: { type: Type.NUMBER },
          servings: { type: Type.STRING, description: "Number of people this recipe serves (e.g. '2-3 people')." },
          ingredientsFound: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Ingredients available. MUST include quantity (e.g. '2 eggs')." 
          },
          missingIngredients: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Ingredients needed. MUST include quantity (e.g. '1 tbsp salt')."
          },
          steps: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                stepNumber: { type: Type.INTEGER },
                instruction: { type: Type.STRING },
                durationSeconds: { type: Type.INTEGER, description: "Time required for this step in seconds. Use 0 for manual tasks." },
                tip: { type: Type.STRING, nullable: true }
              },
              required: ["stepNumber", "instruction", "durationSeconds"]
            }
          }
        },
        required: ["id", "title", "description", "difficulty", "steps", "ingredientsFound", "servings"]
      }
    }
  },
  required: ["recipes", "detectedIngredients", "userIntent"]
};

// Simplified schema for just updating a recipe
const updateRecipeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    servings: { type: Type.STRING },
    ingredientsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
    missingIngredients: { type: Type.ARRAY, items: { type: Type.STRING } },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          instruction: { type: Type.STRING },
          durationSeconds: { type: Type.INTEGER },
          tip: { type: Type.STRING, nullable: true }
        }
      }
    }
  }
};

export const analyzeFridgeVideo = async (videoFile: File, dietaryRestrictions: string, language: string, servings?: string): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const videoPart = await fileToGenerativePart(videoFile);
  const dietaryText = dietaryRestrictions ? `Dietary Restrictions: ${dietaryRestrictions}.` : "";
  const servingsText = servings ? `Number of people: ${servings}.` : "";

  // Using gemini-3-pro-preview as requested for video understanding
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview", 
    contents: {
      parts: [
        videoPart,
        { text: `You are a master chef with exceptional ingredient recognition skills. Analyze this video frame-by-frame with high precision. 
        Pay meticulous attention to visual details: observe surface textures (e.g., the matte, ribbed skin of a pumpkin versus the smooth or porous surface of cheese), 
        color gradients, and contextual placement to avoid misidentification. 
        Carefully distinguish between visually similar items like blocks of dairy and pieces of hard squash.
        List all identified ingredients with estimated quantities.
        ${dietaryText} ${servingsText} 
        Generate 3 unique, creative, and waste-reducing recipes based on these specific ingredients. Output language: ${language}.` }
      ]
    },
    config: {
      systemInstruction: getSystemInstruction(language),
      responseMimeType: "application/json",
      responseSchema: recipeSchema,
      temperature: 0.2, // Lower temperature for more accurate identification
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from Gemini");
  }

  try {
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to parse recipe data");
  }
};

export const analyzeFridgeImage = async (imageFile: File, dietaryRestrictions: string, language: string, servings?: string): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(imageFile);
  const dietaryText = dietaryRestrictions ? `Dietary Restrictions: ${dietaryRestrictions}.` : "";
  const servingsText = servings ? `Number of people: ${servings}.` : "";

  // Using gemini-3-pro-preview as requested for high-quality image reasoning
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview", 
    contents: {
      parts: [
        imagePart,
        { text: `You are an expert chef with a keen eye for ingredients. Analyze this image with maximum detail. 
        Look closely at textures, light reflection, and shapes to accurately identify items. 
        Specifically, distinguish between items like pumpkin (ribbed skin, specific orange hue) and cheese (smooth or waxy surface) to avoid common misidentifications. 
        Confirm identities by looking at the surroundings.
        List all ingredients found with estimated quantities.
        ${dietaryText} ${servingsText} 
        Generate 3 unique and creative recipes. Output language: ${language}.` }
      ]
    },
    config: {
      systemInstruction: getSystemInstruction(language),
      responseMimeType: "application/json",
      responseSchema: recipeSchema,
      temperature: 0.2, // Lower temperature for accuracy
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from Gemini");
  }

  try {
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to parse recipe data");
  }
};

export const analyzeIngredientsText = async (ingredients: string, craving: string, dietaryRestrictions: string, language: string, servings?: string): Promise<AnalysisResult> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const servingsText = servings ? `Number of people: ${servings}.` : "";
  const prompt = `User Input: ${ingredients}. \nCraving/Context: ${craving || "None"}. \nDietary: ${dietaryRestrictions || "None"}. \n${servingsText} \nOutput Language: ${language}.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      systemInstruction: getSystemInstruction(language),
      responseMimeType: "application/json",
      responseSchema: recipeSchema,
      temperature: 0.4,
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from Gemini");
  }

  try {
    return JSON.parse(text) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    throw new Error("Failed to parse recipe data");
  }
};

export const updateRecipeServings = async (recipe: Recipe, newServings: string, language: string): Promise<Recipe> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    I have a recipe for "${recipe.title}" that currently serves "${recipe.servings}".
    I need to scale it to serve "${newServings}".
    
    Original Ingredients: ${JSON.stringify([...recipe.ingredientsFound, ...recipe.missingIngredients])}
    Original Steps: ${JSON.stringify(recipe.steps)}

    Please calculate the new ingredient quantities and update any quantities mentioned in the step instructions.
    Return the updated recipe JSON. Output Language: ${language}.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [{ text: prompt }]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: updateRecipeSchema,
      temperature: 0.2,
    }
  });

  const text = response.text;
  if (!text) {
    throw new Error("No response from Gemini");
  }

  try {
    const partial = JSON.parse(text);
    return { ...recipe, ...partial };
  } catch (e) {
    console.error("Failed to parse updated recipe", e);
    throw new Error("Failed to update recipe");
  }
};

export const generateSpeech = async (text: string, language: string, voiceName: string = 'Puck'): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: {
        parts: [{ text: text }]
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!audioData) {
      throw new Error("No audio data generated");
    }
    return audioData;
  } catch (error: any) {
    // Standardize Rate Limit Error
    const errString = JSON.stringify(error) + (error.message || '');
    if (
      errString.includes('429') || 
      errString.includes('RESOURCE_EXHAUSTED') ||
      error.status === 429
    ) {
       throw new Error("RATE_LIMIT_EXCEEDED");
    }
    throw error;
  }
};

export const editFoodImage = async (imageFile: File, prompt: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const imagePart = await fileToGenerativePart(imageFile);

  // Using gemini-2.5-flash-image for general image editing tasks
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        imagePart,
        { text: prompt },
      ]
    },
    config: {
        responseModalities: [Modality.IMAGE],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("No image generated");
};
