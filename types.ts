
export enum AppState {
  WELCOME = 'WELCOME',
  ANALYZING = 'ANALYZING',
  RECIPE_SELECTION = 'RECIPE_SELECTION',
  COOKING = 'COOKING',
  SAVED_RECIPES = 'SAVED_RECIPES',
  ERROR = 'ERROR',
  FOOD_STYLING = 'FOOD_STYLING'
}

export interface CookingStep {
  stepNumber: number;
  instruction: string;
  durationSeconds: number; // 0 if no timer needed
  tip?: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  prepTimeMinutes: number;
  servings: string; // e.g. "2-3 people"
  ingredientsFound: string[]; // Strings containing name and quantity, e.g. "2 eggs", "200g Pork"
  missingIngredients: string[]; // Strings containing name and quantity, e.g. "1 tbsp Soy Sauce"
  steps: CookingStep[];
}

export interface AnalysisResult {
  recipes: Recipe[];
  detectedIngredients: string[];
  userIntent: string;
}

export interface Avatar {
  id: string;
  name: Record<string, string>;
  emoji: string;
  color: string;
  voiceName: string;
  systemInstruction?: string;
}

export type VoiceOption = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
export type AlarmSound = 'classic' | 'gentle' | 'energetic';

export interface AppSettings {
  voice: VoiceOption;
  alarmSound: AlarmSound;
}
