import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, Ingredient, Recipe, ShoppingItem } from '../types';
import {
    chatWithChefStream,
    generateRecipePlan
} from '../services/geminiService';
import { Mic, Send, Bot, Sparkles, Volume2, VolumeX, Globe, Loader2, StopCircle, ChefHat, X, AlertTriangle, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

interface Props {
    ingredients: Ingredient[];
    setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
    setSavedRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
    shoppingList: ShoppingItem[];
    setShoppingList: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
    isActive: boolean;
    messages: ChatMessage[];
    setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
    if (!text) return null;
    const parts = text.split(/\*\*(.*?)\*\*/g);

    return (
        <div className="whitespace-pre-wrap font-normal">
            {parts.map((part, index) => {
                if (index % 2 === 1) {
                    return <span key={index} className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50/50 dark:bg-emerald-900/30 px-0.5 rounded">{part}</span>;
                }
                return <span key={index}>{part}</span>;
            })}
        </div>
    );
};

// --- SUGGESTION MODES DEFINITION ---
// Phrases optimisées pour déclencher les outils à 100%
const SUGGESTION_MODES = [
    {
        id: 'shopping',
        label: 'Liste de Courses',
        icon: '📝',
        prompts: [
            "Ajoute du lait à la liste",
            "Il me faut des oeufs et du beurre",
            "On n'a plus de pain (ajouter liste)",
            "Rajoute des pâtes et du riz"
        ]
    },
    {
        id: 'stock',
        label: 'Gérer le Stock',
        icon: '🧊',
        prompts: [
            "J'ai acheté 500g de viande",
            "Ajoute 1kg de pommes au stock",
            "J'ai fini le lait (retirer du stock)",
            "Mets 6 oeufs dans le frigo"
        ]
    },
    {
        id: 'cooking',
        label: 'Cuisiner',
        icon: '🍳',
        prompts: [
            "Trouve une recette avec mon stock",
            "Idée de repas rapide ce soir",
            "Recette végétarienne simple",
            "Qu'est-ce que je peux cuisiner ?"
        ]
    },
    {
        id: 'plan',
        label: 'Planifier',
        icon: '📅',
        prompts: [
            "Fais-moi un plan de repas pour 4 jours pour 2 personnes",
            "Génère un menu de la semaine avec 50 euros de budget",
            "Meal prep végétarien pour 3 repas"
        ]
    }
];

const RecipeAssistant: React.FC<Props> = ({ ingredients, setIngredients, setSavedRecipes, shoppingList, setShoppingList, isActive, messages, setMessages }) => {
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isThinking, setIsThinking] = useState(false);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [isAutoPlay, setIsAutoPlay] = useState(true);

    // Suggestion Mode State - Default to 0 (Shopping List) per user request
    const [modeIndex, setModeIndex] = useState(0);

    // Error State
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Dictation State (Web Speech API)
    const [isDictating, setIsDictating] = useState(false);
    const recognitionRef = useRef<any>(null);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Audio Queue State (Native SpeechSynthesis)
    const isAutoPlayRef = useRef(isAutoPlay);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- Auto-Detect Mode based on Context ---
    useEffect(() => {
        if (messages.length <= 1) return;

        const lastMsg = messages[messages.length - 1];

        // Analyse simple du texte de l'IA pour ajuster le mode SI ET SEULEMENT SI aucune action n'a été faite.
        // La priorité est donnée aux actions d'outils (voir handleSend)
        if (lastMsg.role === 'model') {
            const textLower = lastMsg.text.toLowerCase();

            // Si l'IA pose une question spécifique, on peut orienter
            if (textLower.includes('courses') || textLower.includes('liste')) {
                // Ne rien faire, laisser l'utilisateur choisir ou rester sur le mode actuel s'il est pertinent
            }
        }
    }, [messages]);

    const cycleMode = (direction: 'next' | 'prev') => {
        setModeIndex(prev => {
            if (direction === 'next') return (prev + 1) % SUGGESTION_MODES.length;
            return (prev - 1 + SUGGESTION_MODES.length) % SUGGESTION_MODES.length;
        });
    };

    // --- DYNAMIC SUGGESTIONS LOGIC ---
    const getSmartSuggestions = () => {
        const lastMsg = messages[messages.length - 1];

        // CAS SPÉCIAL : Une recette vient d'être générée
        if (lastMsg.role === 'model' && (lastMsg.text.includes('Ingrédients') && lastMsg.text.includes('Instructions'))) {
            // On force des suggestions de cuisine/sauvegarde
            return [
                "Sauvegarder cette recette",
                "Ajoute les ingrédients manquants à la liste",
                "Donne-moi une autre recette"
            ];
        }

        // CAS GÉNÉRAL : On obéit au mode sélectionné (List, Stock ou Cuisine)
        return SUGGESTION_MODES[modeIndex].prompts;
    };

    const currentSuggestions = getSmartSuggestions();
    const showSuggestions = inputValue.length === 0 && !isLoading;

    const scrollToBottom = () => {
        if (isActive) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, isPlayingAudio, errorMsg]);

    useEffect(() => {
        isAutoPlayRef.current = isAutoPlay;
        if (!isAutoPlay) {
            // Cut off speech instantly if user mutes
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            setIsPlayingAudio(false);
        }
    }, [isAutoPlay]);

    // Cleanup speech on unmount
    useEffect(() => {
        return () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);

    // --- Audio Recording & Transcription Setup (Web Speech API) ---
    useEffect(() => {
        // @ts-ignore
        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.lang = 'fr-FR'; // User prefers French

            recognition.onstart = () => setIsDictating(true);

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }

                // Append finalized phrases instantly
                if (finalTranscript) {
                    setInputValue(prev => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' ' : '') + finalTranscript);
                    if (textareaRef.current) {
                        textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
                    }
                }
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error', event.error);
                if (event.error === 'not-allowed') {
                    setErrorMsg("Permission microphone refusée. Autorisez le micro dans votre navigateur.");
                }
                setIsDictating(false);
            };

            recognition.onend = () => {
                setIsDictating(false);
            };

            recognitionRef.current = recognition;
        }
    }, []);

    const toggleDictation = () => {
        if (!recognitionRef.current) {
            setErrorMsg("La dictée vocale n'est pas supportée sur ce navigateur (utilisez Chrome, Safari ou Edge).");
            return;
        }

        if (isDictating) {
            recognitionRef.current.stop();
            setIsDictating(false);
        } else {
            setErrorMsg(null);
            try {
                if ("vibrate" in navigator) navigator.vibrate(50);
                recognitionRef.current.start();
            } catch (e) {
                console.error("Erreur démarrage dictée:", e);
            }
        }
    };

    const clearHistory = () => {
        setMessages([{
            id: Date.now().toString(),
            role: 'model',
            text: "Salut Chef ! 👨‍🍳\nJ'ai effacé notre historique. On recommence sur de bonnes bases. Que veux-tu faire ?"
        }]);
    };

    // --- Tool Execution Logic ---
    const handleToolCall = async (name: string, args: any) => {
        if (name === 'ajouterAuStock') {
            const newItems = (args.items || []).map((item: any) => ({
                id: Date.now().toString() + Math.random(),
                name: item.name,
                quantity: item.quantity || '1',
                category: item.category || 'other',
                expiryDate: item.expiryDate || null
            }));
            setIngredients(prev => [...prev, ...newItems]);
            return newItems;
        }

        if (name === 'retirerDuStock') {
            const itemsToRemove = (args.items || []) as string[];
            const normalizedToRemove = itemsToRemove.map(i => i.toLowerCase());
            setIngredients(prev => prev.filter(item => !normalizedToRemove.includes(item.name.toLowerCase())));
            return { removed: itemsToRemove };
        }

        if (name === 'modifierStock') {
            const originalName = args.originalName?.toLowerCase();
            let modifiedItem = null;
            setIngredients(prev => prev.map(item => {
                if (item.name.toLowerCase() === originalName) {
                    const updated = {
                        ...item,
                        name: args.newName || item.name,
                        quantity: args.newQuantity || item.quantity,
                        category: args.newCategory || item.category
                    };
                    modifiedItem = updated;
                    return updated;
                }
                return item;
            }));
            return modifiedItem ? { modified: modifiedItem } : null;
        }

        if (name === 'ajouterAuPanier') {
            const itemsToAdd = (args.items || []) as string[];
            const existingNames = new Set(shoppingList.map(i => i.name.trim().toLowerCase()));
            const newNames = itemsToAdd.filter(name => !existingNames.has(name.trim().toLowerCase()));
            const duplicates = itemsToAdd.filter(name => existingNames.has(name.trim().toLowerCase()));

            const newShoppingItems: ShoppingItem[] = newNames.map(name => ({
                id: Date.now().toString() + Math.random(),
                name: name,
                checked: false
            }));

            if (newShoppingItems.length > 0) {
                setShoppingList(prev => [...prev, ...newShoppingItems]);
            }
            return { added: newNames, duplicates };
        }

        if (name === 'retirerDuPanier') {
            const itemsToRemove = (args.items || []) as string[];
            const normalizedToRemove = itemsToRemove.map(i => i.toLowerCase());

            setShoppingList(prev => prev.filter(item => {
                // Return explicitly those that do NOT match any of the items to remove
                const isMatch = normalizedToRemove.some(rem => item.name.toLowerCase().includes(rem));
                return !isMatch;
            }));
            return { removed: itemsToRemove };
        }

        if (name === 'sauvegarderRecette') {
            const newRecipe: Recipe = {
                id: Date.now().toString(),
                title: args.title,
                description: args.description,
                ingredients: args.ingredients || [],
                steps: args.steps || [],
                prepTime: args.prepTime,
                createdAt: Date.now()
            };
            setSavedRecipes(prev => [newRecipe, ...prev]);
            return newRecipe;
        }

        if (name === 'genererPlanSemaine') {
            const planMeals = args.meals || [];
            const planShoppingList = args.shoppingList || [];
            let addedCount = 0;

            // Add missing items to shopping list
            if (planShoppingList.length > 0) {
                const existingNames = new Set(shoppingList.map(i => i.name.trim().toLowerCase()));
                const newNames = planShoppingList.filter((name: string) => !existingNames.has(name.trim().toLowerCase()));

                const newShoppingItems: ShoppingItem[] = newNames.map((itemName: string) => ({
                    id: Date.now().toString() + Math.random(),
                    name: itemName,
                    checked: false
                }));
                if (newShoppingItems.length > 0) {
                    setShoppingList(prev => [...prev, ...newShoppingItems]);
                    addedCount = newShoppingItems.length;
                }
            }

            return {
                plan: planMeals,
                shoppingListAdded: planShoppingList,
                addedCount: addedCount
            };
        }

        return null;
    };

    const queueAudioChunk = (text: string) => {
        if (!isAutoPlayRef.current || !text.trim() || !('speechSynthesis' in window)) return;

        // Clean up markdown specifically for TTS reading (remove asterisks)
        const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '').trim();
        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'fr-FR';

        // Try to select a "premium" or "natural" sounding voice if available
        const voices = window.speechSynthesis.getVoices();
        const frenchVoices = voices.filter(v => v.lang.startsWith('fr'));
        const bestVoice = frenchVoices.find(v =>
            v.name.toLowerCase().includes('premium') ||
            v.name.toLowerCase().includes('google') ||
            v.name.toLowerCase().includes('natural') ||
            v.name.toLowerCase().includes('online') ||
            v.name.includes('Thomas') ||
            v.name.includes('Marie') ||
            v.name.includes('Audrey') ||
            v.name.includes('Aurelie')
        ) || frenchVoices[0];

        if (bestVoice) {
            utterance.voice = bestVoice;
        }

        utterance.rate = 1.05; // Slightly slower than 1.1 for better natural pronunciation
        utterance.pitch = 1.0;

        utterance.onstart = () => {
            setIsPlayingAudio(true);
        };

        utterance.onend = () => {
            // Check if this was the last utterance in the queue
            if (!window.speechSynthesis.pending) {
                setIsPlayingAudio(false);
            }
        };

        utterance.onerror = (e) => {
            console.warn("Speech synthesis error", e);
            if (!window.speechSynthesis.pending) setIsPlayingAudio(false);
        };

        window.speechSynthesis.speak(utterance);
    };

    const handleSend = async (manualText?: string) => {
        const textToSend = manualText || inputValue;
        if (!textToSend.trim()) return;

        setErrorMsg(null);

        const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: textToSend };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        // Clear previous native audio queue if interrupting
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            setIsPlayingAudio(false);
        }

        try {
            const complexKeywords = ['plan', 'semaine', 'diner complet', 'menu complet'];
            const isComplex = complexKeywords.some(k => textToSend.toLowerCase().includes(k));

            if (isComplex) {
                setIsThinking(true);
                const resultText = await generateRecipePlan(ingredients, userMsg.text);
                setIsThinking(false);
                const aiMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: resultText };
                setMessages(prev => [...prev, aiMsg]);
                queueAudioChunk(resultText);

            } else {
                const history = messages.map(m => ({ role: m.role, parts: [{ text: m.text }] }));

                const aiMsgId = (Date.now() + 1).toString();
                setMessages(prev => [...prev, { id: aiMsgId, role: 'model', text: '' }]);

                let accumulatedText = "";
                let sentenceBuffer = "";
                let firstChunkProcessed = false;
                let allFunctionCalls: any[] = [];
                let groundingUrls: string[] = [];

                // Remove the useSearch parameter as the feature has been removed
                const stream = chatWithChefStream(history, userMsg.text, ingredients, shoppingList, false);

                for await (const chunk of stream) {
                    const textChunk = chunk.text;

                    if (textChunk) {
                        accumulatedText += textChunk;
                        sentenceBuffer += textChunk;

                        if (!firstChunkProcessed && sentenceBuffer.length > 25) {
                            const lastSpace = sentenceBuffer.lastIndexOf(' ');
                            if (lastSpace > 0) {
                                const fastChunk = sentenceBuffer.substring(0, lastSpace);
                                queueAudioChunk(fastChunk);
                                sentenceBuffer = sentenceBuffer.substring(lastSpace + 1);
                                firstChunkProcessed = true;
                            }
                        }

                        const sentenceRegex = /^(.+?([.!?]\s|[\n]+|[:]\s))/;
                        let match;
                        while ((match = sentenceBuffer.match(sentenceRegex))) {
                            const fullSentence = match[1];
                            if (fullSentence.trim().length > 0) {
                                queueAudioChunk(fullSentence);
                                sentenceBuffer = sentenceBuffer.substring(fullSentence.length);
                                firstChunkProcessed = true;
                            } else {
                                sentenceBuffer = sentenceBuffer.substring(fullSentence.length);
                            }
                        }

                        if (sentenceBuffer.length > 150) {
                            const lastSpace = sentenceBuffer.lastIndexOf(' ');
                            if (lastSpace > 0) {
                                const chunk = sentenceBuffer.substring(0, lastSpace);
                                queueAudioChunk(chunk);
                                sentenceBuffer = sentenceBuffer.substring(lastSpace + 1);
                                firstChunkProcessed = true;
                            }
                        }

                        const textToRender = accumulatedText;
                        setTimeout(() => {
                            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: textToRender } : m));
                        }, 100);
                    }

                    const calls = chunk.candidates?.[0]?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);
                    if (calls && calls.length > 0) allFunctionCalls = [...allFunctionCalls, ...calls];

                    const gChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                    if (gChunks) {
                        gChunks.forEach((c: any) => {
                            if (c.web?.uri) groundingUrls.push(c.web.uri);
                        });
                    }
                }

                if (sentenceBuffer.trim()) {
                    queueAudioChunk(sentenceBuffer);
                }

                setTimeout(() => {
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText } : m));
                }, 100);

                if (groundingUrls.length > 0) {
                    setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, groundingUrls: [...new Set(groundingUrls)] } : m));
                }

                if (allFunctionCalls.length > 0) {
                    let toolOutput = "";
                    for (const call of allFunctionCalls) {
                        const result = await handleToolCall(call.name, call.args);
                        if (result) {
                            if (call.name === 'ajouterAuStock') {
                                const itemNames = result.map((i: any) => i.name).join(', ');
                                toolOutput += `\n\n✅ Ajouté : **${itemNames}** au stock.`;
                                queueAudioChunk("C'est fait, j'ai ajouté ça au stock.");
                                setModeIndex(1); // Force Stock Mode
                            } else if (call.name === 'retirerDuStock') {
                                const itemNames = result.removed.join(', ');
                                toolOutput += `\n\n🗑️ Retiré : **${itemNames}** du stock.`;
                                queueAudioChunk("C'est noté, j'ai retiré ces articles.");
                                setModeIndex(1); // Force Stock Mode
                            } else if (call.name === 'modifierStock') {
                                if (result.modified) {
                                    toolOutput += `\n\n✏️ Modifié : **${result.modified.name}** (${result.modified.quantity}).`;
                                    queueAudioChunk(`Stock mis à jour pour ${result.modified.name}.`);
                                }
                                setModeIndex(1); // Force Stock Mode
                            } else if (call.name === 'ajouterAuPanier') {
                                let outputText = "";
                                if (result.added && result.added.length > 0) {
                                    outputText += `\n\n🛒 Ajouté liste : **${result.added.join(', ')}**.`;
                                }
                                if (result.duplicates && result.duplicates.length > 0) {
                                    outputText += `\n\n⚠️ Déjà dans la liste : **${result.duplicates.join(', ')}**.`;
                                }
                                toolOutput += outputText || "\n\nPas d'articles ajoutés.";
                                queueAudioChunk("C'est noté pour la liste de courses.");
                                setModeIndex(0); // Force Shopping List Mode
                            } else if (call.name === 'retirerDuPanier') {
                                const items = result.removed.join(', ');
                                toolOutput += `\n\n🗑️ Retiré liste : **${items}**.`;
                                queueAudioChunk("J'ai retiré ces articles de votre liste de courses.");
                                setModeIndex(0); // Force Shopping List Mode
                            } else if (call.name === 'sauvegarderRecette') {
                                toolOutput += `\n\n📖 Recette **${result.title}** sauvegardée !`;
                                queueAudioChunk("J'ai sauvegardé cette recette.");
                                setModeIndex(2); // Stay on Cooking Mode
                            } else if (call.name === 'genererPlanSemaine') {
                                toolOutput += `\n\n📅 **Plan de la semaine généré !**\n\n`;
                                result.plan.forEach((meal: any) => {
                                    toolOutput += `- **${meal.day} (${meal.type})** : ${meal.recipeName}\n`;
                                });
                                toolOutput += `\n🛒 **${result.addedCount} articles ajoutés** à votre liste de courses.`;
                                queueAudioChunk("J'ai généré votre plan de la semaine et ajouté ce qu'il vous manquait à votre liste de courses.");
                                setModeIndex(0); // Switch to Shopping view
                            }
                        }
                    }
                    if (toolOutput) {
                        accumulatedText += toolOutput;
                        setTimeout(() => {
                            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: accumulatedText } : m));
                        }, 100);
                    }
                } else {
                    // S'il n'y a pas eu d'appel d'outil, mais que le texte ressemble à une recette, on passe en mode cuisine
                    if (accumulatedText.includes('Ingrédients') && accumulatedText.includes('Instructions')) {
                        setModeIndex(2);
                    }
                }
            }
        } catch (error: any) {
            console.error(error);
            let msg = "Une erreur est survenue. Vérifiez votre connexion.";
            if (error.message?.includes("API_KEY_MISSING") || error.message?.includes("403") || error.message?.includes("PERMISSION_DENIED")) {
                msg = "⚠️ Clé API invalide ou bloquée. Allez dans le PROFIL pour en ajouter une nouvelle.";
            }
            setErrorMsg(msg);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: msg }]);
        } finally {
            setTimeout(() => setIsLoading(false), 200);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            {/* Header */}
            <div className="pt-10 pb-4 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center z-20 shrink-0 shadow-sm transition-colors duration-300">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <ChefHat size={20} />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg text-slate-800 dark:text-white leading-tight">Assistant</h2>
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isLoading ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-500'}`}></span>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium tracking-wide">GEMINI CHEF</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={clearHistory}
                        title="Effacer l'historique"
                        className="p-2.5 rounded-xl transition-all cursor-pointer bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                    >
                        <Trash2 size={18} />
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsAutoPlay(!isAutoPlay)}
                        className={`p-2.5 rounded-xl transition-all cursor-pointer ${isAutoPlay ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-400 hover:text-slate-600'}`}
                    >
                        {isAutoPlay ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth">

                {/* Error Banner */}
                {errorMsg && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex gap-3 animate-in slide-in-from-top-4 fade-in">
                        <AlertTriangle size={20} className="text-red-500 shrink-0" />
                        <p className="text-sm text-red-700 dark:text-red-300 font-medium">{errorMsg}</p>
                    </div>
                )}

                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>

                        {msg.role === 'model' && (
                            <div className={`w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-2 shadow-sm border border-emerald-200/50 dark:border-emerald-800 ${isPlayingAudio && msg.id === messages[messages.length - 1].id ? 'animate-pulse' : ''}`}>
                                <Bot size={16} className="text-emerald-700 dark:text-emerald-400" />
                            </div>
                        )}

                        <div className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm leading-relaxed ${msg.role === 'user'
                            ? 'bg-emerald-600 text-white rounded-tr-sm shadow-emerald-200 dark:shadow-none'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-tl-sm shadow-slate-200/50 dark:shadow-none'
                            }`}>
                            <FormattedText text={msg.text} />

                            {msg.groundingUrls && msg.groundingUrls.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-100/50 dark:border-gray-700/50">
                                    <p className="text-[10px] font-bold opacity-70 mb-2 flex items-center gap-1 uppercase tracking-wider">
                                        <Globe size={10} /> Sources
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {msg.groundingUrls.map((url, i) => (
                                            <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs bg-black/5 dark:bg-white/10 hover:bg-black/10 px-2 py-1 rounded transition truncate max-w-[150px]">
                                                Source {i + 1}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start gap-3 animate-in fade-in">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                            <Bot size={16} className="text-emerald-700 dark:text-emerald-400" />
                        </div>
                        <div className="bg-white dark:bg-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
                            {isThinking ? (
                                <>
                                    <Sparkles size={16} className="text-purple-500 animate-spin" />
                                    <span className="bg-gradient-to-r from-purple-500 to-emerald-500 bg-clip-text text-transparent font-semibold text-xs">Réflexion intense...</span>
                                </>
                            ) : (
                                <>
                                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                                    <span className="text-xs font-medium">Le chef écrit...</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Input Area */}
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-30 shrink-0 pb-safe relative transition-all border-t border-slate-100 dark:border-slate-800/50">

                {/* TOOLBAR: Mode Switcher & Web Toggle */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1">

                    {/* Space explicitly reserved for balance (was Web Toggle) */}
                    <div className="w-8"></div>

                    {/* Mode Navigator */}
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full p-1 shadow-inner">
                        <button
                            onClick={() => cycleMode('prev')}
                            className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 transition-all active:scale-95"
                        >
                            <ChevronLeft size={14} />
                        </button>
                        <div className="flex items-center gap-1.5 px-2 min-w-[110px] justify-center">
                            <span className="text-sm">{SUGGESTION_MODES[modeIndex].icon}</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{SUGGESTION_MODES[modeIndex].label}</span>
                        </div>
                        <button
                            onClick={() => cycleMode('next')}
                            className="p-1.5 rounded-full hover:bg-white dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 transition-all active:scale-95"
                        >
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="w-8"></div> {/* Spacer for balance */}
                </div>

                {/* Suggestions Chips */}
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showSuggestions ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                    <div className="flex items-stretch gap-2 px-2 py-2">
                        {currentSuggestions.slice(0, 3).map((suggestion, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handleSend(suggestion)}
                                className="flex-1 min-w-0 text-[10px] px-2 py-2 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 whitespace-normal text-center leading-tight hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all font-medium flex flex-col items-center justify-center gap-1 shadow-sm cursor-pointer group"
                            >
                                <span className="line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{suggestion}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 pt-1">
                    <div className="flex gap-2 items-end mt-2">
                        <button
                            type="button"
                            onClick={toggleDictation}
                            // Visual Feedback
                            className={`p-3.5 rounded-full transition-all active:scale-95 flex-shrink-0 flex items-center justify-center shadow-sm cursor-pointer duration-75 ${isDictating
                                ? 'bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                        >
                            {isDictating ? <StopCircle size={22} /> : <Mic size={22} />}
                        </button>

                        <div className={`flex-1 min-w-0 flex items-center bg-white dark:bg-slate-800 rounded-[1.5rem] border transition-colors duration-200 ${isDictating
                            ? 'border-rose-500'
                            : errorMsg
                                ? 'border-red-300'
                                : 'border-slate-200 dark:border-slate-700 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20'
                            }`}>
                            {isDictating && (
                                <div className="pl-3.5 flex items-center justify-center shrink-0">
                                    <div className="relative flex h-2.5 w-2.5">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                                    </div>
                                </div>
                            )}

                            <textarea
                                ref={textareaRef}
                                value={inputValue}
                                onChange={(e) => { setErrorMsg(null); setInputValue(e.target.value); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={isDictating ? "Je vous écoute..." : (errorMsg ? "Erreur vocale !" : "Demandez une recette...")}
                                readOnly={isDictating}
                                rows={1}
                                className="flex-1 p-3.5 max-h-32 min-h-[52px] bg-transparent outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-medium resize-none transition-all"
                            />

                            {inputValue.trim() && !isDictating && (
                                <button
                                    type="button"
                                    onClick={() => setInputValue('')}
                                    className="p-2 mr-1 text-slate-300 hover:text-slate-500 cursor-pointer shrink-0"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => handleSend()}
                            disabled={isLoading || !inputValue.trim() || isDictating}
                            className="bg-emerald-600 text-white p-3.5 rounded-full hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-emerald-200 dark:shadow-none flex-shrink-0 cursor-pointer"
                        >
                            <Send size={20} className={isLoading ? 'opacity-0' : 'opacity-100'} />
                            {isLoading && <Loader2 size={20} className="absolute animate-spin" />}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
          .no-scrollbar::-webkit-scrollbar { display: none; }
          .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
        </div>
    );
};

export default RecipeAssistant;