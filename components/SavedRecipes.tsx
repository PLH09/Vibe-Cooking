
import React, { useState } from 'react';
import { Recipe } from '../types';
import { Button } from './Button';
import { Clock, ArrowRight, Trash2, ArrowLeft, Users, ShoppingBag, Check } from 'lucide-react';
import { UI_TEXT, LanguageCode } from '../constants';

interface SavedRecipesProps {
  recipes: Recipe[];
  onSelect: (recipe: Recipe) => void;
  onMultiSelect: (recipes: Recipe[]) => void;
  onRemove: (recipeId: string) => void;
  onBack: () => void;
  language: LanguageCode;
}

export const SavedRecipes: React.FC<SavedRecipesProps> = ({ recipes, onSelect, onMultiSelect, onRemove, onBack, language }) => {
  const t = UI_TEXT[language];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleStartMulti = () => {
    const selectedRecipes = recipes.filter(r => selectedIds.has(r.id));
    if (selectedRecipes.length > 0) {
      onMultiSelect(selectedRecipes);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-3xl font-serif font-bold text-stone-800">{t.myCookbook}</h2>
      </div>

      {recipes.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-stone-100">
          <p className="text-xl text-stone-400 font-serif mb-4">{t.noSavedRecipes}</p>
          <Button onClick={onBack} variant="outline">{t.findRecipes}</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recipes.map((recipe) => {
            const isSelected = selectedIds.has(recipe.id);
            return (
              <div 
                key={recipe.id} 
                onClick={() => toggleSelection(recipe.id)}
                className={`flex flex-col bg-white rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden border cursor-pointer relative group ${isSelected ? 'ring-2 ring-orange-500 border-orange-500' : 'border-stone-100'}`}
              >
                 {/* Selection Indicator */}
                 <div className={`absolute top-4 left-4 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white/80 border-stone-300 text-transparent'}`}>
                    <Check size={14} strokeWidth={3} />
                 </div>

                {/* Remove Button */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(recipe.id);
                  }}
                  className="absolute top-4 right-4 z-10 p-2 bg-white/80 hover:bg-red-50 text-stone-400 hover:text-red-500 rounded-full backdrop-blur-sm transition-colors"
                  title={t.remove}
                >
                  <Trash2 size={18} />
                </button>

                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4 pr-8 pl-6">
                    <span className={`px-2 py-1 text-xs font-bold uppercase tracking-wider rounded-md ${
                      recipe.difficulty === 'Easy' ? 'bg-green-100 text-green-700' :
                      recipe.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {recipe.difficulty}
                    </span>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center text-stone-500 text-sm">
                        <Clock size={16} className="mr-1" />
                        {recipe.prepTimeMinutes}m
                      </div>
                      {recipe.servings && (
                        <div className="flex items-center text-stone-400 text-xs">
                          <Users size={14} className="mr-1" />
                          {recipe.servings}
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl font-serif font-bold text-stone-800 mb-2 group-hover:text-orange-600 transition-colors">
                    {recipe.title}
                  </h3>
                  <p className="text-stone-600 text-sm line-clamp-3 mb-4">
                    {recipe.description}
                  </p>
                </div>

                <div className="p-4 bg-stone-50 border-t border-stone-100">
                  <Button 
                    variant={isSelected ? "primary" : "primary"}
                    fullWidth 
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
      )}

      {/* Sticky Bottom Bar for Multi-Selection */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 animate-slide-up">
           <Button 
             onClick={handleStartMulti}
             className="shadow-2xl shadow-orange-500/40 px-8 py-4 rounded-full flex items-center gap-3 text-lg"
           >
             <ShoppingBag size={24} />
             <span>Cook {selectedIds.size} Dish{selectedIds.size > 1 ? 'es' : ''}</span>
           </Button>
        </div>
      )}
    </div>
  );
};
