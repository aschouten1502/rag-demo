'use client';

import { useState, useEffect, useRef } from "react";
import { translations, type LanguageCode } from "../translations";
import { BRANDING } from "@/lib/branding.config";

const LANGUAGES = [
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "ro", name: "Română", flag: "🇷🇴" },
];

interface ChatHeaderProps {
  selectedLanguage: string;
  onLanguageChange: (code: string) => void;
}

export const ChatHeader = ({ selectedLanguage, onLanguageChange }: ChatHeaderProps) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const currentLang = LANGUAGES.find((l) => l.code === selectedLanguage) || LANGUAGES[0];
  const t = translations[selectedLanguage as LanguageCode] || translations.nl;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  // Dynamic styles from branding config
  const headerStyle = {
    background: `linear-gradient(to right, ${BRANDING.colors.primary}, ${BRANDING.colors.primaryDark})`
  };

  const logoStyle = {
    color: BRANDING.colors.primary
  };

  return (
    <header className="shadow-2xl" style={headerStyle}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo + Title Section */}
          <div className="flex items-center gap-3">
            {BRANDING.logo.main ? (
              // Use logo image if configured
              <div className="bg-white rounded-xl p-2.5 shadow-lg">
                <img
                  src={BRANDING.logo.main}
                  alt={BRANDING.shortName}
                  className="h-8 w-auto"
                  style={{
                    width: BRANDING.logo.dimensions.width ? `${BRANDING.logo.dimensions.width}px` : 'auto',
                    height: BRANDING.logo.dimensions.height ? `${BRANDING.logo.dimensions.height}px` : '32px'
                  }}
                />
              </div>
            ) : (
              // Use text logo if no image configured
              <div className="bg-white rounded-xl px-4 py-2.5 shadow-lg">
                <h1 className="text-xl font-bold tracking-tight" style={logoStyle}>
                  {BRANDING.shortName.toUpperCase()}
                </h1>
              </div>
            )}
            <div>
              <h1 className="text-white text-lg sm:text-xl font-bold">
                {t.appTitle}
              </h1>
              <p className="text-white/90 text-xs sm:text-sm hidden sm:block">
                {t.appSubtitle}
              </p>
            </div>
          </div>

          {/* Language Selector */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20
                         px-3 py-2 rounded-full transition-all
                         text-white text-sm border border-white/20"
            >
              <span className="text-lg">{currentLang.flag}</span>
              <span className="hidden sm:inline font-medium">{currentLang.name}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-2xl
                              overflow-hidden z-50 animate-fade-in border border-gray-100">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      onLanguageChange(lang.code);
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 transition-all flex items-center gap-3 text-sm text-gray-800"
                    style={{
                      backgroundColor: lang.code === selectedLanguage
                        ? `${BRANDING.colors.primary}20`
                        : 'transparent',
                      fontWeight: lang.code === selectedLanguage ? 600 : 400
                    }}
                    onMouseEnter={(e) => {
                      if (lang.code !== selectedLanguage) {
                        e.currentTarget.style.backgroundColor = `${BRANDING.colors.primary}10`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (lang.code !== selectedLanguage) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
