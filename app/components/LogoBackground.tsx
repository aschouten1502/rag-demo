'use client';

import { BRANDING } from '@/lib/branding.config';

export const LogoBackground = () => {
  // Create array of 40 DEMO text elements for clean background pattern
  const demoCount = 40;
  const demoItems = Array.from({ length: demoCount }, (_, i) => i);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {/* Clean white background */}
      <div className="absolute inset-0 bg-white" />

      {/* DEMO text pattern - Very subtle watermark */}
      <div className="absolute inset-0 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6
                      gap-12 sm:gap-16 md:gap-20 lg:gap-24
                      p-8 sm:p-12 md:p-16 lg:p-20
                      place-items-center">
        {demoItems.map((i) => (
          <div
            key={i}
            className="flex items-center justify-center"
          >
            <div
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-gray-200 select-none"
              style={{
                opacity: 0.15,
                fontFamily: 'system-ui, -apple-system, sans-serif',
                letterSpacing: '0.1em'
              }}
            >
              DEMO
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
