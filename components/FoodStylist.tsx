
import React, { useState, useRef } from 'react';
import { Camera, Upload, Wand2, Download, Share2, ArrowLeft, RefreshCcw } from 'lucide-react';
import { Button } from './Button';
import { editFoodImage } from '../services/geminiService';
import { UI_TEXT, LanguageCode } from '../constants';

interface FoodStylistProps {
  onBack: () => void;
  language: LanguageCode;
}

export const FoodStylist: React.FC<FoodStylistProps> = ({ onBack, language }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = UI_TEXT[language];

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedFile(file);
    setGeneratedImage(null);
  };

  const handleGenerate = async () => {
    if (!selectedFile || !prompt.trim()) return;
    setIsLoading(true);
    try {
      const result = await editFoodImage(selectedFile, prompt);
      setGeneratedImage(result);
    } catch (e) {
      console.error(e);
      alert("Failed to style image. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadImage = () => {
    if (generatedImage) {
      const link = document.createElement('a');
      link.href = generatedImage;
      link.download = `vibe-cooking-styled-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 hover:bg-stone-100 rounded-full text-stone-500">
          <ArrowLeft size={24} />
        </button>
        <h2 className="text-3xl font-serif font-bold text-stone-800">{t.foodStylist}</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Input Section */}
        <div className="space-y-6">
          <div 
            className={`aspect-square rounded-3xl border-2 border-dashed flex flex-col items-center justify-center relative overflow-hidden bg-stone-50 transition-colors ${!selectedFile ? 'hover:bg-orange-50 hover:border-orange-300 cursor-pointer' : 'border-stone-200'}`}
            onClick={() => !selectedFile && fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <>
                <img src={previewUrl} alt="Original" className="w-full h-full object-cover" />
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setPreviewUrl(null); }}
                  className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                >
                  <RefreshCcw size={20} />
                </button>
              </>
            ) : (
              <div className="text-center p-6">
                <div className="bg-white p-4 rounded-full shadow-sm inline-block mb-4">
                  <Camera size={32} className="text-stone-400" />
                </div>
                <p className="font-semibold text-stone-600">{t.uploadDish}</p>
                <p className="text-sm text-stone-400 mt-1">Tap to take photo or upload</p>
              </div>
            )}
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">{t.stylePrompt}</label>
              <textarea 
                className="w-full p-4 rounded-xl border border-stone-200 focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none resize-none h-32"
                placeholder={t.stylePlaceholder}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            <Button 
              fullWidth 
              onClick={handleGenerate} 
              disabled={!selectedFile || !prompt.trim() || isLoading}
              icon={isLoading ? <RefreshCcw className="animate-spin" /> : <Wand2 />}
            >
              {isLoading ? t.styling : t.generateStyle}
            </Button>
          </div>
        </div>

        {/* Result Section */}
        <div className="space-y-6">
          <div className="aspect-square rounded-3xl bg-stone-900 flex items-center justify-center relative overflow-hidden shadow-2xl">
            {generatedImage ? (
              <img src={generatedImage} alt="Styled Result" className="w-full h-full object-cover" />
            ) : (
              <div className="text-center text-stone-600">
                <Wand2 size={48} className="mx-auto mb-4 opacity-20" />
                <p className="text-stone-500">Result will appear here</p>
              </div>
            )}
          </div>

          {generatedImage && (
            <div className="flex gap-4">
              <Button variant="secondary" fullWidth onClick={downloadImage} icon={<Download size={20} />}>
                {t.download}
              </Button>
              {/* Share is usually native API, here just a placeholder button */}
              <Button variant="outline" fullWidth onClick={() => {}} icon={<Share2 size={20} />}>
                {t.share}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
