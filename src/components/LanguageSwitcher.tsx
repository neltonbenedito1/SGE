import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../hooks/useLanguage';
import { Globe, Check } from 'lucide-react';

export default function LanguageSwitcher() {
  const { language, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'pt', label: 'Português', flag: '🇵🇹', short: 'PT' },
    { code: 'en', label: 'English', flag: '🇺🇸', short: 'EN' },
  ];

  const activeLang = languages.find(l => l.code === language) || languages[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = async (code: string) => {
    await changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} id="language-switcher-container">
      <button
        type="button"
        id="language-switcher-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none"
      >
        <Globe className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
        <span>{activeLang.flag}</span>
        <span className="hidden sm:inline-block tracking-wide uppercase">{activeLang.short}</span>
      </button>

      {isOpen && (
        <div
          id="language-switcher-dropdown"
          className="absolute right-0 mt-1.5 w-40 origin-top-right rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 shadow-lg focus:outline-none z-50"
        >
          <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="language-switcher-btn">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 text-left cursor-pointer ${
                  language === lang.code
                    ? 'font-bold text-blue-600 dark:text-blue-400 bg-slate-50/50 dark:bg-slate-900/50'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </div>
                {language === lang.code && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
