export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
  metadata?: {
    width: number;
    height: number;
    sizeBytes: number;
    passedQualityCheck: boolean;
    checkReason?: string;
  };
}

export enum ModelType {
  FLASH = 'gemini-2.5-flash-image',
  PRO = 'gemini-3-pro-image-preview',
}

export type AspectRatio = '1:1' | '3:4' | '4:3' | '3:2' | '9:16' | '16:9' | '4:5';

export type OutputFormat = 'png' | 'jpeg' | 'webp';

export interface GenerationConfig {
  prompt: string;
  style: string;
  model: ModelType;
  aspectRatio: AspectRatio;
  numberOfImages: number;
}

// Global type augmentation for window.aistudio and File System Access API
declare global {
  // Augment the existing AIStudio interface which is used by window.aistudio
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    showSaveFilePicker?: (options?: FileSystemSaveFilePickerOptions) => Promise<FileSystemFileHandle>;
  }

  interface FileSystemSaveFilePickerOptions {
    suggestedName?: string;
    types?: {
      description: string;
      accept: Record<string, string[]>;
    }[];
  }
}