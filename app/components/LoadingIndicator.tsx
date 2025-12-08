'use client';

import { useState, useEffect } from 'react';
import { BRANDING } from '@/lib/branding.config';

export const LoadingIndicator = () => {
  const { funFacts } = BRANDING;
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Rotate through facts
  useEffect(() => {
    if (!funFacts.enabled || funFacts.facts.length === 0) return;

    // Start with random fact
    setCurrentFactIndex(Math.floor(Math.random() * funFacts.facts.length));

    const interval = setInterval(() => {
      setIsVisible(false);

      setTimeout(() => {
        setCurrentFactIndex((prev) => (prev + 1) % funFacts.facts.length);
        setIsVisible(true);
      }, 300); // Fade out duration
    }, funFacts.rotationInterval);

    return () => clearInterval(interval);
  }, [funFacts.enabled, funFacts.facts.length, funFacts.rotationInterval]);

  const showFact = funFacts.enabled && funFacts.facts.length > 0;
  const currentFact = showFact ? funFacts.facts[currentFactIndex] : null;

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex gap-3 max-w-[85%] sm:max-w-[75%]">
        {/* Bot Avatar */}
        <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-lg bg-white">
          <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary/20" />
        </div>

        {/* Loading Content */}
        <div className="bg-white px-6 py-4 rounded-2xl shadow-lg">
          {/* Loading Dots */}
          <div className="flex gap-1.5">
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce-dot"
              style={{ animationDelay: "0ms" }}
            />
            <div
              className="w-2 h-2 rounded-full bg-accent animate-bounce-dot"
              style={{ animationDelay: "150ms" }}
            />
            <div
              className="w-2 h-2 rounded-full bg-primary animate-bounce-dot"
              style={{ animationDelay: "300ms" }}
            />
          </div>

          {/* Fun Fact */}
          {showFact && currentFact && (
            <div
              className={`mt-3 pt-3 border-t border-gray-100 transition-opacity duration-300 ${
                isVisible ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <p className="text-sm text-gray-600">
                <span className="text-primary font-medium">💡 {funFacts.prefix}</span>{' '}
                {currentFact}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
