import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, LayoutGrid, ShoppingCart, Sparkles, BookOpen, User, ChevronRight, X } from 'lucide-react';

interface OnboardingProps {
    onComplete: () => void;
}

const tutorialSteps = [
    {
        title: "Bienvenue Chef !",
        description: "Je suis ton assistant culinaire. Laisse-moi te montrer comment on va cuisiner ensemble aujourd'hui !",
        icon: <ChefHat size={48} className="text-emerald-500" />,
        mascotAnimation: { y: [0, -10, 0], rotate: [0, 5, -5, 0], transition: { repeat: Infinity, duration: 2 } }
    },
    {
        title: "Ton Stock Intelligent",
        description: "Ajoute tes ingrédients ici. Je te préviendrai quand ils seront sur le point de périmer pour éviter le gaspillage !",
        icon: <LayoutGrid size={48} className="text-blue-500" />,
        mascotAnimation: { scale: [1, 1.1, 1], transition: { repeat: Infinity, duration: 1.5 } }
    },
    {
        title: "Liste de Courses",
        description: "Gère tes achats facilement. Un clic et c'est dans ton frigo virtuel !",
        icon: <ShoppingCart size={48} className="text-purple-500" />,
        mascotAnimation: { x: [-5, 5, -5], transition: { repeat: Infinity, duration: 2 } }
    },
    {
        title: "Ton Assistant IA",
        description: "En panne d'inspiration ? Dis-moi ce qu'il te reste et je t'invente une recette sur mesure en quelques secondes.",
        icon: <Sparkles size={48} className="text-amber-500" />,
        mascotAnimation: { y: [0, -15, 0], transition: { repeat: Infinity, duration: 1.2 } }
    },
    {
        title: "Ton Carnet de Recettes",
        description: "Sauvegarde tes créations préférées pour les refaire quand tu veux.",
        icon: <BookOpen size={48} className="text-rose-500" />,
        mascotAnimation: { rotate: [0, 10, -10, 0], transition: { repeat: Infinity, duration: 2.5 } }
    },
    {
        title: "Prêt à cuisiner ?",
        description: "Fais un tour sur ton profil pour voir tes statistiques et activer les notifications. À tes fourneaux !",
        icon: <User size={48} className="text-indigo-500" />,
        mascotAnimation: { scale: [1, 1.2, 1], rotate: [0, 360], transition: { duration: 1, type: 'spring' } }
    }
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);

    const nextStep = () => {
        if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            onComplete();
        }
    };

    const skipTutorial = () => {
        onComplete();
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 h-[100dvh]">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col items-center p-6 relative border border-slate-200 dark:border-slate-700"
            >
                {/* Passer button */}
                <button
                    onClick={skipTutorial}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors z-10"
                    aria-label="Passer le tutoriel"
                >
                    <X size={20} />
                </button>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center text-center w-full mt-4"
                    >
                        {/* Mascot Container */}
                        <div className="relative w-32 h-32 mb-6 flex items-center justify-center">
                            {/* Glow effect behind mascot */}
                            <motion.div
                                className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl"
                                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                                transition={{ repeat: Infinity, duration: 3 }}
                            />
                            <motion.div
                                animate={tutorialSteps[currentStep].mascotAnimation}
                                className="relative z-10 text-[80px] leading-none drop-shadow-xl select-none"
                            >
                                👨‍🍳
                            </motion.div>
                        </div>

                        {/* Icon for current feature */}
                        <div className="mb-4 bg-slate-50 dark:bg-slate-700/50 p-4 rounded-2xl shadow-sm">
                            {tutorialSteps[currentStep].icon}
                        </div>

                        <h2 className="text-2xl font-bold font-outfit text-slate-800 dark:text-white mb-3">
                            {tutorialSteps[currentStep].title}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 min-h-[80px]">
                            {tutorialSteps[currentStep].description}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* Progress Logic */}
                <div className="w-full mt-8 flex flex-col gap-4">
                    <div className="flex justify-center gap-2 mb-2">
                        {tutorialSteps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-2 rounded-full transition-all duration-300 ${idx === currentStep
                                        ? 'w-6 bg-emerald-500'
                                        : 'w-2 bg-slate-200 dark:bg-slate-600'
                                    }`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={nextStep}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
                    >
                        {currentStep === tutorialSteps.length - 1 ? (
                            "Commencer !"
                        ) : (
                            <>Suivant <ChevronRight size={20} /></>
                        )}
                    </button>

                    <button
                        onClick={skipTutorial}
                        className="w-full py-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium text-sm"
                    >
                        Passer la présentation
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default Onboarding;
