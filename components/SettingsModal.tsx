

import React, { useRef, useState, useEffect } from 'react';
import { X, Volume2, Mic, Play, Check, Loader2 } from 'lucide-react';
import { UI_TEXT, LanguageCode, VOICE_OPTIONS, ALARM_OPTIONS } from '../constants';
import { AppSettings, VoiceOption, AlarmSound } from '../types';
import { generateSpeech } from '../services/geminiService';
import { base64ToUint8Array, decodeAudioData, playAlarmSound } from '../services/audioUtils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: LanguageCode;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose, 
  language, 
  settings, 
  onUpdateSettings 
}) => {
  const t = UI_TEXT[language];
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Cleanup audio context on unmount or close
  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.error);
        audioCtxRef.current = null;
      }
    };
  }, []);

  // Removed early return !isOpen check because the parent now conditionally renders this component.
  // This ensures useEffect cleanup runs when the modal closes (unmounts).

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  };

  const playVoicePreview = async (voiceId: string) => {
    if (playingVoiceId) return; // Prevent multiple clicks
    setPlayingVoiceId(voiceId);
    
    try {
      // Short friendly greeting based on language
      const text = language === 'ja' ? 'こんにちは、美味しい料理を作りましょう。' :
                   language === 'es' ? 'Hola, cocinemos algo delicioso.' :
                   language === 'fr' ? 'Bonjour, cuisinons quelque chose de délicieux.' :
                   language.startsWith('zh') ? '你好，讓我們一起做些好吃的。' :
                   "Hello! Let's cook something delicious today.";

      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const base64Audio = await generateSpeech(text, language, voiceId);
      const audioBytes = base64ToUint8Array(base64Audio);
      const buffer = await decodeAudioData(audioBytes, ctx, 24000);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => setPlayingVoiceId(null);
      source.start();

    } catch (e) {
      console.error("Failed to play voice preview", e);
      setPlayingVoiceId(null);
    }
  };

  const playAlarmPreview = async (type: AlarmSound) => {
    try {
      const ctx = getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      playAlarmSound(ctx, type);
    } catch (e) {
      console.error("Failed to play alarm preview", e);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl relative z-10 animate-slide-up overflow-hidden border border-[#F2EFE9]">
        <div className="p-8 pb-0 flex justify-between items-center">
          <h2 className="text-2xl font-serif font-bold text-[#4A4238]">{t.settings}</h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-[#F2EFE9] rounded-full text-[#8C857B] transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          
          {/* Voice Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#D97757] font-medium">
              <Mic size={20} />
              <h3>{t.voiceLabel}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {VOICE_OPTIONS.map((option) => (
                <div 
                  key={option.id}
                  className={`flex items-center justify-between p-2 pr-4 pl-4 rounded-2xl border-2 transition-all ${
                    settings.voice === option.id 
                      ? 'border-[#D97757] bg-[#FFF4F0]' 
                      : 'border-transparent bg-[#F9F8F6]'
                  }`}
                >
                  <button
                    onClick={() => onUpdateSettings({ voice: option.id as VoiceOption })}
                    className="flex-1 text-left py-2 flex items-center justify-between"
                  >
                    <div className="flex flex-col items-start">
                      <span className={`font-bold ${settings.voice === option.id ? 'text-[#4A4238]' : 'text-[#6B6356]'}`}>
                        {option.label}
                      </span>
                      <span className="text-xs opacity-60">{option.gender}</span>
                    </div>
                    {settings.voice === option.id && (
                      <div className="bg-[#D97757] text-white p-1 rounded-full mr-2">
                        <Check size={14} />
                      </div>
                    )}
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      playVoicePreview(option.id);
                    }}
                    disabled={playingVoiceId !== null}
                    className="p-2 bg-white rounded-full text-[#D97757] shadow-sm hover:scale-105 transition-transform disabled:opacity-50"
                    title={t.preview}
                  >
                    {playingVoiceId === option.id ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Alarm Selection */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[#D97757] font-medium">
              <Volume2 size={20} />
              <h3>{t.alarmLabel}</h3>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {ALARM_OPTIONS.map((option) => (
                <div 
                  key={option.id}
                  className={`flex items-center gap-2 p-2 pr-4 rounded-2xl border-2 transition-all ${
                    settings.alarmSound === option.id 
                      ? 'border-[#D97757] bg-[#FFF4F0]' 
                      : 'border-transparent bg-[#F9F8F6]'
                  }`}
                >
                  <button
                    onClick={() => onUpdateSettings({ alarmSound: option.id as AlarmSound })}
                    className="flex-1 text-left px-2 py-2"
                  >
                    <span className={`font-bold ${settings.alarmSound === option.id ? 'text-[#4A4238]' : 'text-[#6B6356]'}`}>
                      {option.label}
                    </span>
                  </button>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      playAlarmPreview(option.id as AlarmSound);
                    }}
                    className="p-2 bg-white rounded-full text-[#D97757] shadow-sm hover:scale-105 transition-transform"
                    title={t.preview}
                  >
                    <Play size={16} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div className="p-6 bg-[#F9F8F6] text-center">
           <button 
             onClick={onClose}
             className="text-[#8C857B] font-medium text-sm hover:text-[#D97757] transition-colors"
           >
             {t.close}
           </button>
        </div>
      </div>
    </div>
  );
};