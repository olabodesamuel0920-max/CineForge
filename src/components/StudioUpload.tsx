"use client";

import React, { useState, useRef } from 'react';
import { Film, UploadCloud, CheckCircle2, FileVideo, X } from 'lucide-react';

interface StudioUploadProps {
  onFileSelect: (filename: string, size?: string) => void;
  selectedFilename: string | null;
  onClear: () => void;
}

export default function StudioUpload({ onFileSelect, selectedFilename, onClear }: StudioUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [fileSize, setFileSize] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (file) {
      // Human-readable size
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
      const sizeStr = `${sizeInMB} MB`;
      setFileSize(sizeStr);
      onFileSelect(file.name, sizeStr);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFileSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClear();
  };

  return (
    <div 
      className={`relative w-full rounded-xl border-2 border-dashed transition-all duration-300 ${
        dragActive 
          ? 'border-brand-cyan bg-brand-cyan/5' 
          : selectedFilename 
            ? 'border-brand-green/40 bg-brand-green/5' 
            : 'border-white/10 hover:border-white/20 bg-space-card/20'
      }`}
      onDragEnter={handleDrag}
      onDragOver={handleDrag}
      onDragLeave={handleDrag}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,image/*"
        className="hidden"
        onChange={handleChange}
      />

      {selectedFilename ? (
        <div className="p-8 flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full bg-brand-green/10 text-brand-green flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-gray-200 truncate max-w-xs md:max-w-md">
            {selectedFilename}
          </p>
          <p className="text-xs text-gray-400 mt-1 font-mono">
            {fileSize || 'Size Pending Analysis'}
          </p>
          <button
            type="button"
            onClick={clearFile}
            className="mt-4 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-300 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" /> Clear File
          </button>
        </div>
      ) : (
        <div 
          onClick={onButtonClick}
          className="p-8 flex flex-col items-center justify-center text-center cursor-pointer min-h-[180px]"
        >
          {/* Futuristic scanning target indicator */}
          <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-white/20"></div>
          <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-white/20"></div>
          <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-white/20"></div>
          <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-white/20"></div>

          <div className="w-12 h-12 rounded-full bg-white/5 text-gray-400 flex items-center justify-center mb-4 group-hover:text-white transition-colors relative overflow-hidden">
            {/* Pulsing scanning overlay */}
            <div className="absolute inset-0 bg-brand-cyan/5 animate-pulse"></div>
            <UploadCloud className="w-6 h-6 text-gray-300 relative z-10" />
          </div>
          <p className="text-sm font-semibold text-gray-200">
            Drag & Drop Media or <span className="text-brand-cyan underline decoration-brand-cyan/40 hover:decoration-brand-cyan">Browse</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-2 max-w-xs leading-normal">
            Supports MP4, MOV, WebM, PNG, JPG (Max 500MB). Video files auto-analyze for cinematic flow cues.
          </p>
        </div>
      )}
    </div>
  );
}
