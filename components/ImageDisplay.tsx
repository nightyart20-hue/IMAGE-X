import React, { useState, useEffect } from 'react';
import { Download, Maximize2, RefreshCw, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Button } from './Button';
import { GeneratedImage } from '../types';

interface ImageDisplayProps {
  images: GeneratedImage[];
  isLoading: boolean;
  prompt: string;
  onDownload: (url: string) => void;
  onRegenerate: () => void;
}

export const ImageDisplay: React.FC<ImageDisplayProps> = ({ 
  images, 
  isLoading, 
  prompt, 
  onDownload,
  onRegenerate
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when new images arrive
  useEffect(() => {
    if (images.length > 0) {
      setSelectedIndex(0);
    }
  }, [images]);

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl glass-panel flex flex-col items-center justify-center p-8 animate-pulse">
        <div className="w-16 h-16 border-4 border-zinc-700 border-t-white rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-400 text-sm font-medium">Generating your masterpieces...</p>
        <p className="text-zinc-600 text-xs mt-2 text-center max-w-[80%]">Optimizing prompt & creating images...</p>
      </div>
    );
  }

  if (!images || images.length === 0) {
    return (
      <div className="w-full h-full min-h-[400px] rounded-xl border-2 border-dashed border-zinc-800 flex flex-col items-center justify-center p-8 text-center bg-zinc-900/50">
        <div className="w-16 h-16 bg-zinc-800 rounded-full flex items-center justify-center mb-4 text-zinc-500">
            <Maximize2 size={24} />
        </div>
        <h3 className="text-zinc-300 font-medium mb-1">No images generated yet</h3>
        <p className="text-zinc-500 text-sm">Configure your settings and click Generate.</p>
      </div>
    );
  }

  const currentImage = images[selectedIndex];
  const metadata = currentImage.metadata;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Main Display */}
      <div className="group relative w-full flex-grow rounded-xl overflow-hidden glass-panel shadow-2xl transition-all duration-300 bg-black/50 flex items-center justify-center">
        <img 
          src={currentImage.url} 
          alt={`Result ${selectedIndex + 1}`} 
          className="max-h-[600px] w-auto max-w-full object-contain transition-transform duration-700 group-hover:scale-105" 
        />
        
        {/* Quality Badge (Top Left) */}
        {metadata && (
          <div className="absolute top-4 left-4 z-10 flex gap-2">
             <div className={`px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-2 text-xs font-medium shadow-lg border ${metadata.passedQualityCheck ? 'bg-green-500/20 border-green-500/30 text-green-200' : 'bg-amber-500/20 border-amber-500/30 text-amber-200'}`}>
                {metadata.passedQualityCheck ? <ShieldCheck size={14} /> : <AlertTriangle size={14} />}
                <span>{metadata.passedQualityCheck ? 'Quality Verified' : 'Check Warning'}</span>
             </div>
             
             {/* Tech Specs */}
             <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-zinc-300 text-xs font-mono shadow-lg">
                {metadata.width}x{metadata.height} • {(metadata.sizeBytes / 1024 / 1024).toFixed(1)}MB
             </div>
          </div>
        )}
        
        {/* Overlay controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
          <p className="text-white text-sm line-clamp-2 mb-4 font-medium opacity-90">{currentImage.prompt}</p>
          <div className="flex gap-2">
            <Button 
              variant="primary" 
              onClick={() => onDownload(currentImage.url)} 
              className="flex-1 text-sm py-2"
              icon={<Download size={16} />}
            >
              Download
            </Button>
            <Button 
              variant="secondary" 
              onClick={onRegenerate}
              className="aspect-square p-2"
              title="Regenerate"
            >
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Thumbnails & Batch Actions */}
      {images.length > 1 && (
        <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center px-1">
                 <span className="text-xs text-zinc-500 font-medium">{images.length} generated images</span>
                 <Button 
                    variant="ghost" 
                    className="text-xs py-1 h-8" 
                    onClick={() => {
                        images.forEach((img, idx) => {
                            setTimeout(() => onDownload(img.url), idx * 800);
                        });
                    }}
                    icon={<Download size={14} />}
                 >
                    Download All
                 </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedIndex(idx)}
                  className={`relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 transition-all ${
                    idx === selectedIndex 
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-900 opacity-100' 
                      : 'opacity-50 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                  
                  {/* Mini Quality Indicator */}
                  {img.metadata && !img.metadata.passedQualityCheck && (
                    <div className="absolute top-1 right-1 text-amber-500 bg-black/50 rounded-full p-0.5">
                       <AlertTriangle size={10} />
                    </div>
                  )}
                </button>
              ))}
            </div>
        </div>
      )}
    </div>
  );
};