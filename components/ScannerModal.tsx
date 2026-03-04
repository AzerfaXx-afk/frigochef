import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { fetchProductFromBarcode, analyzeReceipt } from '../services/geminiService';
import { Ingredient } from '../types';
import { X, Camera, Barcode, Loader2, Image as ImageIcon, CheckCircle } from 'lucide-react';

interface Props {
    onClose: () => void;
    onItemsDetected: (items: Partial<Ingredient>[]) => void;
}

const ScannerModal: React.FC<Props> = ({ onClose, onItemsDetected }) => {
    const [mode, setMode] = useState<'selection' | 'barcode' | 'vision'>('selection');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Pour le scanner de code-barre
    useEffect(() => {
        if (mode === 'barcode') {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { fps: 10, qrbox: { width: 250, height: 150 } },
                false
            );

            scanner.render(
                async (decodedText) => {
                    scanner.pause(true); // Pause scanning once we find something
                    setIsLoading(true);
                    setLoadingText('Recherche du produit...');
                    try {
                        const product = await fetchProductFromBarcode(decodedText);
                        if (product) {
                            onItemsDetected([product]);
                        } else {
                            alert("Produit introuvable !");
                            scanner.resume();
                        }
                    } catch (e) {
                        console.error(e);
                        scanner.resume();
                    } finally {
                        setIsLoading(false);
                    }
                },
                (error) => {
                    // just ignore frequent scan errs
                }
            );

            return () => {
                scanner.clear().catch(console.error);
            };
        }
    }, [mode, onItemsDetected]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setIsLoading(true);
            setLoadingText('Chef Gemini analyse la photo...');
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    const base64Image = (reader.result as string).split(',')[1];
                    const items = await analyzeReceipt(base64Image);
                    if (items.length > 0) {
                        onItemsDetected(items);
                    } else {
                        alert("Aucun ingrédient détecté sur l'image.");
                    }
                } catch (error) {
                    console.error(error);
                    alert("Erreur lors de l'analyse IA.");
                } finally {
                    setIsLoading(false);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-200">

                {/* HEADER */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="font-bold text-slate-800 dark:text-white">Ajout Magique IA</h3>
                    <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* CONTENT */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-10 gap-4">
                            <Loader2 size={48} className="text-emerald-500 animate-spin" />
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 animate-pulse">{loadingText}</p>
                        </div>
                    ) : mode === 'selection' ? (
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={() => setMode('barcode')}
                                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-500 dark:hover:border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 transition-all text-left"
                            >
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-800 rounded-full flex items-center justify-center shrink-0">
                                    <Barcode size={24} className="text-emerald-600 dark:text-emerald-300" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">Scanner Code-barre</h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">Scannez un emballage pour l'ajouter avec OpenFoodFacts en 1 seconde.</p>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    setMode('vision');
                                    fileInputRef.current?.click();
                                }}
                                className="flex items-center gap-4 p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-500 dark:hover:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10 transition-all text-left"
                            >
                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-800 rounded-full flex items-center justify-center shrink-0">
                                    <Camera size={24} className="text-indigo-600 dark:text-indigo-300" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 dark:text-white">Vision IA (Frigo / Ticket)</h4>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">Prenez en photo votre frigo ou votre ticket de caisse. Gemini extrait tout.</p>
                                </div>
                            </button>

                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleImageUpload}
                            />
                        </div>
                    ) : mode === 'barcode' ? (
                        <div className="flex flex-col gap-4">
                            <div id="reader" className="w-full bg-slate-100 dark:bg-slate-900 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700"></div>
                            <button
                                onClick={() => setMode('selection')}
                                className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white text-center py-2"
                            >
                                Retour
                            </button>
                        </div>
                    ) : (
                        <div className="text-center">
                            <p className="text-sm text-slate-500">Ouverture de la galerie...</p>
                            <button
                                onClick={() => setMode('selection')}
                                className="text-xs font-bold text-emerald-500 mt-4"
                            >
                                Retour
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default ScannerModal;
