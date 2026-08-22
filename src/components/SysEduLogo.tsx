import React from 'react';

interface SysEduLogoProps {
  variant?: 'full' | 'vertical' | 'icon' | 'monochrome' | 'negative' | 'auto';
  className?: string;
  size?: number;
  showSlogan?: boolean;
  isDark?: boolean;
}

export function SysEduLogo({ 
  variant = 'full', 
  className = '', 
  size = 40,
  showSlogan = false,
  isDark
}: SysEduLogoProps) {
  // Gradients and Colors based on the brandbook specs:
  // - Azul-marinho (texto/título): #0D1B3D
  // - Azul primário: #1E66F5
  // - Verde-água (destaque/sucesso): #10B981
  // - Monochrome: #6B7280 / #9CA3AF
  // - Negative: #FFFFFF

  let resolvedVariant = variant;
  if (variant === 'auto') {
    resolvedVariant = isDark ? 'negative' : 'full';
  } else if (isDark !== undefined) {
    if (variant === 'full' && isDark) resolvedVariant = 'negative';
    if (variant === 'negative' && !isDark) resolvedVariant = 'full';
  }

  const isMonochrome = resolvedVariant === 'monochrome';
  const isNegative = resolvedVariant === 'negative';

  const sysColor = isMonochrome ? 'text-gray-600' : isNegative ? 'text-white' : 'text-[#0D1B3D]';
  const eduColor = isMonochrome ? 'text-gray-400' : isNegative ? 'text-white' : 'text-[#1E66F5]';
  const subtitleColor = isMonochrome ? 'text-gray-400' : isNegative ? 'text-blue-200' : 'text-[#4B5563]';

  // Return the SVG Icon of the graduation hat over open book
  const renderIcon = () => (
    <svg 
      viewBox="0 0 160 160" 
      width={size} 
      height={size} 
      className="shrink-0"
    >
      <defs>
        {/* Colors and gradients for the official SysEdu logo */}
        <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E66F5" />
          <stop offset="100%" stopColor="#0B42A3" />
        </linearGradient>
        <linearGradient id="tealGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="monoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4B5563" />
          <stop offset="100%" stopColor="#1F2937" />
        </linearGradient>
        <linearGradient id="negativeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E0E7FF" />
        </linearGradient>
      </defs>

      {/* Graduation Hat - Cap Top (Diamond Shape) */}
      <path 
        d="M 80,30 L 138,52 L 80,74 L 22,52 Z" 
        fill={isMonochrome ? 'url(#monoGradient)' : isNegative ? 'url(#negativeGradient)' : 'url(#blueGradient)'}
        stroke="none"
      />

      {/* Graduation Hat - Bottom Skullcap Head Shape */}
      <path 
        d="M 45,60 L 45,78 C 45,95 115,95 115,78 L 115,60" 
        fill={isMonochrome ? 'url(#monoGradient)' : isNegative ? 'url(#negativeGradient)' : 'url(#blueGradient)'}
        opacity="0.9"
      />

      {/* Tassel Hanging down */}
      <path 
        d="M 80,52 L 122,58 L 122,88" 
        fill="none" 
        stroke={isMonochrome ? '#374151' : isNegative ? '#E0E7FF' : '#1E66F5'} 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      {/* Tassel tassel cap/button */}
      <circle 
        cx="122" 
        cy="90" 
        r="4.5" 
        fill={isMonochrome ? '#1F2937' : isNegative ? '#FFFFFF' : '#0D1B3D'} 
      />

      {/* Head/Center circle under the cap (neck/head spacer) */}
      <circle 
        cx="80" 
        cy="80" 
        r="14" 
        fill={isMonochrome ? '#4B5563' : isNegative ? '#E0E7FF' : '#1E66F5'} 
        opacity="0.95"
      />

      {/* Open Book - Left Page (Blue Gradient) */}
      <path 
        d="M 80,105 C 55,90 28,100 24,115 L 24,142 C 28,127 55,117 80,132 Z" 
        fill={isMonochrome ? '#6B7280' : isNegative ? '#FFFFFF' : 'url(#blueGradient)'}
      />

      {/* Open Book - Right Page (Green-Teal Gradient) */}
      <path 
        d="M 80,105 C 105,90 132,100 136,115 L 136,142 C 132,127 105,117 80,132 Z" 
        fill={isMonochrome ? '#9CA3AF' : isNegative ? '#E0E7FF' : 'url(#tealGradient)'}
      />
    </svg>
  );

  if (resolvedVariant === 'icon') {
    return renderIcon();
  }

  if (resolvedVariant === 'vertical') {
    return (
      <div className={`flex flex-col items-center text-center space-y-3 ${className}`}>
        {renderIcon()}
        <div className="space-y-1">
          <div className="flex items-center justify-center font-poppins">
            <span className={`text-3xl font-extrabold tracking-tight ${sysColor}`}>Sys</span>
            <span className={`text-3xl font-extrabold tracking-tight ${eduColor}`}>Edu</span>
          </div>
          
          {/* Logo Divider */}
          <div className="flex items-center justify-center gap-1.5 py-1">
            <div className={`h-[1px] w-8 ${isMonochrome ? 'bg-gray-300' : isNegative ? 'bg-indigo-300/40' : 'bg-blue-300'}`}></div>
            <div className={`w-1.5 h-1.5 rounded-full ${isMonochrome ? 'bg-gray-500' : isNegative ? 'bg-white' : 'bg-[#10B981]'}`}></div>
            <div className={`h-[1px] w-8 ${isMonochrome ? 'bg-gray-300' : isNegative ? 'bg-indigo-300/40' : 'bg-blue-300'}`}></div>
          </div>

          <p className={`text-[10px] uppercase tracking-[0.15em] font-bold ${subtitleColor}`}>
            Sistema de Gestão Educacional
          </p>
          {(showSlogan || resolvedVariant === 'vertical') && (
            <p className={`text-xs italic font-medium mt-1 ${isMonochrome ? 'text-gray-400' : isNegative ? 'text-indigo-200/80' : 'text-[#6B7280]'}`}>
              "Organizar hoje, transformar o amanhã."
            </p>
          )}
        </div>
      </div>
    );
  }

  // Horizontal Full Logo
  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      {renderIcon()}
      <div className="flex flex-col">
        <div className="flex items-center font-poppins leading-none">
          <span className={`text-3xl font-extrabold tracking-tight ${sysColor}`}>Sys</span>
          <span className={`text-3xl font-extrabold tracking-tight ${eduColor}`}>Edu</span>
        </div>
        
        {/* Logo Divider Line */}
        <div className="flex items-center gap-1.5 py-1">
          <div className={`h-[1.5px] w-12 ${isMonochrome ? 'bg-gray-300' : isNegative ? 'bg-indigo-300/40' : 'bg-blue-300'}`}></div>
          <div className={`w-1.5 h-1.5 rounded-full ${isMonochrome ? 'bg-gray-500' : isNegative ? 'bg-white' : 'bg-[#10B981]'}`}></div>
          <div className={`h-[1.5px] w-12 ${isMonochrome ? 'bg-gray-300' : isNegative ? 'bg-indigo-300/40' : 'bg-blue-300'}`}></div>
        </div>

        <p className={`text-[9px] uppercase tracking-[0.12em] font-bold leading-none ${subtitleColor}`}>
          Sistema de Gestão Educacional
        </p>
        {showSlogan && (
          <p className={`text-[10px] italic mt-0.5 ${isMonochrome ? 'text-gray-400' : isNegative ? 'text-indigo-200/70' : 'text-[#6B7280]'}`}>
            "Organizar hoje, transformar o amanhã."
          </p>
        )}
      </div>
    </div>
  );
}
