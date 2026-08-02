import React from 'react';

interface SamsungLoadingScreenProps {
  title?: string;
  subtitle?: string;
  message?: string;
  fullScreen?: boolean;
}

export const SamsungLoadingScreen: React.FC<SamsungLoadingScreenProps> = ({
  title = "A carregar...",
  subtitle = "A processar dados com segurança...",
  message,
  fullScreen = true
}) => {
  const displaySubtitle = message || subtitle;
  const content = (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-slate-800/80 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-5 max-w-xs text-center animate-in zoom-in-95 duration-200">
      {/* Samsung One UI style circular loader */}
      <div className="relative w-16 h-16 flex items-center justify-center">
        {/* Soft background glow */}
        <div className="absolute inset-0 rounded-full bg-indigo-500/20 blur-md animate-pulse"></div>
        
        {/* Outer glowing ring track */}
        <svg className="w-14 h-14 animate-spin text-indigo-600 dark:text-indigo-400" viewBox="0 0 50 50">
          <circle 
            className="opacity-15" 
            cx="25" 
            cy="25" 
            r="20" 
            stroke="currentColor" 
            strokeWidth="3" 
            fill="none" 
          />
          <path 
            className="opacity-90" 
            fill="none" 
            stroke="url(#samsung-loader-gradient)" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            d="M25,5 A20,20 0 0,1 45,25" 
          />
          <defs>
            <linearGradient id="samsung-loader-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center dot */}
        <div className="absolute w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full shadow-sm animate-ping opacity-75"></div>
        <div className="absolute w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-full"></div>
      </div>

      <div>
        <p className="text-xs font-black tracking-wider text-slate-800 dark:text-slate-100 uppercase font-sans">
          {title}
        </p>
        {displaySubtitle && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed">
            {displaySubtitle}
          </p>
        )}
      </div>
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-md flex items-center justify-center z-[9999] animate-in fade-in duration-200">
        {content}
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[200px] flex items-center justify-center p-6 backdrop-blur-md">
      {content}
    </div>
  );
};
