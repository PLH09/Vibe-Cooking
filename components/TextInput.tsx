import React, { useState } from 'react';
import { Button } from './Button';
import { Search, Utensils, X, Plus, Type as TypeIcon } from 'lucide-react';
import { DIETARY_OPTIONS, UI_TEXT, LanguageCode } from '../constants';

interface TextInputProps {
  onSearch: (ingredients: string, craving: string, dietaryRestrictions: string, servings?: string) => void;
  isLoading: boolean;
  language: LanguageCode;
}

export const TextInput: React.FC<TextInputProps> = ({ onSearch, isLoading, language }) => {
  const [ingredients, setIngredients] = useState('');
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [servings, setServings] = useState("");
  
  // State for custom restrictions
  const [isAdding, setIsAdding] = useState(false);
  const [customVal, setCustomVal] = useState("");

  const t = UI_TEXT[language];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ingredients.trim()) {
      onSearch(ingredients, "", selectedRestrictions.join(', '), servings);
    }
  };

  const toggleRestriction = (optionValue: string) => {
    setSelectedRestrictions(prev => 
      prev.includes(optionValue) 
        ? prev.filter(r => r !== optionValue)
        : [...prev, optionValue]
    );
  };

  const addCustom = () => {
    const val = customVal.trim();
    if (val) {
       if (!selectedRestrictions.includes(val)) {
          setSelectedRestrictions(prev => [...prev, val]);
       }
    }
    setCustomVal("");
    setIsAdding(false);
  };

  const renderDietaryOptions = () => (
    <div className="flex flex-wrap gap-2 justify-center">
      {DIETARY_OPTIONS.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => toggleRestriction(option.value)}
          className={`px-4 py-2 rounded-2xl text-xs font-medium transition-all duration-300 ${
            selectedRestrictions.includes(option.value)
              ? "bg-[#D97757] text-white shadow-md shadow-[#D97757]/20"
              : "bg-[#F2EFE9] text-[#6B6356] hover:bg-[#E5E0D8]"
          }`}
        >
          {option.label[language] || option.label.en}
        </button>
      ))}

      {selectedRestrictions
        .filter(r => !DIETARY_OPTIONS.some(o => o.value === r))
        .map(r => (
           <button 
             key={r} 
             type="button"
             onClick={() => toggleRestriction(r)}
             className="px-4 py-2 rounded-2xl text-xs font-medium transition-all bg-[#D97757] text-white flex items-center gap-1 shadow-md shadow-[#D97757]/20"
           >
             {r} <X size={12} />
           </button>
        ))
      }

      {isAdding ? (
         <input 
           autoFocus
           className="px-4 py-2 rounded-2xl text-xs font-medium bg-white border border-[#E5E0D8] focus:outline-none focus:border-[#D97757] min-w-[80px] text-[#4A4238]"
           value={customVal}
           onChange={e => setCustomVal(e.target.value)}
           onBlur={addCustom}
           onKeyDown={e => {
             if (e.key === 'Enter') {
               e.preventDefault();
               addCustom();
             }
           }}
           placeholder="Type..."
         />
      ) : (
         <button 
           type="button"
           onClick={() => setIsAdding(true)} 
           className="px-3 py-2 rounded-2xl border border-dashed border-[#C7C2BA] hover:border-[#D97757] hover:text-[#D97757] text-[#8C857B] transition-colors"
           title="Add custom restriction"
         >
           <Plus size={14} />
         </button>
      )}
    </div>
  );

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      <div className="bg-white rounded-[3rem] p-8 md:p-12 text-center shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border-none group transition-all duration-500 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)]">
        
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-8">
          
          {/* Consistent Squircle Icon Container */}
          <div className="bg-[#FFF4F0] w-44 h-32 rounded-[2.5rem] flex items-center justify-center gap-6 text-[#D97757] shadow-sm transition-transform group-hover:scale-105 duration-500">
             <TypeIcon size={36} strokeWidth={1.2} className="opacity-90" />
             <div className="w-px h-14 bg-[#D97757]/20"></div>
             <Utensils size={36} strokeWidth={1.2} className="opacity-90" />
          </div>

          <div className="flex flex-col gap-7 w-full">
            {/* Consistent Typography */}
            <p className="text-[#5A534A] font-serif font-medium text-xl tracking-wide group-hover:text-[#D97757] transition-colors">
              {t.textInput}
            </p>

            <div className="space-y-8">
              {/* Enhanced Textarea - Minimalist & Elegant */}
              <div className="relative">
                <textarea
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                  placeholder={t.ingredientsPlaceholder}
                  className="w-full px-0 py-2 bg-transparent border-b-2 border-[#E5E0D8] focus:border-[#D97757] outline-none resize-none h-28 text-[#4A4238] placeholder-[#D6CFC7] font-medium leading-relaxed text-center transition-all"
                  required
                />
              </div>

              {/* Refined Serving Size Selector - No underline for a cleaner aesthetic */}
              <div className="flex items-center justify-center gap-3 text-[#8C857B] transition-all hover:opacity-100">
                <span className="font-serif italic text-xl text-[#8C857B] opacity-70">{t.servings}:</span>
                <input 
                  type="text"
                  value={servings} 
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="e.g. 2"
                  className="bg-transparent border-none px-2 py-1 w-24 text-center text-[#4A4238] font-bold text-xl focus:outline-none transition-all placeholder-[#D6CFC7] font-sans focus:ring-0"
                />
              </div>

              {/* Consistent Dietary Restrictions Section */}
              <div className="pt-2 border-t border-dashed border-[#F2EFE9]">
                <p className="text-[10px] font-bold tracking-[0.2em] text-[#C7C2BA] uppercase mb-5 mt-3">
                  {t.dietaryRestrictions}
                </p>
                {renderDietaryOptions()}
              </div>

              <div className="pt-4">
                <Button 
                  variant="primary" 
                  fullWidth 
                  type="submit" 
                  disabled={isLoading || !ingredients.trim()}
                  icon={!isLoading && <Search size={18} />}
                  className="py-5 text-lg"
                >
                  {isLoading ? t.generating : t.findRecipes}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};