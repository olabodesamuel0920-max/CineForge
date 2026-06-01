"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Film, UploadCloud, CheckCircle2, Loader2, AlertCircle, Trash2, Video } from 'lucide-react';

export interface UploadedFileMetadata {
  filePath: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  duration?: number;
}

interface StudioUploadProps {
  onFileSelect: (metadata: UploadedFileMetadata) => void;
  selectedFilename: string | null;
  onClear: () => void;
}

type UploadStatus = 'IDLE' | 'PREVIEWING' | 'NEGOTIATING' | 'UPLOADING' | 'COMPLETED' | 'FAILED';

export default function StudioUpload({ onFileSelect, selectedFilename, onClear }: StudioUploadProps) {
  const [status, setStatus] = useState<UploadStatus>('IDLE');
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [meta, setMeta] = useState<UploadedFileMetadata | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  // Clean up Object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
    };
  }, [objectUrl]);

  // Sync state if parent clears it
  useEffect(() => {
    if (!selectedFilename && status === 'COMPLETED') {
      resetUpload();
    }
  }, [selectedFilename]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;

    // Stage 1: Local preview URL compilation
    const previewUrl = URL.createObjectURL(file);
    setObjectUrl(previewUrl);
    setStatus('NEGOTIATING');
    setProgress(0);
    setErrorMsg(null);

    // Read video metadata (duration) in the browser
    let videoDuration: number | undefined = undefined;
    if (file.type.startsWith('video/')) {
      try {
        videoDuration = await new Promise<number>((resolve, reject) => {
          const video = document.createElement('video');
          video.preload = 'metadata';
          video.src = previewUrl;
          video.onloadedmetadata = () => {
            resolve(video.duration);
          };
          video.onerror = () => {
            reject(new Error('Failed to load video metadata in browser.'));
          };
        });
      } catch (err) {
        console.warn('Failed to extract video duration in client:', err);
      }
    }

    try {
      // Stage 2: Negotiate upload format with the Next.js API
      const negotiateResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size
        })
      });

      const negotiateData = await negotiateResponse.json();
      if (!negotiateResponse.ok) {
        throw new Error(negotiateData.error || 'Negotiation failed.');
      }

      const { mode, uploadUrl, filePath, fileName, fileSize, contentType } = negotiateData;
      setStatus('UPLOADING');

      // Stage 3: Perform XHR-based upload progress stream pipe
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);
        }
      });

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            try {
              const res = JSON.parse(xhr.responseText);
              reject(new Error(res.error || `Upload failed (Status ${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed with status code ${xhr.status}.`));
            }
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network dispatch connection failure.')));
        xhr.addEventListener('abort', () => reject(new Error('Upload request aborted.')));
      });

      if (mode === 'local') {
        xhr.open('POST', uploadUrl);
        const form = new FormData();
        form.append('file', file);
        form.append('fileName', fileName);
        xhr.send(form);
      } else {
        // Direct binary upload targeting GCS bucket Presigned URL
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      }

      await uploadPromise;

      // Stage 4: Completed
      const completedMeta: UploadedFileMetadata = {
        filePath,
        fileName,
        fileSize,
        contentType,
        duration: videoDuration
      };

      setMeta(completedMeta);
      setStatus('COMPLETED');
      onFileSelect(completedMeta);

    } catch (err) {
      console.error('File upload pipeline failed:', err);
      setStatus('FAILED');
      setErrorMsg((err as Error).message);
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

  const resetUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      setObjectUrl(null);
    }
    setMeta(null);
    setProgress(0);
    setErrorMsg(null);
    setStatus('IDLE');
    onClear();
  };

  return (
    <div 
      className={`relative w-full rounded-xl border-2 border-dashed transition-all duration-300 overflow-hidden ${
        dragActive 
          ? 'border-brand-cyan bg-brand-cyan/5' 
          : status === 'COMPLETED'
            ? 'border-brand-green/40 bg-brand-green/5' 
            : status === 'FAILED'
              ? 'border-brand-magenta/40 bg-brand-magenta/5'
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
        disabled={status === 'NEGOTIATING' || status === 'UPLOADING'}
      />

      {/* --- IDLE STATE --- */}
      {status === 'IDLE' && (
        <div 
          onClick={onButtonClick}
          className="p-8 flex flex-col items-center justify-center text-center cursor-pointer min-h-[220px] relative"
        >
          <div className="absolute top-3 left-3 w-3 h-3 border-t border-l border-white/20"></div>
          <div className="absolute top-3 right-3 w-3 h-3 border-t border-r border-white/20"></div>
          <div className="absolute bottom-3 left-3 w-3 h-3 border-b border-l border-white/20"></div>
          <div className="absolute bottom-3 right-3 w-3 h-3 border-b border-r border-white/20"></div>

          <div className="w-12 h-12 rounded-full bg-white/5 text-gray-400 flex items-center justify-center mb-4 group-hover:text-white transition-colors relative overflow-hidden">
            <div className="absolute inset-0 bg-brand-cyan/5 animate-pulse"></div>
            <UploadCloud className="w-6 h-6 text-gray-300 relative z-10" />
          </div>
          <p className="text-sm font-semibold text-gray-200">
            Drag & Drop Media or <span className="text-brand-cyan underline decoration-brand-cyan/40 hover:decoration-brand-cyan">Browse</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-2 max-w-xs leading-normal">
            Supports MP4, MOV, WebM, PNG, JPG (Max 100MB). Video files auto-analyze for cinematic flow cues.
          </p>
        </div>
      )}

      {/* --- LOADING / UPLOADING STATE --- */}
      {(status === 'NEGOTIATING' || status === 'UPLOADING') && (
        <div className="p-8 flex flex-col items-center text-center min-h-[220px] justify-center font-mono">
          <div className="w-12 h-12 rounded-full bg-brand-cyan/10 text-brand-cyan flex items-center justify-center mb-4 animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-xs text-gray-300 font-bold uppercase tracking-wider">
            {status === 'NEGOTIATING' ? 'CALIBRATING SECURITY TARGET...' : `UPLOADING STREAM (${progress}%)`}
          </p>
          
          <div className="w-64 h-1.5 bg-white/5 rounded-full mt-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-brand-cyan to-brand-violet rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-gray-500 mt-2">
            Piping chunks directly to media buffer. Do not close connection.
          </p>
        </div>
      )}

      {/* --- COMPLETED SUCCESS STATE (WITH INLINE VIDEO PREVIEW) --- */}
      {status === 'COMPLETED' && meta && (
        <div className="relative flex flex-col md:flex-row items-center md:items-stretch min-h-[220px]">
          
          {/* Real Media Preview Pane (if it's video) */}
          {objectUrl && meta.contentType.startsWith('video/') ? (
            <div className="w-full md:w-48 h-48 md:h-auto bg-black relative shrink-0 overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
              <video 
                src={objectUrl} 
                className="w-full h-full object-cover"
                autoPlay 
                muted 
                loop 
                playsInline
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
              <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-space-black/70 border border-white/10 text-[9px] text-brand-cyan font-mono flex items-center gap-1">
                <Video className="w-3 h-3 text-brand-cyan" /> PREVIEW
              </div>
            </div>
          ) : objectUrl && meta.contentType.startsWith('image/') ? (
            <div className="w-full md:w-48 h-48 md:h-auto bg-black relative shrink-0 overflow-hidden border-b md:border-b-0 md:border-r border-white/5">
              <img src={objectUrl} className="w-full h-full object-cover" alt="Source staged" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
              <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded bg-space-black/70 border border-white/10 text-[9px] text-brand-cyan font-mono">IMAGE</div>
            </div>
          ) : (
            <div className="w-full md:w-48 h-48 md:h-auto bg-white/5 flex items-center justify-center shrink-0 border-r border-white/5">
              <Film className="w-8 h-8 text-gray-500" />
            </div>
          )}

          {/* Details & Reset controls */}
          <div className="p-6 flex-1 flex flex-col justify-between font-mono text-xs">
            <div className="flex flex-col gap-2">
              <span className="text-brand-green font-bold flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Media Asset Staged
              </span>
              <p className="text-gray-200 font-semibold truncate max-w-[260px] md:max-w-xs" title={meta.fileName}>
                {meta.fileName}
              </p>
              <div className="flex flex-col gap-1 text-[10px] text-gray-400 mt-1 leading-normal">
                <span>File Path: <code className="text-brand-cyan">{meta.filePath}</code></span>
                <span>File Size: <code className="text-gray-200">{(meta.fileSize / (1024 * 1024)).toFixed(2)} MB</code></span>
                <span>Type: <code className="text-gray-200">{meta.contentType}</code></span>
              </div>
            </div>

            <button
              type="button"
              onClick={resetUpload}
              className="mt-6 md:mt-0 self-start px-3 py-1.5 rounded bg-brand-magenta/10 hover:bg-brand-magenta/20 border border-brand-magenta/30 text-brand-magenta text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Purge Asset
            </button>
          </div>
        </div>
      )}

      {/* --- FAILED ERROR STATE --- */}
      {status === 'FAILED' && (
        <div className="p-8 flex flex-col items-center text-center min-h-[220px] justify-center font-mono">
          <div className="w-12 h-12 rounded-full bg-brand-magenta/10 text-brand-magenta flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-xs text-brand-magenta font-bold uppercase tracking-wider">
            UPLOAD STREAM INTERRUPTED
          </p>
          <p className="text-[10px] text-gray-300 mt-2 max-w-sm leading-relaxed border border-brand-magenta/20 p-2.5 rounded bg-black/25">
            {errorMsg || 'Unknown connection error.'}
          </p>
          
          <button
            type="button"
            onClick={resetUpload}
            className="mt-4 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-gray-200 cursor-pointer transition-colors"
          >
            Clear and Retry
          </button>
        </div>
      )}

    </div>
  );
}
