import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function RightsSafetyNotice() {
  return (
    <div className="glass-panel rounded-xl p-4 border border-white/5 bg-space-card/40 flex items-start gap-3 max-w-2xl mx-auto shadow-lg shadow-black/40">
      <ShieldAlert className="w-5 h-5 text-brand-amber shrink-0 mt-0.5" />
      <div className="text-xs text-gray-400 leading-relaxed">
        <span className="font-semibold text-gray-200">Rights & Safety Notice:</span> Use original media or content you have permission to edit. For realistic AI-altered content, follow platform disclosure rules when publishing.
      </div>
    </div>
  );
}
