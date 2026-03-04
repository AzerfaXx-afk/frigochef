import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppTab } from '../types';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

interface InteractiveOnboardingProps {
    onComplete: () => void;
    onTabChange: (tab: AppTab) => void;
}

interface TutorialStep {
    targetId: string;
    tab: AppTab;
    title: string;
    description: string;
    placement: 'top' | 'bottom' | 'center';
}

const tutorialSteps: TutorialStep[] = [
    {
        targetId: 'nav-assistant',
        tab: AppTab.ASSISTANT,
        title: "Bienvenue Chef !",
        description: "Je suis ton assistant culinaire IA. Je te propose des recettes sur mesure selon ce que tu as dans ton frigo.",
        placement: 'top',
    },
    {
        targetId: 'nav-inventory',
        tab: AppTab.INVENTORY,
        title: "Ton Stock Intelligent & Caméra IA",
        description: "Gère ton frigo ici. Nouveauté : Utilise l'appareil photo pour scanner un ticket de caisse ou un code-barres et ajouter tes produits instantanément en stock !",
        placement: 'top',
    },
    {
        targetId: 'nav-shopping',
        tab: AppTab.SHOPPING,
        title: "Ta Liste de Courses",
        description: "Gère tes courses facilement. En un clic, transfère tes achats directement dans ton stock !",
        placement: 'top',
    },
    {
        targetId: 'nav-carnet',
        tab: AppTab.CARNET,
        title: "Ton Carnet",
        description: "Sauvegarde ici tes recettes générées préférées pour les refaire quand tu le souhaites.",
        placement: 'top',
    },
    {
        targetId: 'nav-profile',
        tab: AppTab.PROFILE,
        title: "Prêt à démarrer ?",
        description: "Ici tu retrouveras tes stats et tu pourras activer les notifications. C'est parti, aux fourneaux !",
        placement: 'top',
    }
];

const InteractiveOnboarding: React.FC<InteractiveOnboardingProps> = ({ onComplete, onTabChange }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

    const step = tutorialSteps[currentStep];

    // Recalculate target position
    const updateTargetRect = useCallback(() => {
        const el = document.getElementById(step.targetId);
        if (el) {
            setTargetRect(el.getBoundingClientRect());
        } else {
            setTargetRect(null);
        }
        setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    }, [step.targetId]);

    useEffect(() => {
        // Change underlying tab
        onTabChange(step.tab);

        // Wait for render to calculate geometry
        const timer = setTimeout(updateTargetRect, 300);
        window.addEventListener('resize', updateTargetRect);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateTargetRect);
        };
    }, [currentStep, step.tab, onTabChange, updateTargetRect]);

    const handleNext = () => {
        if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    // Compute smart positions to prevent horizontal clipping on small screens
    const margin = 20; // Increased side margin to squash potential horizontal bleeding
    const balloonMaxWidth = 360; // Narrower max-width for better fit on small mobiles

    let leftPos = '50%';
    let xTransform = '-50%';

    if (targetRect) {
        const targetCenterX = targetRect.left + targetRect.width / 2;
        // Estimate balloon width
        const estimatedWidth = Math.min(windowSize.w - margin * 2, balloonMaxWidth);
        const halfWidth = estimatedWidth / 2;

        // Ideal Left Position Center of the Target
        let idealLeft = targetCenterX;

        // Clamp the position so the balloon doesn't bleed off screen horizontally
        if (idealLeft - halfWidth < margin) {
            idealLeft = margin + halfWidth;
        } else if (idealLeft + halfWidth > windowSize.w - margin) {
            idealLeft = windowSize.w - margin - halfWidth;
        }

        leftPos = `${idealLeft}px`;
    }

    return (
        <div className="fixed inset-0 z-50 pointer-events-auto h-[100dvh] overflow-hidden">
            {/* SVG Spotlight Overlay */}
            <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <mask id="spotlight-mask">
                        <rect width="100%" height="100%" fill="white" />
                        {targetRect && (
                            <motion.rect
                                fill="black"
                                rx={16}
                                initial={false}
                                animate={{
                                    x: targetRect.left - 8,
                                    y: targetRect.top - 8,
                                    width: targetRect.width + 16,
                                    height: targetRect.height + 16,
                                }}
                                transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                            />
                        )}
                    </mask>
                </defs>
                <rect
                    width="100%"
                    height="100%"
                    fill="rgba(15, 23, 42, 0.85)" // slate-900 with opacity
                    mask="url(#spotlight-mask)"
                />
            </svg>

            {/* Skip Button */}
            <button
                onClick={onComplete}
                className="absolute top-6 right-4 md:right-6 text-white/80 hover:text-white px-3 py-1.5 rounded-full bg-slate-800/60 hover:bg-slate-800 backdrop-blur-md transition-colors z-50 flex gap-1.5 items-center text-xs font-bold ring-1 ring-white/10 shadow-lg"
            >
                <span>Passer</span>
                <X size={14} />
            </button>

            {/* Content Area */}
            {targetRect && (
                <div
                    style={{
                        position: 'absolute',
                        top: step.placement === 'top' ? targetRect.top - 20 : 'auto',
                        bottom: step.placement === 'bottom' ? windowSize.h - targetRect.bottom + 20 : 'auto',
                        left: leftPos,
                        transform: `translateX(${xTransform}) translateY(-100%)`, // Safe on standard div
                        width: `calc(100% - ${margin * 2}px)`,
                        maxWidth: `${balloonMaxWidth}px`,
                        pointerEvents: 'auto',
                        zIndex: 40
                    }}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentStep}
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            transition={{ duration: 0.4, type: 'spring', bounce: 0.4 }}
                            className="flex flex-col items-center w-full"
                        >
                            {/* Mascot Container */}
                            <motion.div
                                className="mb-3 relative z-10 flex items-center justify-center w-[88px] h-[88px] bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-900/40 dark:to-teal-800/40 rounded-full border-4 border-white dark:border-slate-700 shadow-xl"
                            >
                                <span className="text-[52px] drop-shadow-md relative -top-1">👨‍🍳</span>
                                {/* Internal glow */}
                                <div className="absolute inset-0 bg-gradient-to-tr from-black/10 to-transparent rounded-full opacity-50 pointer-events-none mix-blend-overlay" />
                            </motion.div>

                            {/* Dialog Balloon */}
                            <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-[28px] p-6 shadow-2xl border border-white/50 dark:border-slate-700/50 w-full relative">
                                <h2 className="text-xl font-bold font-outfit text-slate-800 dark:text-emerald-400 mb-2">
                                    {step.title}
                                </h2>
                                <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed min-h-[50px]">
                                    {step.description}
                                </p>

                                {/* Controls */}
                                <div className="flex justify-between items-center mt-5 pt-4 border-t border-slate-100/50 dark:border-slate-700/50">
                                    <div className="flex gap-1.5">
                                        {tutorialSteps.map((_, idx) => (
                                            <div
                                                key={idx}
                                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentStep ? 'w-4 bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'w-1.5 bg-slate-200 dark:bg-slate-600'
                                                    }`}
                                            />
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        {currentStep > 0 && (
                                            <button
                                                onClick={handlePrev}
                                                className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                        )}
                                        <button
                                            onClick={handleNext}
                                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white rounded-full font-bold shadow-md shadow-emerald-500/30 flex items-center gap-1 transition-transform active:scale-95 text-sm border border-emerald-400/30"
                                        >
                                            {currentStep === tutorialSteps.length - 1 ? 'Terminer' : 'Suivant'}
                                            {currentStep < tutorialSteps.length - 1 && <ChevronRight size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
};

export default InteractiveOnboarding;
