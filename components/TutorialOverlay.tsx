import React, { useEffect, useState, useLayoutEffect } from 'react';
import { BButton } from './BrutalistUI';
import { X } from 'lucide-react';

export interface TutorialStep {
  targetId?: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'center';
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  onComplete: () => void;
  onSkip: () => void;
  isOpen: boolean;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ steps, onComplete, onSkip, isOpen }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const currentStep = steps[currentStepIndex];

  // Reset step index when tutorial opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStepIndex(0);
    }
  }, [isOpen]);

  // Update target position
  useLayoutEffect(() => {
    if (!isOpen) return;
    
    const updatePosition = () => {
      if (currentStep.targetId) {
        const el = document.getElementById(currentStep.targetId);
        if (el) {
          setTargetRect(el.getBoundingClientRect());
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          setTargetRect(null);
        }
      } else {
        setTargetRect(null);
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    const timeout = setTimeout(updatePosition, 100); // Delay for layout settlements
    
    return () => {
      window.removeEventListener('resize', updatePosition);
      clearTimeout(timeout);
    };
  }, [currentStepIndex, isOpen, currentStep]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const isCenter = !currentStep.targetId || !targetRect;
  // Determine vertical placement logic based on target position and step preference
  const verticalPos = isCenter 
    ? '50%' 
    : targetRect 
        ? (currentStep.position === 'top' ? targetRect.top - 16 : targetRect.bottom + 16)
        : '50%';

  const transformStr = isCenter 
    ? 'translate(-50%, -50%)' 
    : `translate(-50%, ${currentStep.position === 'top' ? '-100%' : '0'})`;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-all duration-300" />

        {/* Highlighter (Mask Effect) */}
        {targetRect && (
             <div 
                className="absolute border-4 border-yellow-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] pointer-events-none transition-all duration-300 box-content"
                style={{
                    top: targetRect.top - 4,
                    left: targetRect.left - 4,
                    width: targetRect.width,
                    height: targetRect.height,
                    zIndex: 51
                }}
             />
        )}

        {/* Content Card */}
        <div 
            className="absolute w-full max-w-xs sm:max-w-sm p-4 transition-all duration-300 z-[52]"
            style={{
                top: verticalPos,
                left: targetRect ? (targetRect.left + targetRect.width / 2) : '50%',
                transform: transformStr
            }}
        >
            <div className="bg-yellow-300 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 relative">
                <button 
                    onClick={onSkip} 
                    className="absolute top-2 right-2 p-1 hover:bg-black hover:text-white transition-colors"
                    aria-label="Close Tutorial"
                >
                    <X size={20} />
                </button>

                <h3 className="text-xl font-black mb-2 uppercase tracking-tight">{currentStep.title}</h3>
                <p className="font-mono text-sm mb-6 leading-relaxed font-bold">
                    {currentStep.content}
                </p>

                <div className="flex justify-between items-center">
                    <div className="text-xs font-bold font-mono bg-black text-white px-2 py-1">
                        STEP {currentStepIndex + 1}/{steps.length}
                    </div>
                    <BButton size="sm" onClick={handleNext} className="!bg-black !text-white hover:!bg-gray-800">
                        {currentStepIndex === steps.length - 1 ? 'PLAY' : 'NEXT'}
                    </BButton>
                </div>
            </div>
        </div>
    </div>
  );
};