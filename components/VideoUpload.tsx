import React, { useRef, useState } from 'react';
import { Camera, AlertCircle, FileVideo, Image as ImageIcon, X, Plus, Users } from 'lucide-react';
import { MAX_VIDEO_SIZE_MB, SUPPORTED_MIME_TYPES, SUPPORTED_IMAGE_MIME_TYPES, DIETARY_OPTIONS, UI_TEXT, LanguageCode } from '../constants';
import { Button } from './Button';

interface VideoUploadProps {
  onUpload: (file: File, dietaryRestrictions: string, servings?: string) => void;
  isLoading: boolean;
  language: LanguageCode;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({ onUpload, isLoading, language }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedRestrictions, setSelectedRestrictions] = useState<string[]>([]);
  const [servings, setServings] = useState("");
  
  // State for custom restrictions
  const [isAdding, setIsAdding] = useState(false);
  const [customVal, setCustomVal] = useState("");

  const t = UI_TEXT[language];

  const handleFile = (file: File) => {
    setError(null);
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
        setError("Please upload a valid video or image file.");
        return;
    }

    if (isVideo && !SUPPORTED_MIME_TYPES.includes(file.type)) {
      setError("Supported video formats: MP4, WebM, MOV.");
      return;
    }
    if (isImage && !SUPPORTED_IMAGE_MIME_TYPES.includes(file.type)) {
      setError("Supported image formats: JPG, PNG, WebP, HEIC.");
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Please keep it under ${MAX_VIDEO_SIZE_MB}MB.`);
      return;
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile, selectedRestrictions.join(', '), servings);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
          onClick={(e) => { e.stopPropagation(); toggleRestriction(option.value); }}
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
             onClick={(e) => { e.stopPropagation(); toggleRestriction(r); }}
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
           onClick={(e) => { e.stopPropagation(); }}
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
           onClick={(e) => { e.stopPropagation(); setIsAdding(true); }} 
           className="px-3 py-2 rounded-2xl border border-dashed border-[#C7C2BA] hover:border-[#D97757] hover:text-[#D97757] text-[#8C857B] transition-colors"
           title="Add custom restriction"
         >
           <Plus size={14} />
         </button>
      )}
    </div>
  );

  const getCombinedAccept = () => {
    return [...SUPPORTED_MIME_TYPES, ...SUPPORTED_IMAGE_MIME_TYPES].join(',');
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      {!selectedFile ? (
        <div 
          className={`relative border-none rounded-[3rem] p-8 md:p-12 text-center transition-all duration-500 ease-out cursor-pointer group ${
            dragActive 
              ? "bg-[#FFFBF7] shadow-[inset_0_0_40px_rgba(217,119,87,0.1)] scale-[1.02]" 
              : "bg-white shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)]"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={triggerUpload}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={getCombinedAccept()}
            className="hidden"
            onChange={handleChange}
          />
          
          <div className="flex flex-col items-center gap-8">
            <div className="bg-[#FFF4F0] w-44 h-32 rounded-[2.5rem] flex items-center justify-center gap-6 text-[#D97757] shadow-sm transition-all duration-300 group-hover:scale-105 group-active:scale-95 group-hover:shadow-md">
              <div className="flex items-center gap-6">
                <FileVideo size={36} strokeWidth={1.2} className="opacity-90" />
                <div className="w-px h-14 bg-[#D97757]/20"></div>
                <ImageIcon size={36} strokeWidth={1.2} className="opacity-90" />
              </div>
            </div>
            
            <div className="flex flex-col gap-7 w-full">
              <p className="text-[#5A534A] font-serif font-medium text-xl tracking-wide transition-colors group-hover:text-[#D97757]">
                {t.openCamera}
              </p>
              
              <div className="space-y-8">
                <div 
                  className="flex items-center justify-center gap-3 text-[#8C857B]" 
                  onClick={e => e.stopPropagation()}
                >
                  <span className="font-serif italic text-xl text-[#8C857B] opacity-70">{t.servings}:</span>
                  <input 
                    type="text"
                    value={servings} 
                    onChange={(e) => setServings(e.target.value)}
                    placeholder="e.g. 2"
                    className="bg-transparent border-none px-2 py-1 w-24 text-center text-[#4A4238] font-bold text-xl focus:outline-none transition-all placeholder-[#D6CFC7] font-sans focus:ring-0"
                  />
                </div>

                <div onClick={e => e.stopPropagation()} className="pt-2 border-t border-dashed border-[#F2EFE9]">
                  <p className="text-[10px] font-bold tracking-[0.2em] text-[#C7C2BA] uppercase mb-5 mt-3">{t.dietaryRestrictions}</p>
                  {renderDietaryOptions()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[3rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.06)] overflow-hidden border border-white relative group">
          {/* Close Button at top right */}
          <button 
            onClick={clearFile}
            className="absolute top-5 right-5 z-20 p-2.5 bg-white/90 text-[#4A4238] rounded-full hover:bg-white transition-all shadow-md hover:scale-110 active:scale-95"
            title="Remove media"
          >
            <X size={20} />
          </button>

          <div className="relative aspect-video bg-[#F2EFE9] flex items-center justify-center">
             {selectedFile.type.startsWith('video/') ? (
                <video src={previewUrl!} controls className="w-full h-full object-cover" />
             ) : (
                <img src={previewUrl!} alt="Preview" className="w-full h-full object-cover" />
             )}
          </div>

          <div className="p-10 space-y-8">
             <div className="flex items-center gap-4">
               <div className="bg-[#FFF4F0] p-4 rounded-2xl text-[#D97757] shadow-sm">
                 {selectedFile.type.startsWith('video/') ? <FileVideo size={28} strokeWidth={1.5} /> : <ImageIcon size={28} strokeWidth={1.5} />}
               </div>
               <div className="flex-1 min-w-0">
                 <p className="font-serif font-bold text-xl text-[#4A4238] truncate">{selectedFile.name}</p>
                 <p className="text-sm font-medium text-[#8C857B] opacity-70">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
               </div>
             </div>

             {/* Refined Servings Row - Clean, border-less input as requested */}
             <div className="flex items-center justify-between py-6 border-y border-dashed border-[#F2EFE9]">
                <div className="flex items-center gap-2">
                   <Users size={18} className="text-[#D97757]/60" />
                   <span className="font-serif italic text-xl text-[#8C857B]">{t.servings}:</span>
                </div>
                <input 
                  type="text"
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="Auto"
                  className="bg-transparent border-none px-2 w-32 text-right text-[#4A4238] font-bold text-xl focus:outline-none transition-all placeholder-[#D6CFC7] focus:ring-0"
                />
             </div>
             
             <div className="space-y-4">
               <p className="text-[10px] font-bold tracking-[0.2em] text-[#C7C2BA] uppercase text-center">{t.dietaryRestrictions}</p>
               {renderDietaryOptions()}
             </div>

             <div className="pt-4">
               <Button 
                 fullWidth 
                 onClick={handleSubmit}
                 disabled={isLoading}
                 className="py-5 text-lg"
               >
                 {isLoading ? t.analyzing : t.findRecipes}
               </Button>
             </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 flex items-center justify-center gap-2 p-4 text-[#C06042] bg-[#FFF4F0] rounded-2xl border border-[#FADCD5] animate-shake">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
};