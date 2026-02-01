import React, { useState } from 'react';
import { Recipe, AnalysisResult } from '../types';
import { Button } from './Button';
import { Clock, ArrowRight, Heart, Users, Check, ShoppingBag, X, Plus, RefreshCw, Box } from 'lucide-react';
import { UI_TEXT, LanguageCode, PANTRY_STAPLES_KEYWORDS } from '../constants';

interface RecipeSelectorProps {
  data: AnalysisResult;
  onSelect: (recipe: Recipe) => void;
  onMultiSelect: (recipes: Recipe[]) => void;
  onRefresh: (ingredients: string[]) => void;
  onBack: () => void;
  onToggleSave: (recipe: Recipe) => void;
  savedRecipeIds: string[];
  language: LanguageCode;
}

export const RecipeSelector: React.FC<RecipeSelectorProps> = ({ 
  data, 
  onSelect, 
  onMultiSelect,
  onRefresh,
  onBack, 
  onToggleSave, 
  savedRecipeIds, 
  language 
}) => {
  const t = UI_TEXT[language];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // State for editable ingredients
  const [currentIngredients, setCurrentIngredients] = useState<string[]>(data.detectedIngredients);
  const [isAdding, setIsAdding] = useState(false);
  const [newIngredient, setNewIngredient] = useState("");

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartMulti = () => {
    const selectedRecipes = data.recipes.filter(r => selectedIds.has(r.id));
    if (selectedRecipes.length > 0) {
      onMultiSelect(selectedRecipes);
    }
  };

  const removeIngredient = (ing: string) => {
    setCurrentIngredients(prev => prev.filter(i => i !== ing));
  };

  const addIngredient = () => {
    const val = newIngredient.trim();
    if (val && !currentIngredients.includes(val)) {
      setCurrentIngredients(prev => [...prev, val]);
    }
    setNewIngredient("");
    setIsAdding(false);
  };

  // Helper to filter out pantry staples from missing ingredients count
  const getFilteredMissingCount = (missingIngredients: string[]) => {
    return missingIngredients.filter(ing => {
      const lowerIng = ing.toLowerCase();
      // Check if any keyword matches the ingredient string
      return !PANTRY_STAPLES_KEYWORDS.some(keyword => lowerIng.includes(keyword.toLowerCase()));
    }).length;
  };

  // Check if ingredients list has changed from original data
  const isModified = JSON.stringify(currentIngredients.sort()) !== JSON.stringify(data.detectedIngredients.sort());

  return (
    <div className="w-full max-w-5xl mx-auto space-y-12 animate-fade-in pb-32">
      
      {/* Refined Header Analysis Summary - Matching Screenshot Styling */}
      <div className="bg-[#EAE6DF]/20 p-10 md:p-12 rounded-[3.5rem] text-center space-y-8 relative overflow-hidden group/header">
        <div className="flex flex-col items-center gap-4">
           <h2 className="text-4xl font-serif font-medium text-[#4A4238] opacity-80">{t.foundTitle}</h2>
           
           {isModified && (
             <button 
               onClick={() => onRefresh(currentIngredients)}
               className="flex items-center gap-2 text-[10px] font-bold tracking-widest text-white transition-all bg-[#D97757] hover:bg-[#C06042] px-5 py-2 rounded-full shadow-lg shadow-[#D97757]/20 uppercase"
             >
               <RefreshCw size={14} />
               {t.regenerateRecipes}
             </button>
           )}
        </div>

        <div className="flex flex-wrap justify-center gap-3 items-center max-w-2xl mx-auto">
          {currentIngredients.map((ing, i) => (
            <div 
              key={`${ing}-${i}`} 
              className="px-5 py-2.5 bg-[#EAE6DF]/40 text-[#8C857B] rounded-full text-sm font-medium border border-transparent shadow-sm flex items-center gap-2 transition-all hover:bg-white hover:shadow-md group/tag"
            >
              <span>{ing}</span>
              <button 
                onClick={() => removeIngredient(ing)}
                className="text-[#E5E0D8] hover:text-[#C06042] transition-colors p-0.5"
                title="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          {/* Inline Addition - One line flow */}
          {isAdding ? (
            <input 
              autoFocus
              className="px-5 py-2.5 bg-white text-[#4A4238] rounded-full text-sm font-medium border border-[#D97757] outline-none w-40 shadow-sm animate-fade-in"
              value={newIngredient}
              onChange={e => setNewIngredient(e.target.value)}
              onBlur={addIngredient}
              onKeyDown={e => e.key === 'Enter' && addIngredient()}
              placeholder="..."
            />
          ) : (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-10 h-10 flex items-center justify-center bg-[#EAE6DF]/60 text-[#8C857B] rounded-full shadow-sm hover:bg-white transition-all group/add"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Recipe Cards */}
      <div className="grid md:grid-cols-3 gap-8 px-4">
        {data.recipes.map((recipe) => {
          const isSaved = savedRecipeIds.includes(recipe.id);
          const isSelected = selectedIds.has(recipe.id);
          const filteredMissingCount = getFilteredMissingCount(recipe.missingIngredients);

          return (
            <div 
              key={recipe.id} 
              onClick={() => toggleSelection(recipe.id)}
              className={`flex flex-col bg-white rounded-[2.5rem] transition-all duration-500 overflow-hidden cursor-pointer relative group ${
                isSelected 
                  ? 'ring-1 ring-[#D97757]/30 shadow-[0_30px_60px_-15px_rgba(217,119,87,0.1)] transform -translate-y-1' 
                  : 'shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.08)] hover:-translate-y-1'
              }`}
            >
               {/* Selection Indicator - Consistent with screenshot */}
               <div className={`absolute top-6 left-6 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-[#D97757]/80 text-white shadow-md' : 'bg-transparent border border-transparent text-transparent'}`}>
                  {isSelected && <Check size={16} strokeWidth={3} />}
               </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSave(recipe);
                }}
                className="absolute top-6 right-6 z-10 p-2.5 bg-[#F9F8F6]/80 backdrop-blur-sm rounded-full shadow-sm text-[#C7C2BA] hover:text-[#D97757] transition-all"
              >
                <Heart 
                  size={20} 
                  className={`transition-colors duration-300 ${isSaved ? 'fill-[#D97757] text-[#D97757]' : ''}`} 
                />
              </button>

              <div className="p-8 pt-10 flex-1 flex flex-col">
                <div className="flex flex-col items-center gap-3 mb-6">
                   <span className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] rounded-full ${
                    recipe.difficulty === 'Easy' ? 'bg-[#E3F2E6] text-[#5A8C66]' :
                    recipe.difficulty === 'Medium' ? 'bg-[#FFF8E1] text-[#B08D55]' :
                    'bg-[#FEECEC] text-[#C06042]'
                  }`}>
                    {recipe.difficulty}
                  </span>

                  {/* Ingredient Summary Badges as requested in screenshot */}
                  <div className="flex gap-1.5">
                    <div className="flex items-center gap-1 px-2 py-0.5 bg-[#F2F9F4] text-[#5A8C66] text-[9px] font-black uppercase tracking-wider rounded-md border border-[#E3F2E6]">
                      <Check size={10} strokeWidth={3} />
                      {recipe.ingredientsFound.length} {t.youHave.split(' ')[0]}
                    </div>
                    {filteredMissingCount > 0 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-[#FFF4F0] text-[#D97757] text-[9px] font-black uppercase tracking-wider rounded-md border border-[#FADCD5]">
                        <ShoppingBag size={10} strokeWidth={3} />
                        {filteredMissingCount} {t.missing}
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="text-2xl font-serif font-medium text-[#4A4238] text-center mb-5 leading-tight group-hover:text-[#D97757] transition-colors px-2">
                  {recipe.title}
                </h3>
                
                <p className="text-[#8C857B] text-sm leading-relaxed text-center line-clamp-3 mb-8 flex-1 opacity-90 px-2">
                  {recipe.description}
                </p>

                <div className="flex items-center justify-center gap-6 pt-6 border-t border-[#F2EFE9]/50">
                  <div className="flex items-center text-[#8C857B] text-xs font-bold tracking-widest uppercase">
                    <Clock size={16} className="mr-2 opacity-40" />
                    {recipe.prepTimeMinutes}M
                  </div>
                  {recipe.servings && (
                    <div className="flex items-center text-[#8C857B] text-xs font-bold tracking-widest uppercase">
                      <Users size={16} className="mr-2 opacity-40" />
                      {recipe.servings}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-transparent">
                <Button 
                  variant={isSelected ? "primary" : "outline"}
                  fullWidth 
                  className={`py-4 transition-all ${isSelected ? "opacity-90 scale-[0.98] !bg-[#D97757]/80 !shadow-none" : "!border-none !text-[#8C857B] !bg-transparent hover:!bg-[#F9F8F6]"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isSelected && selectedIds.size === 0) {
                      onSelect(recipe);
                    } else {
                      toggleSelection(recipe.id);
                    }
                  }}
                  icon={isSelected ? <Check size={18} /> : <ArrowRight size={18} />}
                >
                  {isSelected ? "Selected" : t.cookThis}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center">
        <button 
          onClick={onBack}
          className="text-[#C7C2BA] hover:text-[#D97757] text-[10px] font-bold tracking-widest uppercase transition-all py-3 px-8 rounded-full border border-transparent"
        >
          {t.scanDifferent}
        </button>
      </div>

      {/* Sticky Bottom Bar for Multi-Selection - Centered in the 'middle' as requested */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-40 animate-slide-up w-max max-w-full px-6">
           <Button 
             onClick={handleStartMulti}
             className="shadow-[0_20px_50px_-10px_rgba(217,119,87,0.2)] px-10 py-5 rounded-full flex items-center justify-center gap-4 text-lg !bg-[#EAE6DF]/90 backdrop-blur-md !text-[#4A4238] hover:!bg-[#EAE6DF] !border-none italic font-serif"
           >
             <div className="p-1.5 bg-white rounded-lg shadow-sm">
                <ShoppingBag size={20} className="text-[#D97757] opacity-80" />
             </div>
             <span className="whitespace-nowrap">Cook {selectedIds.size} {t.foundTitle}</span>
           </Button>
        </div>
      )}
    </div>
  );
};