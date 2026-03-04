import React, { useState, useRef } from 'react';
import { Ingredient, ShoppingItem, ShoppingListTemplate } from '../types';
import { Check, Plus, Trash2, LayoutTemplate, Save, X, Pencil, ChevronDown, ShoppingCart, Package, AlertTriangle, Wand2, Loader2 } from 'lucide-react';
import { scanRecipeAndDetectMissing } from '../services/geminiService';

interface Props {
    items: ShoppingItem[];
    setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
    ingredients: Ingredient[];
    onAddToStock: (items: ShoppingItem[]) => void;
}

const DEFAULT_TEMPLATES: ShoppingListTemplate[] = [
    { id: '1', name: 'Soirée Italienne', items: ['Pâtes fraîches', 'Sauce tomate', 'Parmesan', 'Ail', 'Basilic'] },
    { id: '2', name: 'Brunch Dimanche', items: ['Oeufs', 'Bacon', 'Pain de campagne', 'Jus d\'orange', 'Café'] },
    { id: '3', name: 'Essentiels', items: ['Lait', 'Beurre', 'Pain', 'Riz', 'Oignons'] },
];

const ShoppingList: React.FC<Props> = ({ items, setItems, ingredients, onAddToStock }) => {
    const [newItemName, setNewItemName] = useState('');
    const [showTemplates, setShowTemplates] = useState(false);
    const [templates, setTemplates] = useState<ShoppingListTemplate[]>(DEFAULT_TEMPLATES);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editItemName, setEditItemName] = useState('');
    const [duplicateError, setDuplicateError] = useState<string | null>(null);

    // Custom Modal State
    const [duplicateWarning, setDuplicateWarning] = useState<{
        show: boolean;
        names: string;
        pendingItemsToTransfer: ShoppingItem[];
        existingNamesInStock: Set<string>;
    } | null>(null);

    // Magic Scan State
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleMagicScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsScanning(true);
        try {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async () => {
                const base64String = (reader.result as string).split(',')[1];
                const inventoryText = ingredients.map(i => `${i.quantity} ${i.name}`).join(', ');

                const missing = await scanRecipeAndDetectMissing(base64String, inventoryText);

                if (missing.length > 0) {
                    // Filter duplicates from shopping lists
                    const existingNames = new Set(items.map(i => i.name.trim().toLowerCase()));
                    const newItems = missing
                        .filter(m => !existingNames.has(m.name.trim().toLowerCase()))
                        .map(m => ({
                            id: Date.now().toString() + Math.random(),
                            name: `${m.name} (${m.quantity})`,
                            checked: false
                        }));

                    if (newItems.length > 0) {
                        setItems(prev => [...newItems, ...prev]);
                    }
                }
                setIsScanning(false);
            };
        } catch (error) {
            console.error("Scan error", error);
            setIsScanning(false);
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const addItem = (name: string) => {
        if (!name.trim()) return;

        // Check for duplicate (case-insensitive)
        const normalizedName = name.trim().toLowerCase();
        const isDuplicate = items.some(i => i.name.toLowerCase() === normalizedName);

        if (isDuplicate) {
            setDuplicateError(`"${name.trim()}" est déjà dans votre liste.`);
            // Auto hide after 3 seconds
            setTimeout(() => setDuplicateError(null), 3000);
            return;
        }

        const item: ShoppingItem = {
            id: Date.now().toString() + Math.random(),
            name: name.trim(),
            checked: false,
        };
        setItems(prev => [...prev, item]);
        setNewItemName('');
        setDuplicateError(null);
    };

    const toggleCheck = (id: string) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    };

    const removeItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const startEditingItem = (item: ShoppingItem, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingItemId(item.id);
        setEditItemName(item.name);
    };

    const saveEditItem = () => {
        if (!editingItemId || !editItemName.trim()) return;
        setItems(prev => prev.map(i => i.id === editingItemId ? { ...i, name: editItemName } : i));
        setEditingItemId(null);
    };

    const cancelEditItem = () => {
        setEditingItemId(null);
    };

    const applyTemplate = (template: ShoppingListTemplate) => {
        // Prevent adding duplicates from templates
        const existingNames = new Set(items.map(i => i.name.trim().toLowerCase()));

        const newItems = template.items
            .filter(name => !existingNames.has(name.trim().toLowerCase()))
            .map(name => ({
                id: Date.now().toString() + Math.random(),
                name,
                checked: false
            }));

        if (newItems.length > 0) {
            setItems(prev => [...prev, ...newItems]);
        }

        setShowTemplates(false);
        setExpandedId(null);
    };

    const saveCurrentAsTemplate = () => {
        if (!newTemplateName.trim() || items.length === 0) return;
        const newTemplate: ShoppingListTemplate = {
            id: Date.now().toString(),
            name: newTemplateName,
            items: items.map(i => i.name),
            isCustom: true
        };
        setTemplates(prev => [...prev, newTemplate]);
        setNewTemplateName('');
        setIsCreatingTemplate(false);
    };

    const deleteTemplate = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setTemplates(prev => prev.filter(t => t.id !== id));
        if (editingId === id) setEditingId(null);
        if (expandedId === id) setExpandedId(null);
    };

    const startEditing = (t: ShoppingListTemplate, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(t.id);
        setEditName(t.name);
    };

    const saveEditName = (id: string) => {
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, name: editName } : t));
        setEditingId(null);
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    // --- Logic for Transfer ---
    const checkedItems = items.filter(i => i.checked);

    const handleTransferToStock = () => {
        let itemsToTransfer = checkedItems;
        if (itemsToTransfer.length === 0) return;

        // Detection des doublons avec le stock actuel
        const existingNamesInStock = new Set(ingredients.map(i => i.name.toLowerCase()));
        const duplicatedItems = itemsToTransfer.filter(ci => existingNamesInStock.has(ci.name.toLowerCase()));

        if (duplicatedItems.length > 0) {
            const names = duplicatedItems.map(d => d.name).join(', ');
            setDuplicateWarning({
                show: true,
                names,
                pendingItemsToTransfer: itemsToTransfer,
                existingNamesInStock
            });
            return; // Wait for modal action
        }

        executeTransfer(itemsToTransfer);
    };

    const flexTransferToStock = (merge: boolean) => {
        if (!duplicateWarning) return;
        let finalItems = duplicateWarning.pendingItemsToTransfer;

        if (!merge) {
            finalItems = finalItems.filter(ci => !duplicateWarning.existingNamesInStock.has(ci.name.toLowerCase()));
        }

        executeTransfer(finalItems);
        setDuplicateWarning(null);
    };

    const executeTransfer = (itemsToTransfer: ShoppingItem[]) => {
        if (itemsToTransfer.length > 0) {
            onAddToStock(itemsToTransfer);
        }

        // Remove transferred items from list
        setItems(prev => prev.filter(i => {
            return !itemsToTransfer.some(transferred => transferred.id === i.id);
        }));
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative transition-colors duration-300">
            {/* Header */}
            <div className="pt-10 pb-6 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm z-20 transition-colors duration-300 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white">Ma Liste</h1>
                    <p className="text-slate-400 dark:text-slate-500 text-sm font-medium mt-0.5">{items.filter(i => !i.checked).length} articles à acheter</p>
                </div>
                <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className={`p-2.5 rounded-xl transition-all border ${showTemplates
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    title="Gérer les modèles"
                >
                    <LayoutTemplate size={20} />
                </button>
            </div>

            {/* Templates Panel (Collapsible) */}
            <div
                className={`bg-slate-100/50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-hidden transition-all duration-500 ease-in-out z-10 ${showTemplates ? 'max-h-[70vh] opacity-100' : 'max-h-0 opacity-0'}`}
            >
                <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Vos Modèles
                        </h3>
                        <button
                            onClick={() => setIsCreatingTemplate(!isCreatingTemplate)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${isCreatingTemplate ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300' : 'bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 shadow-sm'}`}
                        >
                            <Save size={12} /> Nouveau
                        </button>
                    </div>

                    {isCreatingTemplate && (
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-emerald-100 dark:border-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-medium">Sauvegarder la liste actuelle ({items.length} articles) :</p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Nom du modèle..."
                                    className="flex-1 p-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white transition-all"
                                    value={newTemplateName}
                                    onChange={(e) => setNewTemplateName(e.target.value)}
                                />
                                <button
                                    onClick={saveCurrentAsTemplate}
                                    className="bg-emerald-600 text-white px-4 rounded-lg text-sm font-bold shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                    disabled={items.length === 0 || !newTemplateName.trim()}
                                >
                                    OK
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar pb-2">
                        {templates.map(t => (
                            <div key={t.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm transition-all hover:shadow-md shrink-0">
                                {/* Card Header */}
                                <div
                                    className="flex items-center p-3 justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                    onClick={() => toggleExpand(t.id)}
                                >
                                    {editingId === t.id ? (
                                        <div className="flex items-center gap-2 flex-1 mr-2" onClick={(e) => e.stopPropagation()}>
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="flex-1 p-1.5 border border-emerald-300 rounded text-sm focus:ring-1 focus:ring-emerald-500 outline-none bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white"
                                                autoFocus
                                                onKeyDown={(e) => e.key === 'Enter' && saveEditName(t.id)}
                                            />
                                            <button onClick={() => saveEditName(t.id)} className="p-1.5 bg-emerald-100 text-emerald-700 rounded"><Check size={14} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 flex-1 overflow-hidden">
                                            <div className={`p-1.5 rounded-lg ${expandedId === t.id ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                                                <LayoutTemplate size={16} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-slate-700 dark:text-slate-200 text-sm font-bold truncate">{t.name}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">
                                                    {t.items.length} articles
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1">
                                        {!editingId && (
                                            <>
                                                <button
                                                    onClick={(e) => startEditing(t, e)}
                                                    className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => deleteTemplate(t.id, e)}
                                                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                                <div className={`p-2 text-slate-300 transition-transform duration-300 ${expandedId === t.id ? 'rotate-180 text-emerald-500' : ''}`}>
                                                    <ChevronDown size={16} />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Card Body (Accordion) */}
                                <div
                                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${expandedId === t.id ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                                >
                                    <div className="overflow-hidden">
                                        <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700/50">
                                            <div className="flex flex-wrap gap-1.5 mb-4">
                                                {t.items.map((item, idx) => (
                                                    <span key={idx} className="text-[10px] px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-600 dark:text-slate-300 shadow-sm">
                                                        {item}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex">
                                                <button
                                                    onClick={() => applyTemplate(t)}
                                                    className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-sm shadow-emerald-200 dark:shadow-none active:scale-95 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Plus size={16} /> Ajouter à ma liste
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main List */}
            <div className="flex-1 overflow-y-auto relative scroll-smooth bg-slate-50 dark:bg-slate-900">

                {/* Sticky Input */}
                <div className="sticky top-0 z-10 px-4 py-3 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800">
                    <div className={`flex gap-2 items-center bg-white dark:bg-slate-800 p-1.5 rounded-2xl border transition-all shadow-sm ${duplicateError ? 'border-amber-400 dark:border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500'}`}>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isScanning}
                            className="p-2.5 bg-gradient-to-tr from-amber-400 to-orange-500 text-white rounded-xl shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-70 flex-shrink-0"
                            title="Scan Magique de Recette"
                        >
                            {isScanning ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} />}
                        </button>
                        <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleMagicScan}
                            className="hidden"
                        />

                        <input
                            type="text"
                            value={newItemName}
                            onChange={(e) => {
                                setNewItemName(e.target.value);
                                if (duplicateError) setDuplicateError(null);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && addItem(newItemName)}
                            placeholder="Ajouter un article (ex: Lait)"
                            className="flex-1 px-3 py-2 bg-transparent outline-none text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 text-sm"
                        />
                        <button
                            onClick={() => addItem(newItemName)}
                            className={`p-2.5 rounded-xl transition shadow-md active:scale-95 ${duplicateError ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-200 dark:shadow-none' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 dark:shadow-none'}`}
                        >
                            <Plus size={20} />
                        </button>
                    </div>
                    {duplicateError && (
                        <div className="absolute top-16 left-4 right-4 flex items-center justify-center gap-1.5 text-amber-600 dark:text-amber-400 text-xs font-bold bg-amber-50 dark:bg-amber-900/40 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-800/50 shadow-sm animate-in slide-in-from-top-2 duration-300">
                            <AlertTriangle size={14} />
                            {duplicateError}
                        </div>
                    )}
                </div>

                {/* List Content */}
                <div className="p-4 space-y-2.5 pb-44">
                    {items.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-600 animate-in fade-in zoom-in-95">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-300 dark:text-slate-500">
                                <ShoppingCart size={28} />
                            </div>
                            <p className="font-semibold text-slate-500 dark:text-slate-400">Votre liste est vide</p>
                            <p className="text-xs text-center mt-1 text-slate-400 max-w-[200px]">Utilisez les modèles ou ajoutez des articles manuellement.</p>
                        </div>
                    )}

                    {items.map((item) => (
                        <div
                            key={item.id}
                            className={`group flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 animate-in slide-in-from-bottom-2 ${item.checked
                                ? 'bg-slate-50/80 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800 opacity-60'
                                : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-100 dark:hover:border-emerald-900'
                                }`}
                        >
                            {editingItemId === item.id ? (
                                <div className="flex items-center gap-2 flex-1 w-full animate-in fade-in" onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="text"
                                        value={editItemName}
                                        onChange={(e) => setEditItemName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && saveEditItem()}
                                        className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500 text-sm text-slate-800 dark:text-white"
                                        autoFocus
                                    />
                                    <button onClick={saveEditItem} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors active:scale-95 shadow-sm"><Check size={16} /></button>
                                    <button onClick={cancelEditItem} className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors active:scale-95"><X size={16} /></button>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-4 flex-1 cursor-pointer select-none" onClick={() => toggleCheck(item.id)}>
                                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 ${item.checked
                                            ? 'bg-emerald-500 border-emerald-500 scale-105'
                                            : 'border-slate-300 dark:border-slate-600 group-hover:border-emerald-400'
                                            }`}>
                                            <Check size={14} className={`text-white transition-transform duration-200 ${item.checked ? 'scale-100' : 'scale-0'}`} />
                                        </div>
                                        <span className={`text-sm font-medium transition-all ${item.checked ? 'text-slate-400 dark:text-slate-600 line-through decoration-slate-300 dark:decoration-slate-600' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {item.name}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button
                                            onClick={(e) => startEditingItem(item, e)}
                                            className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-blue-500 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all active:scale-90"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all active:scale-90"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* FLOATING ACTION BUTTON FOR TRANSFER */}
            {checkedItems.length > 0 && (
                <div className="absolute bottom-24 left-0 right-0 px-4 flex justify-center z-30 animate-in slide-in-from-bottom-6 fade-in duration-300 pointer-events-none">
                    <button
                        onClick={handleTransferToStock}
                        className="pointer-events-auto bg-white dark:bg-slate-800 text-slate-800 dark:text-white px-5 py-3 rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 dark:border-slate-700 flex items-center gap-4 active:scale-95 transition-all hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(0,0,0,0.16)]"
                    >
                        <div className="bg-[#10b981] text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">
                            {checkedItems.length}
                        </div>
                        <span className="font-bold text-[15px] pt-0.5 tracking-tight">Ajouter au Stock</span>
                        <Package size={20} className="text-slate-700 dark:text-slate-300" strokeWidth={2.5} />
                    </button>
                </div>
            )}

            {/* DUPLICATE WARNING MODAL */}
            {duplicateWarning?.show && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-200 p-6 flex flex-col items-center">
                        <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4 text-amber-500">
                            <AlertTriangle size={32} />
                        </div>
                        <h3 className="font-bold text-lg text-slate-800 dark:text-white text-center mb-2">Produits en double</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6">
                            Vous avez déjà ces produits dans votre frigo :<br />
                            <span className="font-bold text-slate-700 dark:text-slate-300">{duplicateWarning.names}</span>
                        </p>

                        <div className="w-full flex flex-col gap-3">
                            <button
                                onClick={() => flexTransferToStock(true)}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                <Plus size={18} /> Additionner les quantités
                            </button>
                            <button
                                onClick={() => flexTransferToStock(false)}
                                className="w-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2"
                            >
                                Ne garder que la nouveauté
                            </button>
                            <button
                                onClick={() => setDuplicateWarning(null)}
                                className="w-full text-slate-400 hover:text-slate-500 font-bold py-2 mt-2 transition-colors text-sm"
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
      `}</style>
        </div>
    );
};

export default ShoppingList;