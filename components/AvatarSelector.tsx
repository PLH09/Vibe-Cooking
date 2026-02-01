
import React from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Avatar } from '../types';
import { AVATARS, UI_TEXT, LanguageCode } from '../constants';
import { Button } from './Button';

interface AvatarSelectorProps {
  currentAvatar: Avatar;
  onSelect: (avatar: Avatar) => void;
  onBack: () => void;
  language: LanguageCode;
}

export const AvatarSelector: React.FC<AvatarSelectorProps> = ({ 
  currentAvatar, 
  onSelect, 
  onBack, 
  language 
}) => {
  const t = UI_TEXT[language];

  return (
    <div className="w-full max-w-4xl mx-auto animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full text-stone-500 transition-colors">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-3xl font-serif font-bold text-stone-800">{t.chooseAvatar}</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {AVATARS.map((avatar) => {
          const isSelected = currentAvatar.id === avatar.id;
          return (
            <div 
              key={avatar.id}
              onClick={() => onSelect(avatar)}
              className={`relative cursor-pointer rounded-3xl p-6 border-2 transition-all duration-300 transform hover:scale-105 ${
                isSelected 
                  ? 'border-orange-500 bg-orange-50 shadow-lg' 
                  : 'border-stone-100 bg-white hover:border-orange-200 hover:shadow-md'
              }`}
            >
              {isSelected && (
                <div className="absolute top-4 right-4 bg-orange-500 text-white p-1 rounded-full shadow-sm">
                  <Check size={16} />
                </div>
              )}

              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-inner ${avatar.color}`}>
                  {avatar.emoji}
                </div>
                
                <div>
                  <h3 className={`font-serif font-bold text-lg ${isSelected ? 'text-orange-800' : 'text-stone-800'}`}>
                    {avatar.name[language] || avatar.name.en}
                  </h3>
                  {isSelected && (
                     <span className="text-xs text-orange-600 font-medium px-2 py-1 bg-white rounded-full mt-2 inline-block shadow-sm">
                       Selected
                     </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
