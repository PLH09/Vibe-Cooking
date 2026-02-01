import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Activity, X } from 'lucide-react';
import { LiveChefService } from '../services/liveChefService';
import { UI_TEXT, LanguageCode, VOICE_OPTIONS } from '../constants';
import { decodeAudioData, base64ToUint8Array } from '../services/audioUtils';
import { generateSpeech } from '../services/geminiService';
import { Recipe } from '../types';

interface LiveChefWidgetProps {
  language: LanguageCode;
  onActiveChange: (isActive: boolean) => void;
  recipe?: Recipe;
  activeTab?: string;
  currentStepIndex?: number;
  onNextStep: () => void;
  onPrevStep: () => void;
  onRepeat: () => void;
  onTimerStart: (duration?: number) => void;
  onTimerStop: () => void;
  voiceName: string;
}

export const LiveChefWidget: React.FC<LiveChefWidgetProps> = ({ 
  language, 
  onActiveChange, 
  recipe, 
  activeTab,
  currentStepIndex,
  onNextStep,
  onPrevStep,
  onRepeat,
  onTimerStart,
  onTimerStop,
  voiceName
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const liveService = useRef<LiveChefService | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const nextStartTime = useRef<number>(0);
  const activeSources = useRef<Set<AudioBufferSourceNode>>(new Set());
  const t = UI_TEXT[language];

  const callbacksRef = useRef({ onNextStep, onPrevStep, onRepeat, onTimerStart, onTimerStop });
  useEffect(() => {
    callbacksRef.current = { onNextStep, onPrevStep, onRepeat, onTimerStart, onTimerStop };
  }, [onNextStep, onPrevStep, onRepeat, onTimerStart, onTimerStop]);

  // If the voice setting changes while the chef is active, disconnect to prevent mixed voices
  useEffect(() => {
    if (isActive) {
      cleanupSession();
      setIsActive(false);
      onActiveChange(false);
    }
  }, [voiceName]);

  useEffect(() => {
    return () => {
      cleanupSession();
    };
  }, []);

  const cleanupSession = () => {
    activeSources.current.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    activeSources.current.clear();

    if (liveService.current) {
      liveService.current.disconnect();
      liveService.current = null;
    }
    if (audioContext.current) {
      audioContext.current.close().catch(() => {});
      audioContext.current = null;
    }
    nextStartTime.current = 0;
  };

  const getGreetingText = (lang: LanguageCode, recipeTitle?: string) => {
    const greetings: Record<LanguageCode, string> = {
      en: recipeTitle 
        ? `Hello! Chef Vibe here. Ready to cook ${recipeTitle}? How can I help you get started?`
        : "Hello! Chef Vibe here. How can I help you in the kitchen today?",
      'zh-TW': recipeTitle
        ? `您好！我是 Vibe 主廚。準備好要開始料理 ${recipeTitle} 了嗎？需要我如何協助您？`
        : "您好！我是 Vibe 主廚，今天想在廚房裡嘗試什麼新料理呢？",
      'zh-CN': recipeTitle
        ? `您好！我是 Vibe 主厨。准备好要开始料理 ${recipeTitle} 了吗？需要我如何协助您？`
        : "您好！我是 Vibe 主厨，今天想在厨房里尝试什么新料理呢？",
      ja: recipeTitle
        ? `こんにちは！シェフ・バイブです。${recipeTitle}の準備はいいですか？何をお手伝いしましょうか？`
        : "こんにちは！シェフ・バイブです。今日はどんな料理をお手伝いしましょうか？",
      es: recipeTitle
        ? `¡Hola! Soy Chef Vibe. ¿Listo para cocinar ${recipeTitle}? ¿En qué puedo ayudarte?`
        : "¡Hola! Soy Chef Vibe. ¿En qué puedo ayudarte en la cocina hoy?",
      fr: recipeTitle
        ? `Bonjour ! Je suis Chef Vibe. Prêt à cuisiner ${recipeTitle} ? Comment puis-je vous aider ?`
        : "Bonjour ! Je suis Chef Vibe. Comment puis-je vous aider en cuisine aujourd'hui ?",
    };
    return greetings[lang] || greetings.en;
  };

  const toggleSession = async () => {
    if (isActive) {
      cleanupSession();
      setIsActive(false);
      onActiveChange(false);
    } else {
      setIsConnecting(true);
      try {
        liveService.current = new LiveChefService();
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContext.current = new AudioCtx();
        nextStartTime.current = audioContext.current.currentTime;

        const currentVoiceOption = VOICE_OPTIONS.find(o => o.id === voiceName);
        const genderDescription = currentVoiceOption?.gender === 'Male' ? 'male' : 'female';

        let recipeContext = "";
        if (recipe) {
          const currentStepStr = typeof currentStepIndex === 'number' ? `The user is currently on Step ${currentStepIndex + 1}. ` : "";
          recipeContext = `The user is cooking "${recipe.title}". ${currentStepStr}
          Ingredients: ${[...recipe.ingredientsFound, ...recipe.missingIngredients].join(', ')}. 
          Steps: ${recipe.steps.map(s => `Step ${s.stepNumber}: ${s.instruction}`).join('. ')}.`;
        } else if (activeTab === 'prep') {
          recipeContext = "The user is currently in the preparation phase, checking off ingredients.";
        } else if (activeTab === 'overview') {
          recipeContext = "The user is viewing the recipe overview and cooking sequence.";
        }

        const personaInstruction = `You are Chef Vibe, a professional and encouraging ${genderDescription} chef assistant. 
        It is critical that you maintain a consistent ${genderDescription} persona throughout this session.
        ${recipeContext} Answer cooking questions concisely. Language: ${language}. 
        You can control the app navigation and timers using tools.`;

        await liveService.current.connect({
          language,
          voiceName,
          systemInstruction: personaInstruction,
          actions: {
            nextStep: () => callbacksRef.current.onNextStep(),
            previousStep: () => callbacksRef.current.onPrevStep(),
            repeatInstruction: () => callbacksRef.current.onRepeat(),
            startTimer: (d) => callbacksRef.current.onTimerStart(d),
            stopTimer: () => callbacksRef.current.onTimerStop(),
          },
          onClose: () => {
            setIsActive(false);
            onActiveChange(false);
            setIsConnecting(false);
            cleanupSession();
          },
          onAudioData: async (arrayBuffer) => {
             if (!audioContext.current || audioContext.current.state === 'closed') return;
             if (audioContext.current.state === 'suspended') await audioContext.current.resume();
             
             const buffer = await decodeAudioData(new Uint8Array(arrayBuffer), audioContext.current, 24000);
             const source = audioContext.current.createBufferSource();
             source.buffer = buffer;
             source.connect(audioContext.current.destination);
             
             const currentTime = audioContext.current.currentTime;
             if (nextStartTime.current < currentTime) nextStartTime.current = currentTime;
             
             source.start(nextStartTime.current);
             nextStartTime.current += buffer.duration;
             
             activeSources.current.add(source);
             source.onended = () => activeSources.current.delete(source);
          }
        });

        setIsActive(true);
        onActiveChange(true);

        const greetingText = getGreetingText(language, recipe?.title);
        try {
          if (audioContext.current && audioContext.current.state !== 'closed') {
            const base64Audio = await generateSpeech(greetingText, language, voiceName);
            const audioBytes = base64ToUint8Array(base64Audio);
            const buffer = await decodeAudioData(audioBytes, audioContext.current!, 24000);
            const source = audioContext.current!.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.current!.destination);
            const currentTime = audioContext.current!.currentTime;
            if (nextStartTime.current < currentTime) nextStartTime.current = currentTime;
            source.start(nextStartTime.current);
            nextStartTime.current += buffer.duration;
            activeSources.current.add(source);
            source.onended = () => activeSources.current.delete(source);
          }
        } catch (e) {}

      } catch (e) {
        setIsActive(false);
        onActiveChange(false);
      } finally {
        setIsConnecting(false);
      }
    }
  };

  return (
    <div className={`fixed bottom-10 right-10 z-[60] flex flex-col items-end gap-6`}>
      {isActive && (
        <div className="bg-[#4A4238]/95 backdrop-blur-xl text-white p-6 rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] mb-4 animate-fade-in w-72 border border-white/10 overflow-hidden">
           <div className="flex justify-between items-center mb-4">
             <div className="flex items-center gap-3 text-[#D97757] font-bold">
               <Activity size={20} className="animate-pulse" />
               <span className="truncate font-serif italic text-lg">{t.liveChef}</span>
             </div>
             <button onClick={toggleSession} className="text-white/40 hover:text-white transition-colors">
               <X size={20} />
             </button>
           </div>
           <p className="text-xs text-white/70 leading-relaxed mb-6 font-medium">
             "Listening... Try 'Next step' or 'How much salt?'"
           </p>
           <div className="flex gap-1.5 h-10 items-center justify-center">
             {[0, 1, 2, 3, 4].map(i => (
               <div key={i} className="w-1.5 bg-[#D97757] rounded-full animate-bounce" style={{ height: '70%', animationDelay: `${i * 0.15}s` }}></div>
             ))}
           </div>
        </div>
      )}

      <button
        onClick={toggleSession}
        disabled={isConnecting}
        className={`flex items-center justify-center w-20 h-20 rounded-full font-bold shadow-[0_15px_40px_-10px_rgba(0,0,0,0.15)] transition-all transform hover:scale-105 active:scale-95 border-none group ${isActive ? 'bg-[#D97757] text-white' : 'bg-white text-[#4A4238]'}`}
      >
        {isConnecting ? (
           <span className="w-8 h-8 border-3 border-[#D97757] border-t-transparent rounded-full animate-spin"></span>
        ) : isActive ? (
            <MicOff size={32} strokeWidth={1.5} />
        ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-2xl group-hover:rotate-12 transition-transform">
              👨‍🍳
            </div>
        )}
      </button>
    </div>
  );
};