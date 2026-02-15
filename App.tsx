import React, { useState, useCallback } from 'react';
import { Sparkles, Image as ImageIcon, Zap, Award, Info, AlertCircle, Code, FileJson, Layout, Smartphone, Monitor, Camera, Grid, Settings, FolderOpen, FileType, HardDrive, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from './components/Button';
import { ImageDisplay } from './components/ImageDisplay';
import { generateImages } from './services/geminiService';
import { ModelType, AspectRatio, OutputFormat, GeneratedImage } from './types';

const STYLES = [
  { id: 'realistic', label: 'Photorealistic', value: 'raw candid photo, shot on 35mm film, hyper-realistic, natural lighting, film grain, unpolished, highly detailed texture, skin pores, authentic' },
  { id: 'commercial', label: 'Commercial', value: 'clean studio background, commercial lighting, advertising quality, sharp product focus, professional color grading' },
  { id: 'editorial', label: 'Editorial', value: 'vogue aesthetic, dramatic studio lighting, fashion editorial style, high fashion, detailed skin, magazine quality' },
  { id: 'product', label: 'Product Shot', value: 'clean background, macro details, commercial product photography, depth of field, sharp focus' },
  { id: 'cinematic', label: 'Cinematic', value: 'movie scene, cinematic lighting, teal and orange color grading, depth of field, anamorphic lens, atmospheric' },
  { id: 'digital', label: 'Digital Art', value: 'concept art style, octane render, vibrant colors, highly detailed, digital painting' },
];

const RATIOS: { id: AspectRatio; label: string; icon: React.ReactNode }[] = [
  { id: '1:1', label: 'Square (1:1)', icon: <Layout size={16} /> },
  { id: '3:4', label: 'Portrait (3:4)', icon: <Smartphone size={16} /> },
  { id: '4:5', label: 'Social (4:5)', icon: <Grid size={16} /> },
  { id: '4:3', label: 'Landscape (4:3)', icon: <Monitor size={16} /> },
  { id: '3:2', label: 'Classic (3:2)', icon: <Camera size={16} /> },
  { id: '9:16', label: 'Tall (9:16)', icon: <Smartphone size={16} className="rotate-90" /> },
  { id: '16:9', label: 'Wide (16:9)', icon: <Monitor size={16} /> },
];

const MAX_WORDS = 700;

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0].id);
  const [model, setModel] = useState<ModelType>(ModelType.FLASH);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [imageCount, setImageCount] = useState<number>(1);
  const [isJsonMode, setIsJsonMode] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  
  // Export Settings
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('png');
  const [targetMB, setTargetMB] = useState<string>(''); 
  const [askLocation, setAskLocation] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);

  // Word Count Logic
  const wordCount = prompt.trim().split(/\s+/).filter(w => w.length > 0).length;
  const isOverLimit = wordCount > MAX_WORDS;

  // Automatic Quality Review
  const analyzeImage = async (base64Url: string): Promise<GeneratedImage['metadata']> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // Calculate size from base64 string length (approximate)
        const sizeBytes = Math.round((base64Url.length * 3) / 4);
        
        // Quality Rules:
        // 1. Resolution Check: Must be at least 1024x1024 for 1:1, or equivalent pixel count
        const pixelCount = img.naturalWidth * img.naturalHeight;
        const minPixels = 1000 * 1000; // ~1MP
        
        let passed = true;
        let reason = "Passed Quality Check";

        if (pixelCount < minPixels) {
          passed = false;
          reason = `Low Resolution (${img.naturalWidth}x${img.naturalHeight})`;
        } else if (img.naturalWidth < 512 || img.naturalHeight < 512) {
          // Detect suspiciously small dimensions even if pixel count is somehow met (rare)
          passed = false;
          reason = "Dimensions too small";
        }

        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeBytes,
          passedQualityCheck: passed,
          checkReason: reason
        });
      };
      img.onerror = () => {
        resolve({
          width: 0,
          height: 0,
          sizeBytes: 0,
          passedQualityCheck: false,
          checkReason: "Image Load Error"
        });
      };
      img.src = base64Url;
    });
  };

  const handleGenerate = async () => {
    let finalPrompt = prompt;
    let finalStyle = STYLES.find(s => s.id === selectedStyle)?.value || '';
    let finalRatio = aspectRatio;
    let finalCount = imageCount;

    // JSON Override Logic
    if (isJsonMode) {
      try {
        const parsed = JSON.parse(jsonInput);
        if (parsed.prompt) finalPrompt = parsed.prompt;
        if (parsed.style) finalStyle = parsed.style; 
        if (parsed.aspectRatio) finalRatio = parsed.aspectRatio;
        if (parsed.count) finalCount = parsed.count;
      } catch (e) {
        setError("Invalid JSON format. Please check your syntax.");
        return;
      }
    }

    if (!finalPrompt.trim()) {
      setError("Please enter a prompt.");
      return;
    }
    
    // Validate Word Count
    const currentWordCount = finalPrompt.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (currentWordCount > MAX_WORDS) {
      setError(`Prompt exceeds the ${MAX_WORDS} word limit. Please shorten your description.`);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setImages([]); 
    
    try {
      const base64Results = await generateImages(finalPrompt, finalStyle, model, finalRatio, finalCount);
      
      // Post-Processing: Run Automatic Review
      setProcessingStatus("Running automatic quality review...");
      
      const processedImages: GeneratedImage[] = await Promise.all(
        base64Results.map(async (url) => {
          const metadata = await analyzeImage(url);
          return {
            id: crypto.randomUUID(),
            url,
            prompt: finalPrompt,
            timestamp: Date.now(),
            metadata
          };
        })
      );

      setImages(processedImages);
      setProcessingStatus(null);
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate images. Please try again.');
      setProcessingStatus(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (url: string) => {
    try {
      setProcessingStatus("Preparing download...");
      const response = await fetch(url);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not create canvas context");
      
      if (outputFormat === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(bitmap, 0, 0);

      const mimeType = `image/${outputFormat}`;
      const extension = outputFormat === 'jpeg' ? 'jpg' : outputFormat;
      const filename = `image-x-${Date.now()}.${extension}`;

      let finalBlob: Blob | null = null;
      const getBlobAtQuality = (q: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, mimeType, q));
      const targetBytes = (parseFloat(targetMB) || 0) * 1024 * 1024;
      
      if (targetBytes > 0 && outputFormat !== 'png') {
        setProcessingStatus(`Optimizing size to ${targetMB}MB...`);
        let minQ = 0.05, maxQ = 1.0;
        let bestBlobUnderTarget: Blob | null = null;
        const maxBlob = await getBlobAtQuality(1.0);
        
        if (maxBlob && maxBlob.size <= targetBytes) {
           finalBlob = maxBlob;
        } else {
           for (let i = 0; i < 7; i++) {
              const midQ = (minQ + maxQ) / 2;
              const currentBlob = await getBlobAtQuality(midQ);
              if (currentBlob) {
                 if (currentBlob.size <= targetBytes) {
                    bestBlobUnderTarget = currentBlob;
                    minQ = midQ;
                 } else {
                    maxQ = midQ;
                 }
              }
           }
           finalBlob = bestBlobUnderTarget || await getBlobAtQuality(0.05);
        }
      } else {
         finalBlob = await getBlobAtQuality(1.0);
      }

      if (!finalBlob) throw new Error("Image conversion failed");
      setProcessingStatus(null);

      if (askLocation && window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: `${outputFormat.toUpperCase()} Image`,
              accept: { [mimeType]: [`.${extension}`] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(finalBlob);
          await writable.close();
        } catch (err: any) {
           if (err.name !== 'AbortError') console.error("Save file picker error:", err);
        }
      } else {
        const objectUrl = URL.createObjectURL(finalBlob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
      }
    } catch (err) {
      console.error("Download failed:", err);
      setError("Failed to download image. Security restrictions may apply.");
      setProcessingStatus(null);
    }
  };

  const toggleJsonMode = () => {
    setError(null);
    if (!isJsonMode) {
      const currentConfig = {
        prompt: prompt,
        style: STYLES.find(s => s.id === selectedStyle)?.value || "",
        aspectRatio: aspectRatio,
        count: imageCount
      };
      setJsonInput(JSON.stringify(currentConfig, null, 2));
      setIsJsonMode(true);
    } else {
      try {
        const parsed = JSON.parse(jsonInput);
        if (parsed.prompt) setPrompt(parsed.prompt);
        if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
        if (parsed.count) setImageCount(Math.min(4, Math.max(1, parsed.count)));
        setIsJsonMode(false);
      } catch (e) {
        setError("Invalid JSON. Fix syntax errors before switching back to Visual mode.");
      }
    }
  };

  return (
    <div className="min-h-screen text-zinc-100 relative overflow-x-hidden selection:bg-indigo-500/30">
      
      {/* Background */}
      <div className="fixed inset-0 z-0 bg-black">
        <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-purple-900/20 rounded-full blur-[120px] animate-pulse" style={{animationDuration: '8s'}}></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] bg-indigo-900/20 rounded-full blur-[120px] animate-pulse" style={{animationDuration: '12s'}}></div>
        <div className="absolute top-[30%] left-[20%] w-[40vw] h-[40vw] bg-blue-900/10 rounded-full blur-[100px]"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center py-8 px-4 sm:px-6 lg:px-8 min-h-screen">
        
        {/* Header */}
        <header className="w-full max-w-5xl mb-12 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
              <ImageIcon className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">IMAGE X</h1>
              <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">Professional Image Generation</p>
            </div>
          </div>
          
          <div className="glass-panel rounded-full p-1 flex items-center gap-1 backdrop-blur-xl bg-white/5 border-white/10">
            <button 
              onClick={() => setModel(ModelType.FLASH)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${model === ModelType.FLASH ? 'bg-zinc-800 text-white shadow-md ring-1 ring-white/10' : 'text-zinc-400 hover:text-white'}`}
            >
              <div className="flex items-center gap-2">
                 <Zap size={14} className={model === ModelType.FLASH ? 'text-yellow-400' : ''} />
                 <span>Fast</span>
              </div>
            </button>
            <button 
              onClick={() => setModel(ModelType.PRO)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${model === ModelType.PRO ? 'bg-zinc-800 text-white shadow-md ring-1 ring-white/10' : 'text-zinc-400 hover:text-white'}`}
            >
              <div className="flex items-center gap-2">
                 <Award size={14} className={model === ModelType.PRO ? 'text-purple-400' : ''} />
                 <span>Pro (HQ)</span>
              </div>
            </button>
          </div>
        </header>

        <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          
          {/* Controls */}
          <section className="lg:col-span-5 flex flex-col gap-6 order-2 lg:order-1">
            <div className="glass-panel p-6 rounded-2xl space-y-6 backdrop-blur-2xl bg-zinc-900/40 border-white/10 shadow-2xl">
              
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-zinc-300">Prompt Input</label>
                <div className="flex items-center gap-3">
                  {!isJsonMode && (
                    <span className={`text-[10px] font-medium ${isOverLimit ? 'text-red-400' : 'text-zinc-500'}`}>
                      {wordCount} / {MAX_WORDS} words
                    </span>
                  )}
                  <button 
                    onClick={toggleJsonMode}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors ${isJsonMode ? 'bg-indigo-900/50 border-indigo-500 text-indigo-300' : 'bg-transparent border-zinc-700 text-zinc-400 hover:text-white'}`}
                  >
                    {isJsonMode ? <FileJson size={12} /> : <Code size={12} />}
                    {isJsonMode ? 'JSON Mode' : 'Visual Mode'}
                  </button>
                </div>
              </div>

              {isJsonMode ? (
                <textarea 
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='{ "prompt": "...", "count": 1 }'
                  className="w-full bg-zinc-950/80 font-mono text-sm border border-zinc-700/50 rounded-lg p-4 text-green-400 placeholder-zinc-700 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none resize-none h-64 transition-all"
                />
              ) : (
                <>
                  <textarea 
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe subject... (e.g. A neon cyber cat)"
                    className={`w-full bg-zinc-900/50 border rounded-lg p-4 text-zinc-100 placeholder-zinc-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 outline-none resize-none h-32 transition-all shadow-inner ${isOverLimit ? 'border-red-500/50 focus:border-red-500' : 'border-zinc-700/50'}`}
                  />

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-3">Style</label>
                    <div className="grid grid-cols-2 gap-2">
                      {STYLES.map((style) => (
                        <button
                          key={style.id}
                          onClick={() => setSelectedStyle(style.id)}
                          className={`text-left px-3 py-2 rounded-lg border text-xs sm:text-sm transition-all truncate ${
                            selectedStyle === style.id 
                              ? 'bg-zinc-800 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                              : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800/50'
                          }`}
                        >
                          {style.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Aspect Ratio</label>
                      <div className="grid grid-cols-3 gap-1">
                        {RATIOS.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setAspectRatio(r.id)}
                            title={r.label}
                            className={`flex flex-col items-center justify-center p-2 rounded-md border transition-all ${
                              aspectRatio === r.id
                                ? 'bg-zinc-800 border-indigo-500 text-white shadow-md'
                                : 'bg-zinc-900/30 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50 hover:border-zinc-600'
                            }`}
                          >
                            {r.icon}
                            <span className="text-[10px] mt-1">{r.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">Image Count: {imageCount}</label>
                      <input 
                        type="range" 
                        min="1" 
                        max="4" 
                        step="1"
                        value={imageCount}
                        onChange={(e) => setImageCount(parseInt(e.target.value))}
                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                      <div className="flex justify-between text-xs text-zinc-500 mt-1 px-1">
                        <span>1</span><span>2</span><span>3</span><span>4</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Export Settings */}
              <div className="pt-2 border-t border-zinc-800/50">
                 <div className="flex items-center gap-2 mb-3 text-zinc-300">
                    <Settings size={14} />
                    <span className="text-sm font-medium">Export Settings</span>
                 </div>
                 
                 <div className="space-y-3">
                   <div className="grid grid-cols-2 gap-3">
                     <div className="relative">
                       <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none text-zinc-500">
                         <FileType size={14} />
                       </div>
                       <select 
                         value={outputFormat}
                         onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
                         className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg py-2 pl-8 pr-2 text-xs text-zinc-200 focus:border-indigo-500/50 outline-none appearance-none cursor-pointer hover:bg-zinc-800/50 transition-colors"
                       >
                          <option value="png">PNG (High Quality)</option>
                          <option value="jpeg">JPG (High Quality)</option>
                          <option value="webp">WEBP (Web Ready)</option>
                       </select>
                     </div>

                     <button 
                        onClick={() => setAskLocation(!askLocation)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
                          askLocation 
                          ? 'bg-zinc-800 border-indigo-500/50 text-white' 
                          : 'bg-zinc-900/50 border-zinc-700/50 text-zinc-400 hover:bg-zinc-800/50'
                        }`}
                     >
                       <div className="flex items-center gap-2">
                          <FolderOpen size={14} />
                          <span>Ask Location</span>
                       </div>
                       <div className={`w-2 h-2 rounded-full ${askLocation ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'bg-zinc-700'}`}></div>
                     </button>
                   </div>
                   
                   <div className="relative">
                     <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none text-zinc-500">
                       <HardDrive size={14} />
                     </div>
                     <input
                       type="number"
                       min="0.1"
                       step="0.1"
                       value={targetMB}
                       onChange={(e) => setTargetMB(e.target.value)}
                       placeholder={outputFormat === 'png' ? "Not available for PNG" : "Target File Size (MB) - Optional"}
                       disabled={outputFormat === 'png'}
                       className={`w-full bg-zinc-900/50 border rounded-lg py-2 pl-8 pr-2 text-xs outline-none transition-colors ${
                          outputFormat === 'png' 
                             ? 'border-zinc-800 text-zinc-600 placeholder-zinc-700 cursor-not-allowed' 
                             : 'border-zinc-700/50 text-zinc-200 placeholder-zinc-500 focus:border-indigo-500/50'
                       }`}
                     />
                   </div>
                 </div>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={handleGenerate} 
                  isLoading={isLoading} 
                  disabled={isOverLimit}
                  className="w-full py-4 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-none text-white shadow-xl shadow-indigo-900/30 ring-1 ring-white/10"
                  icon={<Sparkles size={20} />}
                >
                  Generate {imageCount > 1 ? `(${imageCount})` : ''}
                </Button>
              </div>
              
              {error && (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-900/20 border border-red-900/50 text-red-200 text-sm backdrop-blur-sm">
                  <AlertCircle size={20} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            <div className="glass-panel p-6 rounded-2xl backdrop-blur-xl bg-zinc-900/40 border-white/5">
               <div className="flex items-start gap-3 text-zinc-400 text-xs leading-relaxed">
                  <Info size={16} className="shrink-0 mt-0.5" />
                  <p>
                    <strong>Automatic Optimization:</strong> Your prompt is automatically enhanced with professional photography keywords.
                    <br/>
                    <strong>Quality Review:</strong> Images are checked for resolution integrity post-generation.
                  </p>
               </div>
            </div>
          </section>

          {/* Display */}
          <section className="lg:col-span-7 order-1 lg:order-2 min-h-[500px]">
             <div className="sticky top-8 h-[calc(100vh-6rem)]">
               <ImageDisplay 
                 images={images}
                 isLoading={isLoading} 
                 prompt={prompt}
                 onDownload={handleDownload}
                 onRegenerate={handleGenerate}
               />
               
               {processingStatus && (
                 <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
                    <div className="bg-zinc-900 border border-zinc-700 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3">
                       <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                       <span className="text-zinc-200 text-sm font-medium">{processingStatus}</span>
                    </div>
                 </div>
               )}
             </div>
          </section>

        </main>
      </div>
    </div>
  );
};

export default App;