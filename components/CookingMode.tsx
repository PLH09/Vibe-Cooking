import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Recipe, AlarmSound } from '../types';
import { Button } from './Button';
import { Play, Pause, RotateCcw, Volume2, VolumeX, CheckCircle, ChevronRight, ChevronLeft, ArrowLeft, ShoppingBasket, CheckSquare, Square, Repeat, Clock, Heart, Users, RefreshCcw, AlertCircle, Lightbulb, ChevronDown, ListOrdered, Calendar, X, Star, Plus, Minus, Timer } from 'lucide-react';
import { UI_TEXT, LanguageCode } from '../constants';
import { generateSpeech, updateRecipeServings } from '../services/geminiService';
import { LiveChefWidget } from './LiveChefWidget';
import { base64ToUint8Array, decodeAudioData, playAlarmSound } from '../services/audioUtils';

interface CookingModeProps {
  recipes: Recipe[];
  onExit: () => void;
  onToggleSave: (recipe: Recipe) => void;
  savedRecipeIds: string[];
  language: LanguageCode;
  alarmSound: AlarmSound;
  voiceName: string;
}

type IngredientState = 'unchecked' | 'checked' | 'missing';
type Tab = 'overview' | 'prep' | string; // 'overview', 'prep' or recipeId

export const CookingMode: React.FC<CookingModeProps> = ({ recipes, onExit, onToggleSave, savedRecipeIds, language, alarmSound, voiceName }) => {
  const t = UI_TEXT[language];

  // Logic to determine priority order
  const sortedRecipes = useMemo(() => {
    return [...recipes].sort((a, b) => {
       const diffScore = (r: Recipe) => r.difficulty === 'Hard' ? 3 : r.difficulty === 'Medium' ? 2 : 1;
       if (b.prepTimeMinutes !== a.prepTimeMinutes) {
         return b.prepTimeMinutes - a.prepTimeMinutes;
       }
       return diffScore(b) - diffScore(a);
    });
  }, [recipes]);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  
  const [recipeStates, setRecipeStates] = useState<Record<string, {
    stepIndex: number;
    timeLeft: number;
    isTimerRunning: boolean;
    isRinging: boolean;
    localRecipe: Recipe;
    localServings: string;
    isUpdating: boolean;
    isCompleted: boolean;
  }>>(() => {
    const initial: any = {};
    recipes.forEach(r => {
      initial[r.id] = {
        stepIndex: 0,
        timeLeft: r.steps[0]?.durationSeconds || 0,
        isTimerRunning: false,
        isRinging: false,
        localRecipe: r,
        localServings: r.servings || "",
        isUpdating: false,
        isCompleted: false
      };
    });
    return initial;
  });

  useEffect(() => {
    setRecipeStates(prev => {
      const next = { ...prev };
      let hasChanges = false;
      recipes.forEach(r => {
        if (!next[r.id]) {
          next[r.id] = {
            stepIndex: 0,
            timeLeft: r.steps[0]?.durationSeconds || 0,
            isTimerRunning: false,
            isRinging: false,
            localRecipe: r,
            localServings: r.servings || "",
            isUpdating: false,
            isCompleted: false
          };
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [recipes]);

  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ingredientStates, setIngredientStates] = useState<Record<string, IngredientState>>({});
  const [isLiveChefActive, setIsLiveChefActive] = useState(false);
  const [quotaLimitReached, setQuotaLimitReached] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [isTipOpen, setIsTipOpen] = useState(false);
  
  const audioCache = useRef<Map<string, AudioBuffer>>(new Map());
  const currentSource = useRef<AudioBufferSourceNode | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const isMutedRef = useRef(isMuted);
  const speakRequestId = useRef(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  
  const activeRecipeState = (activeTab !== 'prep' && activeTab !== 'overview') ? recipeStates[activeTab] : null;
  const activeRecipe = activeRecipeState?.localRecipe;
  const currentStep = activeRecipe ? activeRecipe.steps[activeRecipeState!.stepIndex] : null;

  useEffect(() => {
    const newStates: Record<string, IngredientState> = {};
    recipes.forEach(r => {
      [...r.ingredientsFound, ...r.missingIngredients].forEach(ing => {
        const key = `${r.id}-${ing}`;
        if (!ingredientStates[key]) newStates[key] = 'unchecked';
      });
    });
    setIngredientStates(prev => ({ ...prev, ...newStates }));
  }, [recipes.length]);

  useEffect(() => {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    audioContext.current = new AudioCtx(); 
    return () => {
      stopAudio();
      audioContext.current?.close();
    };
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // If Live Chef becomes active, stop any standard TTS
  useEffect(() => {
    if (isLiveChefActive) {
      stopAudio();
    }
  }, [isLiveChefActive]);

  const stopAudio = () => {
    if (currentSource.current) {
        try { currentSource.current.stop(); } catch (e) {}
        currentSource.current = null;
    }
    setIsSpeaking(false);
  };

  const playAlarm = () => {
    if (isMutedRef.current || !audioContext.current) return;
    if (audioContext.current.state === 'suspended') {
      audioContext.current.resume().then(() => {
         if (audioContext.current) playAlarmSound(audioContext.current, alarmSound);
      }).catch(e => console.error("Could not resume audio context", e));
    } else {
      playAlarmSound(audioContext.current, alarmSound);
    }
  };

  const isAnyRecipeRinging = useMemo(() => 
    Object.values(recipeStates).some((s: any) => s.isRinging), 
  [recipeStates]);

  useEffect(() => {
    if (!isAnyRecipeRinging) return;
    const interval = window.setInterval(() => {
      if (!isMutedRef.current) playAlarm();
    }, 2500);
    return () => clearInterval(interval);
  }, [isAnyRecipeRinging, alarmSound]);

  useEffect(() => {
    timerIntervalRef.current = window.setInterval(() => {
      setRecipeStates(prev => {
        const next = { ...prev };
        let hasChanges = false;
        let alarmTriggered = false;
        
        Object.keys(next).forEach(recipeId => {
          if (next[recipeId].isTimerRunning) {
            if (next[recipeId].timeLeft > 0) {
              next[recipeId] = { ...next[recipeId], timeLeft: next[recipeId].timeLeft - 1 };
              hasChanges = true;
            } else {
              next[recipeId] = { ...next[recipeId], isTimerRunning: false, isRinging: true };
              hasChanges = true;
              alarmTriggered = true;
            }
          }
        });

        if (alarmTriggered && !isMutedRef.current) {
           setTimeout(() => playAlarm(), 0);
        }
        return hasChanges ? next : prev;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) window.clearInterval(timerIntervalRef.current);
    };
  }, [alarmSound]);

  useEffect(() => {
    stopAudio();
    if (activeTab === 'prep' || activeTab === 'overview' || !currentStep || activeRecipeState?.isCompleted) {
      return;
    }
    speakRequestId.current += 1;
    setIsTipOpen(false);
  }, [activeRecipeState?.stepIndex, activeTab]);

  const updateRecipeState = (recipeId: string, updates: Partial<typeof recipeStates[string]>) => {
    setRecipeStates(prev => ({
      ...prev,
      [recipeId]: { ...prev[recipeId], ...updates }
    }));
  };

  const speak = async (text: string) => {
    if (quotaLimitReached || isLiveChefActive || isMutedRef.current || !audioContext.current) return;
    
    const requestId = ++speakRequestId.current;

    if (audioContext.current.state === 'suspended') {
       try { await audioContext.current.resume(); } catch (e) {}
    }

    stopAudio();
    setIsSpeaking(true);
    playPing();

    try {
      let buffer = audioCache.current.get(text);
      if (!buffer) {
         const base64Audio = await generateSpeech(text, language, voiceName);
         if (requestId !== speakRequestId.current || isMutedRef.current || isLiveChefActive) {
             setIsSpeaking(false);
             return;
         }
         const audioBytes = base64ToUint8Array(base64Audio);
         buffer = await decodeAudioData(audioBytes, audioContext.current, 24000);
         audioCache.current.set(text, buffer);
      }

      if (requestId !== speakRequestId.current || isMutedRef.current || isLiveChefActive) {
          setIsSpeaking(false);
          return;
      }

      const source = audioContext.current.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 0.95;
      source.connect(audioContext.current.destination);
      source.onended = () => {
          if (requestId === speakRequestId.current) {
              setIsSpeaking(false);
          }
      };
      source.start();
      currentSource.current = source;
    } catch (e: any) {
      setIsSpeaking(false);
      const errString = typeof e === 'object' ? (e.message || JSON.stringify(e)) : String(e);
      if (errString.includes('RATE_LIMIT_EXCEEDED') || errString.includes('429')) {
        if (!quotaLimitReached) {
          setQuotaLimitReached(true);
          setIsMuted(true);
        }
      }
    }
  };

  const playPing = () => {
    if (isMutedRef.current || !audioContext.current) return;
    const ctx = audioContext.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = 600;
    gainNode.gain.value = 0.05;
    oscillator.start();
    setTimeout(() => gainNode.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.1), 50);
    setTimeout(() => oscillator.stop(), 200);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleIngredientState = (recipeId: string, ing: string) => {
    const key = `${recipeId}-${ing}`;
    setIngredientStates(prev => {
      const current = prev[key] || 'unchecked';
      const next: IngredientState = current === 'checked' ? 'unchecked' : 'checked';
      return { ...prev, [key]: next };
    });
  };

  const handleUpdateServings = async (recipeId: string) => {
    const state = recipeStates[recipeId];
    if (!state.localServings.trim() || state.localServings === state.localRecipe.servings) return;
    
    updateRecipeState(recipeId, { isUpdating: true });
    try {
      const updatedRecipe = await updateRecipeServings(state.localRecipe, state.localServings, language);
      updateRecipeState(recipeId, { localRecipe: updatedRecipe });
    } catch (e) {
      console.error(e);
    } finally {
      updateRecipeState(recipeId, { isUpdating: false });
    }
  };

  const handleNextStep = () => {
    if (!activeRecipe || !activeRecipeState) return;
    if (activeRecipeState.isRinging) {
        updateRecipeState(activeRecipe.id, { isRinging: false });
    }

    if (activeRecipeState.stepIndex < activeRecipe.steps.length - 1) {
      const nextIndex = activeRecipeState.stepIndex + 1;
      updateRecipeState(activeRecipe.id, {
         stepIndex: nextIndex,
         timeLeft: activeRecipe.steps[nextIndex].durationSeconds || 0,
         isTimerRunning: false,
         isRinging: false
      });
    } else {
      updateRecipeState(activeRecipe.id, { isCompleted: true, isTimerRunning: false, isRinging: false });
      const allDone = recipes.every(r => (r.id === activeRecipe.id ? true : recipeStates[r.id]?.isCompleted));
      if (allDone) {
         setShowCelebration(true);
      }
    }
  };

  const handlePrevStep = () => {
    if (!activeRecipe || !activeRecipeState) return;
    if (activeRecipeState.isRinging) {
        updateRecipeState(activeRecipe.id, { isRinging: false });
    }
    if (activeRecipeState.stepIndex > 0) {
      const prevIndex = activeRecipeState.stepIndex - 1;
      updateRecipeState(activeRecipe.id, {
         stepIndex: prevIndex,
         timeLeft: activeRecipe.steps[prevIndex].durationSeconds || 0,
         isTimerRunning: false,
         isRinging: false,
         isCompleted: false
      });
    }
  };

  const toggleTimer = (recipeId: string) => {
    if (audioContext.current && audioContext.current.state === 'suspended') {
      audioContext.current.resume();
    }
    const currentState = recipeStates[recipeId];
    if (currentState.isRinging) {
        updateRecipeState(recipeId, { isRinging: false });
        return;
    }
    updateRecipeState(recipeId, { isTimerRunning: !currentState.isTimerRunning });
  };

  const handleAdjustTime = (recipeId: string, seconds: number) => {
    if (audioContext.current && audioContext.current.state === 'suspended') {
      audioContext.current.resume();
    }
    const currentState = recipeStates[recipeId];
    if (currentState.isTimerRunning) return;
    const newTime = Math.max(0, currentState.timeLeft + seconds);
    updateRecipeState(recipeId, { timeLeft: newTime, isRinging: false });
  };

  const handleVoiceRepeat = () => {
    if (activeRecipe && activeRecipeState && currentStep && !activeRecipeState.isCompleted) {
      speak(currentStep.instruction);
    }
  };

  const handleVoiceTimerStart = (duration?: number) => {
    if (activeRecipe && activeRecipeState && !activeRecipeState.isCompleted) {
      if (audioContext.current && audioContext.current.state === 'suspended') {
         audioContext.current.resume();
      }
      updateRecipeState(activeRecipe.id, {
        isTimerRunning: true,
        timeLeft: duration ? duration : activeRecipeState.timeLeft,
        isRinging: false
      });
    }
  };

  const handleVoiceTimerStop = () => {
    if (activeRecipe) {
      updateRecipeState(activeRecipe.id, { isTimerRunning: false, isRinging: false });
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null;
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    if (distance > minSwipeDistance) handleNextStep();
    else if (distance < -minSwipeDistance) handlePrevStep();
  };

  if (showCelebration) {
    return (
      <div className="max-w-3xl mx-auto h-[85vh] flex flex-col items-center justify-center animate-fade-in text-center p-8 bg-white/80 backdrop-blur-md rounded-[3rem] shadow-xl relative overflow-hidden border border-white">
        <div className="absolute inset-0 bg-gradient-to-br from-[#F2EFE9] to-white z-0"></div>
        <div className="z-10 space-y-10">
           <div className="text-8xl animate-bounce-slow">🍽️</div>
           <h2 className="text-5xl md:text-6xl font-serif font-medium text-[#4A4238] tracking-tight">Bon Appétit!</h2>
           <p className="text-[#8C857B] text-xl">All dishes are ready.</p>
           <Button onClick={onExit} variant="primary" className="px-12 py-5 text-lg mt-8 rounded-full">
             {t.exitMode}
           </Button>
        </div>
      </div>
    );
  }

  const maxPrepTime = Math.max(...recipes.map(r => r.prepTimeMinutes));

  return (
    <div className="max-w-5xl mx-auto h-[85vh] flex flex-col relative pb-4">
      
      {/* Top Bar with Tabs - Clean aesthetic as requested */}
      <div className="flex flex-col gap-5 mb-2">
        <div className="flex items-center justify-between px-2">
           <button onClick={onExit} className="p-3 hover:bg-white rounded-full text-[#8C857B] transition-colors">
              <ArrowLeft size={24} />
           </button>
        </div>

        {/* Scrollable Tabs - Matching Screenshot 4 Aesthetics */}
        <div className="flex gap-3 overflow-x-auto pb-4 px-2 hide-scrollbar">
           <button
             onClick={() => setActiveTab('overview')}
             className={`px-6 py-3 rounded-full text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 shadow-sm ${activeTab === 'overview' ? 'bg-[#4A4238] text-[#F9F8F6]' : 'bg-white text-[#8C857B]'}`}
           >
             <ListOrdered size={16} />
             {t.overview}
           </button>

           <button
             onClick={() => setActiveTab('prep')}
             className={`px-6 py-3 rounded-full text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 shadow-sm ${activeTab === 'prep' ? 'bg-[#4A4238] text-[#F9F8F6]' : 'bg-white text-[#8C857B]'}`}
           >
             <ShoppingBasket size={16} /> {t.prepTitle}
           </button>

           {recipes.map((r) => {
             const isCompleted = recipeStates[r.id]?.isCompleted;
             return (
               <button
                 key={r.id}
                 onClick={() => setActiveTab(r.id)}
                 className={`px-6 py-3 rounded-full text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 shadow-sm ${activeTab === r.id ? 'bg-[#D97757] text-white' : 'bg-white text-[#8C857B]'}`}
               >
                 <span>{r.title}</span>
                 {isCompleted && <CheckCircle size={14} className="text-white fill-white/20" />}
               </button>
             );
           })}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'overview' ? (
        <div className="flex-1 flex flex-col bg-white rounded-[3rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.03)] p-12 border border-white relative overflow-hidden animate-fade-in custom-scrollbar overflow-y-auto">
            <div className="text-center mb-16">
               <h3 className="text-4xl font-serif font-medium text-[#4A4238] mb-4 opacity-80 tracking-tight">{t.chefsPlan}</h3>
               <p className="text-[#8C857B] text-lg opacity-70">{t.chefsPlanSubtitle}</p>
            </div>

            {/* Timeline / Order - Refined as per Screenshot 4 */}
            <div className="max-w-3xl mx-auto w-full space-y-0 relative">
               {sortedRecipes.map((recipe, index) => {
                  const isDone = recipeStates[recipe.id]?.isCompleted;
                  return (
                    <div key={recipe.id} className="relative flex items-center gap-8 py-8 px-8 group transition-all">
                       
                       {/* Vertical Connector Line */}
                       {index !== sortedRecipes.length - 1 && (
                          <div className="absolute left-[calc(2rem+24px)] top-[calc(50%+24px)] h-full w-px bg-[#EAE6DF] z-0"></div>
                       )}

                       <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-serif font-bold text-xl transition-all shadow-sm ${isDone ? 'bg-[#8FA893] text-white' : 'bg-[#EAE6DF]/40 text-[#D97757]'}`}>
                          {index + 1}
                       </div>
                       
                       <div className="flex-1 flex items-center justify-between border-b border-[#F9F8F6] pb-8">
                          <div className="space-y-1">
                             <h4 className={`font-serif font-medium text-2xl tracking-tight transition-all ${isDone ? 'text-[#8C857B] line-through opacity-50' : 'text-[#4A4238]'}`}>{recipe.title}</h4>
                             <div className="flex items-center gap-3">
                                <span className="px-3 py-1 bg-[#E3F2E6] text-[#5A8C66] text-[10px] font-bold uppercase tracking-widest rounded-md">{recipe.difficulty}</span>
                                <span className="text-sm text-[#8C857B] italic opacity-60">•</span>
                                <span className="text-sm text-[#8C857B] font-medium opacity-60">
                                  {index === 0 ? t.startWith : index === sortedRecipes.length - 1 ? t.finally : t.then}
                                </span>
                             </div>
                          </div>
                          <div className="bg-[#F9F8F6] px-4 py-1.5 rounded-full text-xs font-bold text-[#8C857B] tracking-wide">
                             {recipe.prepTimeMinutes}m
                          </div>
                       </div>
                    </div>
                  );
               })}
               <div className="flex justify-end pt-8 pr-8 text-[#8C857B] text-sm font-bold uppercase tracking-widest opacity-40">
                  {t.totalTime}: ~{maxPrepTime} mins
               </div>
            </div>

            <div className="mt-20 max-w-xl mx-auto w-full">
               <Button 
                 fullWidth 
                 onClick={() => setActiveTab('prep')} 
                 className="py-6 text-xl !bg-[#D97757]/80 italic font-serif shadow-xl shadow-[#D97757]/20"
                 icon={<Play size={20} fill="currentColor" />}
               >
                  {t.prepTitle}
               </Button>
            </div>
        </div>
      ) : activeTab === 'prep' ? (
        <div className="flex-1 flex flex-col bg-white rounded-[3rem] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.03)] p-12 border border-white relative overflow-hidden animate-fade-in">
           <div className="text-center mb-10 flex-shrink-0">
              <h3 className="text-3xl font-serif font-medium text-[#4A4238] mb-2">{t.prepTitle}</h3>
              <p className="text-[#8C857B] opacity-70">{t.prepSubtitle}</p>
           </div>
           
           <div className="flex-1 overflow-y-auto space-y-10 px-4 custom-scrollbar">
              {recipes.map(recipe => (
                 <div key={recipe.id} className="space-y-4">
                    <div className="flex items-center justify-between border-b border-[#F9F8F6] pb-4">
                       <h4 className="font-serif font-medium text-xl text-[#4A4238]">{recipe.title}</h4>
                       <div className="flex items-center gap-2 bg-[#F9F8F6] px-4 py-2 rounded-2xl">
                          <Users size={16} className="text-[#D97757]/60" />
                          <input 
                            className="w-10 text-center bg-transparent font-bold focus:outline-none text-[#4A4238]"
                            value={recipeStates[recipe.id].localServings}
                            onChange={(e) => updateRecipeState(recipe.id, { localServings: e.target.value })}
                            onBlur={() => handleUpdateServings(recipe.id)}
                          />
                          {recipeStates[recipe.id].isUpdating && <RefreshCcw size={12} className="animate-spin text-[#D97757]" />}
                       </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                       {[...recipeStates[recipe.id].localRecipe.ingredientsFound, ...recipeStates[recipe.id].localRecipe.missingIngredients].map((ing, i) => {
                          const state = ingredientStates[`${recipe.id}-${ing}`] || 'unchecked';
                          return (
                            <button 
                              key={i}
                              onClick={() => toggleIngredientState(recipe.id, ing)}
                              className={`flex items-center gap-4 p-4 rounded-[1.5rem] transition-all text-left ${state === 'checked' ? 'bg-[#F2F9F4] opacity-50' : 'bg-white border border-[#F9F8F6] hover:border-[#D97757]/20 shadow-sm'}`}
                            >
                              {state === 'checked' ? <CheckSquare size={20} className="text-[#8FA893]" /> : <Square size={20} className="text-[#C7C2BA]" />}
                              <span className={`text-base ${state === 'checked' ? 'line-through' : 'text-[#4A4238]'}`}>{ing}</span>
                            </button>
                          );
                       })}
                    </div>
                 </div>
              ))}
           </div>
           
           <div className="mt-10 pt-6 border-t border-[#F9F8F6] max-w-xl mx-auto w-full">
             <Button fullWidth onClick={() => setActiveTab(sortedRecipes[0].id)} className="py-5" icon={<Play size={18} fill="currentColor" />}>
                {t.startCooking} {sortedRecipes[0].title}
             </Button>
          </div>
        </div>
      ) : activeRecipe ? (
        <div className="flex-1 flex flex-col items-center justify-center relative">
            {activeRecipeState?.isCompleted ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-[3rem] shadow-xl border border-white animate-fade-in p-12 text-center space-y-8">
                 <div className="w-24 h-24 bg-[#E3F2E6] rounded-full flex items-center justify-center text-[#8FA893] mb-4">
                    <CheckCircle size={56} />
                 </div>
                 <h3 className="text-4xl font-serif font-medium text-[#4A4238] tracking-tight">{activeRecipe.title} Completed!</h3>
                 <div className="max-w-md w-full">
                   {(() => {
                      const currentIndex = sortedRecipes.findIndex(r => r.id === activeRecipe.id);
                      const nextRecipe = sortedRecipes[currentIndex + 1];
                      if (nextRecipe && !recipeStates[nextRecipe.id]?.isCompleted) {
                         return (
                           <div className="space-y-4">
                             <p className="text-[#8C857B] mb-6">Next in your plan:</p>
                             <Button onClick={() => setActiveTab(nextRecipe.id)} variant="primary" fullWidth className="py-5" icon={<Play size={20} fill="currentColor" />}>
                                Start {nextRecipe.title}
                             </Button>
                           </div>
                         );
                      }
                      return <Button onClick={() => setActiveTab('overview')} variant="secondary" fullWidth className="py-5">{t.overview}</Button>;
                   })()}
                 </div>
              </div>
            ) : currentStep ? (
              <>
                <div className="absolute top-6 left-0 right-0 z-30 flex justify-center">
                   <div className="bg-[#EAE6DF]/80 backdrop-blur-md px-6 py-2 rounded-full text-[10px] font-bold tracking-[0.2em] text-[#8C857B] uppercase shadow-sm border border-white">
                       Step {currentStep.stepNumber} / {activeRecipe.steps.length}
                   </div>
                </div>

                <div className="w-full h-full flex flex-col animate-slide-up bg-white rounded-[3rem] shadow-xl border border-white relative overflow-hidden">
                    <div className="flex-1 relative w-full h-full flex items-center" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
                      {activeRecipe.steps.map((step, index) => {
                         if (Math.abs(index - activeRecipeState!.stepIndex) > 1) return null;
                         const isActive = index === activeRecipeState!.stepIndex;
                         const stepDisplayTime = isActive ? activeRecipeState!.timeLeft : step.durationSeconds;
                         const isRunning = isActive ? activeRecipeState!.isTimerRunning : false;
                         const isRinging = isActive ? activeRecipeState!.isRinging : false;
                         
                         let posClass = index === activeRecipeState!.stepIndex ? "translate-x-0 opacity-100" : (index < activeRecipeState!.stepIndex ? "-translate-x-full opacity-0" : "translate-x-full opacity-0");

                         return (
                            <div key={index} className={`absolute inset-0 w-full h-full transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col md:flex-row items-center justify-center pt-24 pb-32 px-10 gap-12 ${posClass}`}>
                                <div className="flex-1 max-w-xl text-center md:text-left space-y-6">
                                   <h3 className="text-3xl font-serif font-medium text-[#4A4238] leading-relaxed italic opacity-90">{step.instruction}</h3>
                                   {isSpeaking && isActive && (
                                        <div className="flex gap-1.5 h-4 items-end justify-center md:justify-start">
                                            {[0, 1, 2].map(i => <div key={i} className="w-1 bg-[#D97757] rounded-full animate-bounce" style={{ height: '100%', animationDelay: `${i*0.1}s` }}></div>)}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-shrink-0 min-w-[300px]">
                                     <div className={`p-10 rounded-[3rem] border transition-all duration-500 ${isRinging ? 'bg-[#FFF4F0] border-[#D97757] animate-pulse' : isRunning ? 'bg-[#FFF4F0] border-[#D97757]/30' : 'bg-[#F9F8F6] border-[#EAE6DF]'}`}>
                                        <div className="text-[10px] font-bold tracking-[0.2em] text-[#C7C2BA] uppercase text-center mb-4">
                                            {t.timer}
                                        </div>
                                        <div className="text-center mb-6">
                                          <div className="flex items-center justify-center gap-4">
                                            <button 
                                              onClick={() => handleAdjustTime(activeRecipe.id, -60)} 
                                              className="p-2 text-[#C7C2BA] hover:text-[#D97757] transition-colors disabled:opacity-20"
                                              disabled={isRunning || isRinging}
                                            >
                                              <Minus size={24} />
                                            </button>
                                            <span className="text-7xl font-medium tracking-tighter tabular-nums text-[#4A4238]">{formatTime(stepDisplayTime)}</span>
                                            <button 
                                              onClick={() => handleAdjustTime(activeRecipe.id, 60)} 
                                              className="p-2 text-[#C7C2BA] hover:text-[#D97757] transition-colors disabled:opacity-20"
                                              disabled={isRunning || isRinging}
                                            >
                                              <Plus size={24} />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-center gap-6">
                                            <button onClick={() => updateRecipeState(activeRecipe.id, { isTimerRunning: false, isRinging: false, timeLeft: step.durationSeconds })} className="p-4 bg-white rounded-full shadow-sm text-[#8C857B] hover:text-[#D97757] transition-all"><RotateCcw size={20} /></button>
                                            <button onClick={() => toggleTimer(activeRecipe.id)} className={`w-20 h-20 rounded-full flex items-center justify-center text-white shadow-xl transition-all ${isRunning || isRinging ? 'bg-[#D9A357]' : 'bg-[#D97757]'}`}>
                                                {isRinging ? <Square size={28} fill="currentColor" /> : isRunning ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                                            </button>
                                        </div>
                                     </div>
                                </div>
                            </div>
                         );
                      })}
                    </div>
                    <div className="absolute bottom-28 left-0 right-0 px-10 flex justify-between items-center z-30">
                       {currentStep.tip && (
                          <div className="relative group">
                            {isTipOpen && <div className="absolute bottom-full left-0 mb-4 w-72 bg-[#FFF8E1] p-6 rounded-[2rem] shadow-xl border border-[#F5E6B5] animate-slide-up text-left text-sm italic font-serif text-[#7A602C]">"{currentStep.tip}"</div>}
                            <button onClick={() => setIsTipOpen(!isTipOpen)} className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${isTipOpen ? 'bg-[#FFF8E1] text-[#F59E0B]' : 'bg-white text-[#8C857B]'}`}><Lightbulb size={24} /></button>
                          </div>
                       )}
                    </div>
                    <div className="p-8 px-12 bg-white border-t border-[#F9F8F6] flex items-center justify-between z-30">
                        <button onClick={handlePrevStep} disabled={activeRecipeState!.stepIndex === 0} className="text-[#8C857B] font-bold text-sm tracking-widest uppercase disabled:opacity-20 hover:text-[#D97757] transition-all">← {t.previous}</button>
                        <div className="flex gap-2">
                           {activeRecipe.steps.map((_, i) => <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === activeRecipeState!.stepIndex ? 'bg-[#D97757] w-6' : 'bg-[#EAE6DF]'}`}></div>)}
                        </div>
                        <button onClick={handleNextStep} className="text-[#D97757] font-bold text-sm tracking-widest uppercase hover:text-[#C06042] transition-all">{activeRecipeState!.stepIndex === activeRecipe.steps.length - 1 ? t.finishCooking : t.nextStep} →</button>
                    </div>
                </div>
              </>
            ) : null}
        </div>
      ) : null}

      <LiveChefWidget 
        language={language} 
        onActiveChange={setIsLiveChefActive} 
        recipe={activeRecipe}
        activeTab={activeTab}
        currentStepIndex={activeRecipeState?.stepIndex}
        onNextStep={handleNextStep}
        onPrevStep={handlePrevStep}
        onRepeat={handleVoiceRepeat}
        onTimerStart={handleVoiceTimerStart}
        onTimerStop={handleVoiceTimerStop}
        voiceName={voiceName}
      />
    </div>
  );
};