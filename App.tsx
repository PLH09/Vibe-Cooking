import React, { useState, useEffect, useRef } from 'react';
import { AppState, AnalysisResult, Recipe, AppSettings } from './types';
import { analyzeFridgeVideo, analyzeIngredientsText, analyzeFridgeImage } from './services/geminiService';
import { VideoUpload } from './components/VideoUpload';
import { TextInput } from './components/TextInput';
import { RecipeSelector } from './components/RecipeSelector';
import { CookingMode } from './components/CookingMode';
import { SavedRecipes } from './components/SavedRecipes';
import { SettingsModal } from './components/SettingsModal';
import { UtensilsCrossed, Globe, ChevronDown, BookHeart, Settings } from 'lucide-react';
import { LANGUAGES, LanguageCode, UI_TEXT } from './constants';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.WELCOME);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedRecipes, setSelectedRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputMode, setInputMode] = useState<'video' | 'text'>('video');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  
  // Initialize language from localStorage
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('vibe_cooking_language');
    const isValid = LANGUAGES.some(l => l.code === saved);
    return (isValid && saved) ? (saved as LanguageCode) : 'en';
  });

  // Initialize saved recipes from localStorage
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>(() => {
    try {
      const saved = localStorage.getItem('vibe_cooking_saved_recipes');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to load saved recipes", e);
      return [];
    }
  });

  // Initialize Settings from localStorage
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('vibe_cooking_settings');
      return saved ? JSON.parse(saved) : { voice: 'Puck', alarmSound: 'classic' };
    } catch {
      return { voice: 'Puck', alarmSound: 'classic' };
    }
  });

  // Persist language selection
  useEffect(() => {
    localStorage.setItem('vibe_cooking_language', language);
  }, [language]);

  // Persist saved recipes
  useEffect(() => {
    localStorage.setItem('vibe_cooking_saved_recipes', JSON.stringify(savedRecipes));
  }, [savedRecipes]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem('vibe_cooking_settings', JSON.stringify(settings));
  }, [settings]);

  // Close language menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const t = UI_TEXT[language];

  const handleMediaUpload = async (file: File, dietaryRestrictions: string, servings?: string) => {
    setLoading(true);
    try {
      let result;
      if (file.type.startsWith('image/')) {
        result = await analyzeFridgeImage(file, dietaryRestrictions, language, servings);
      } else {
        result = await analyzeFridgeVideo(file, dietaryRestrictions, language, servings);
      }
      setAnalysisResult(result);
      setAppState(AppState.RECIPE_SELECTION);
    } catch (error) {
      console.error(error);
      alert("Something went wrong analyzing your media. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTextSearch = async (ingredients: string, craving: string, dietaryRestrictions: string, servings?: string) => {
    setLoading(true);
    try {
      const result = await analyzeIngredientsText(ingredients, craving, dietaryRestrictions, language, servings);
      setAnalysisResult(result);
      setAppState(AppState.RECIPE_SELECTION);
    } catch (error) {
      console.error(error);
      alert("Something went wrong generating recipes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshIngredients = async (newIngredients: string[]) => {
    // Re-trigger analysis using the updated ingredients list via text search logic
    const ingredientsStr = newIngredients.join(', ');
    await handleTextSearch(ingredientsStr, "", "", ""); // Intent and dietary might be empty or we could persist them if needed
  };

  const handleRecipeSelect = (recipe: Recipe) => {
    setSelectedRecipes([recipe]);
    setAppState(AppState.COOKING);
  };

  const handleMultiRecipeSelect = (recipes: Recipe[]) => {
    setSelectedRecipes(recipes);
    setAppState(AppState.COOKING);
  };

  const handleBackToSelection = () => {
    if (analysisResult) {
       setAppState(AppState.RECIPE_SELECTION);
    } else {
       setAppState(AppState.SAVED_RECIPES);
    }
    setSelectedRecipes([]);
  };

  const handleReset = () => {
    setAppState(AppState.WELCOME);
    setAnalysisResult(null);
    setSelectedRecipes([]);
  };

  const toggleSaveRecipe = (recipe: Recipe) => {
    setSavedRecipes(prev => {
      const exists = prev.some(r => r.id === recipe.id);
      if (exists) {
        return prev.filter(r => r.id !== recipe.id);
      } else {
        return [...prev, recipe];
      }
    });
  };

  const removeSavedRecipe = (id: string) => {
    setSavedRecipes(prev => prev.filter(r => r.id !== id));
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const text = t as any;
    if (hour < 12) return text.greetingMorning;
    if (hour < 18) return text.greetingAfternoon;
    return text.greetingEvening;
  };

  return (
    <div className="min-h-screen text-[#4A4238] font-sans selection:bg-[#D97757] selection:text-white">
      
      {/* Navigation / Header */}
      <nav className="p-8 flex justify-between items-center max-w-7xl mx-auto">
        <div 
          className="flex items-center gap-3 font-serif font-bold text-2xl text-[#D97757] cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleReset}
        >
          <UtensilsCrossed size={26} strokeWidth={2} />
          <span className="tracking-tight">{t.title}</span>
        </div>

        <div className="flex items-center gap-4">
          {appState === AppState.COOKING && (
            <button 
              onClick={handleBackToSelection}
              className="text-[#8C857B] hover:text-[#4A4238] text-sm font-medium hidden md:block px-4 py-2 rounded-full hover:bg-[#F2EFE9] transition-colors"
            >
              {t.exitMode}
            </button>
          )}
          
          {appState === AppState.WELCOME && (
            <button
               onClick={() => setAppState(AppState.SAVED_RECIPES)}
               className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#6B6356] hover:text-[#D97757] hover:bg-white rounded-full transition-all shadow-sm border border-transparent hover:border-[#F2EFE9]"
            >
              <BookHeart size={18} />
              <span className="hidden sm:inline">{t.savedRecipes}</span>
            </button>
          )}

          <div className="relative" ref={langMenuRef}>
            <button 
              onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all duration-300 ${isLangMenuOpen ? 'bg-white border-[#D97757]/30 text-[#D97757] shadow-sm' : 'bg-transparent border-transparent hover:bg-white text-[#6B6356]'}`}
            >
              <Globe size={18} />
              <span className="text-sm font-medium uppercase tracking-wide">{language}</span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${isLangMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isLangMenuOpen && (
              <div className="absolute right-0 mt-3 w-48 bg-white rounded-2xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.05)] border border-[#F2EFE9] overflow-hidden z-50 origin-top-right animate-fade-in">
                <div className="py-2">
                  <div className="px-5 py-2 text-[10px] font-bold text-[#8C857B] uppercase tracking-widest border-b border-[#F9F8F6] mb-1">
                    Language
                  </div>
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code as LanguageCode);
                        setIsLangMenuOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3 text-sm hover:bg-[#F9F8F6] flex items-center justify-between transition-colors ${language === lang.code ? 'text-[#D97757] font-semibold' : 'text-[#6B6356]'}`}
                    >
                      <span>{lang.label}</span>
                      {language === lang.code && <div className="w-1.5 h-1.5 rounded-full bg-[#D97757]"></div>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-full text-[#6B6356] hover:text-[#D97757] hover:bg-white transition-all shadow-sm border border-transparent hover:border-[#F2EFE9]"
            title={t.settings}
          >
            <Settings size={20} />
          </button>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-6 md:py-12">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-fade-in">
             <div className="relative w-24 h-24">
               <div className="absolute inset-0 border-4 border-[#D97757]/20 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-[#D97757] border-t-transparent rounded-full animate-spin"></div>
             </div>
             <p className="text-xl font-serif font-medium text-[#4A4238] animate-pulse">{t.analyzing}</p>
          </div>
        ) : (
          <>
            {appState === AppState.WELCOME && (
              <div className="flex flex-col items-center justify-center min-h-[65vh] space-y-16 animate-fade-in-up">
                <div className="text-center max-w-4xl space-y-4">
                  <h1 className="text-3xl md:text-5xl font-serif font-medium text-[#4A4238] leading-tight md:leading-tight">
                    {getGreeting()}
                    <br className="hidden md:block" />
                    <span className="text-[#D97757] italic ml-2 md:ml-0 block mt-2">{t.subtitleHighlight}</span>
                  </h1>
                </div>
                
                <div className="w-full max-w-lg space-y-8">
                  <div className="flex p-1.5 bg-[#EAE6DF] rounded-full mx-auto w-fit shadow-inner">
                    <button
                      onClick={() => setInputMode('video')}
                      className={`px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${
                        inputMode === 'video' ? 'bg-white text-[#D97757] shadow-sm transform scale-105' : 'text-[#8C857B] hover:text-[#6B6356]'
                      }`}
                    >
                      {t.videoScan}
                    </button>
                    <button
                      onClick={() => setInputMode('text')}
                      className={`px-8 py-3 rounded-full text-sm font-semibold transition-all duration-300 ${
                        inputMode === 'text' ? 'bg-white text-[#D97757] shadow-sm transform scale-105' : 'text-[#8C857B] hover:text-[#6B6356]'
                      }`}
                    >
                      {t.textInput}
                    </button>
                  </div>

                  {inputMode === 'video' ? (
                    <VideoUpload onUpload={handleMediaUpload} isLoading={loading} language={language} />
                  ) : (
                    <TextInput onSearch={handleTextSearch} isLoading={loading} language={language} />
                  )}
                </div>
              </div>
            )}

            {appState === AppState.RECIPE_SELECTION && analysisResult && (
              <RecipeSelector 
                data={analysisResult} 
                onSelect={handleRecipeSelect} 
                onMultiSelect={handleMultiRecipeSelect}
                onRefresh={handleRefreshIngredients}
                onBack={handleReset}
                language={language}
                onToggleSave={toggleSaveRecipe}
                savedRecipeIds={savedRecipes.map(r => r.id)}
              />
            )}

            {appState === AppState.SAVED_RECIPES && (
              <SavedRecipes 
                recipes={savedRecipes}
                onSelect={handleRecipeSelect}
                onMultiSelect={handleMultiRecipeSelect}
                onRemove={removeSavedRecipe}
                onBack={handleReset}
                language={language}
              />
            )}

            {appState === AppState.COOKING && selectedRecipes.length > 0 && (
              <CookingMode 
                recipes={selectedRecipes} 
                onExit={handleBackToSelection} 
                language={language}
                onToggleSave={toggleSaveRecipe}
                savedRecipeIds={savedRecipes.map(r => r.id)}
                alarmSound={settings.alarmSound}
                voiceName={settings.voice}
              />
            )}
          </>
        )}
      </main>
      
      {isSettingsOpen && (
        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          language={language}
          settings={settings}
          onUpdateSettings={updateSettings}
        />
      )}

      <footer className="text-center py-10 text-[#B0A89E] text-xs font-medium tracking-wide">
        <p>&copy; {new Date().getFullYear()} {t.title}. Mindful cooking powered by Gemini.</p>
      </footer>
    </div>
  );
};

export default App;