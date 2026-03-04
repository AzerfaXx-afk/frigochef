/// <reference types="vite/client" />
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Ingredient, ShoppingItem, MissingIngredientResult, WeeklyPlan, UserProfile } from "../types";

// 1. Initialisation
const ai = new GoogleGenAI({
    apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

// Modèle stable
const MODEL_NAME = 'gemini-2.5-flash';

// --- FONCTION VISION ---
export const scanIngredientsFromImage = async (base64Image: string): Promise<Partial<Ingredient>[]> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Tu es un expert culinaire et gestionnaire de stock. Analyse cette image et liste tous les ingrédients alimentaires ou produits visibles. 
                        
Règles strictes de sortie :
1. Renvoie UNIQUEMENT un tableau JSON valide.
2. N'ajoute AUCUN texte avant ou après le JSON.
3. N'utilise pas de backticks \`\`\`json ou autres marqueurs de code.

Chaque objet dans le tableau doit avoir cette structure exacte :
{
  "name": "Nom du produit en français (ex: Courgette, Lait 1L)",
  "quantity": "Quantité estimée en chiffre ou texte (ex: 2, 500g, 1 bouteille)",
  "category": "Une valeur parmi: produce, meat, frozen, drinks, sauce, pantry, other",
  "expiryDate": "YYYY-MM-DD" ou null (utilise null pour les produits frais ou si la date n'est pas lisible/estimable)
}` },
                        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
                    ]
                }
            ],
            config: {
                temperature: 0.2, // Faible température pour plus de précision et de respect du format JSON
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        // Nettoyage au cas où le modèle renvoie quand même des backticks Markdown
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const parsedIngredients = JSON.parse(cleanText);

        if (Array.isArray(parsedIngredients)) {
            return parsedIngredients;
        }
        return [];
    } catch (e) {
        console.error("Erreur lors de l'analyse de l'image:", e);
        throw new Error("Impossible d'analyser l'image.");
    }
};

export const analyzeReceipt = async (base64Image: string): Promise<Partial<Ingredient>[]> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Tu es un expert culinaire et gestionnaire de stock. Analyse ce ticket de caisse et liste tous les ingrédients alimentaires ou produits visibles. 
                        
Règles strictes de sortie :
1. Renvoie UNIQUEMENT un tableau JSON valide.
2. N'ajoute AUCUN texte avant ou après le JSON.
3. N'utilise pas de backticks \`\`\`json ou autres marqueurs de code.

Chaque objet dans le tableau doit avoir cette structure exacte :
{
  "name": "Nom du produit en français (ex: Courgette, Lait 1L)",
  "quantity": "Quantité estimée en chiffre ou texte (ex: 2, 500g, 1 bouteille)",
  "category": "Une valeur parmi: produce, meat, frozen, drinks, sauce, pantry, other",
  "expiryDate": "YYYY-MM-DD" ou null (utilise null pour les produits frais ou si la date n'est pas lisible/estimable)
}` }
                        , { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
                    ]
                }
            ],
            config: { temperature: 0.1 }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("Erreur lors de l'analyse du ticket:", e);
        throw new Error("Impossible d'analyser l'image.");
    }
};

export const fetchProductFromBarcode = async (barcode: string): Promise<Partial<Ingredient> | null> => {
    try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();
        if (data.status === 1 && data.product) {
            const product = data.product;
            let category: 'produce' | 'meat' | 'drinks' | 'sauce' | 'pantry' | 'frozen' | 'other' = 'other';
            const catLower = (product.categories || '').toLowerCase();
            if (catLower.includes('viande')) category = 'meat';
            else if (catLower.includes('boissons')) category = 'drinks';
            else if (catLower.includes('sauce')) category = 'sauce';
            else if (catLower.includes('surgelé')) category = 'frozen';
            else if (catLower.includes('plant')) category = 'produce';

            return {
                name: product.product_name_fr || product.product_name,
                quantity: product.quantity || '1',
                category: category
            };
        }
        return null;
    } catch (e) {
        console.error("Erreur OpenFoodFacts:", e);
        return null;
    }
};

export const scanRecipeAndDetectMissing = async (base64Image: string, currentStockText: string): Promise<MissingIngredientResult[]> => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            text: `Tu es un chef et gestionnaire de courses. Je te donne une photo d'une recette (page de magazine, livre, écran, etc.) et la liste de ce que j'ai déjà dans mon frigo.
                            
STOCK ACTUEL:
${currentStockText || 'Le frigo est vide.'}

TA MISSION:
1. Lis les ingrédients nécessaires sur la photo de la recette (ou devine-les si c'est la photo du plat final).
2. Compare avec le STOCK ACTUEL.
3. Déduis uniquement ce qu'il MANQUE pour réaliser cette recette.
4. Renvoie le résultat au format JSON strict.

Règles strictes de sortie :
1. Renvoie UNIQUEMENT un tableau JSON valide contenant les ingrédients MANQUANTS. Si rien ne manque, renvoie [].
2. N'ajoute AUCUN texte avant ou après le JSON.
3. N'utilise pas de backticks \`\`\`json ou autres marqueurs de code.

Format exigé pour chaque objet :
{
  "name": "Nom du produit (ex: Courgette)",
  "quantity": "Quantité (ex: 2 ou 500g)"
}`
                        },
                        { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
                    ]
                }
            ],
            config: {
                temperature: 0.1,
            }
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsedMissing = JSON.parse(cleanText);

        if (Array.isArray(parsedMissing)) {
            return parsedMissing;
        }
        return [];
    } catch (e) {
        console.error("Erreur Scan Magique:", e);
        throw new Error("Impossible d'analyser la recette.");
    }
};

// --- DÉFINITION DES OUTILS ---

const addToStockTool: FunctionDeclaration = {
    name: 'ajouterAuStock',
    description: "Ajouter des ingrédients au stock/frigo. Ex: 'J'ai acheté 3 pommes'.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: "Nom de l'ingrédient" },
                        quantity: { type: Type.STRING, description: "Quantité (ex: 2, 500g)" },
                        category: { type: Type.STRING, enum: ['produce', 'meat', 'frozen', 'drinks', 'sauce', 'pantry', 'other'], description: "Catégorie auto-détectée" }
                    },
                    required: ['name']
                }
            }
        },
        required: ['items']
    }
};

const removeFromStockTool: FunctionDeclaration = {
    name: 'retirerDuStock',
    description: "Retirer des ingrédients du stock. Ex: 'J'ai mangé le poulet'.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            items: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "Nom de l'ingrédient à retirer" }
            }
        },
        required: ['items']
    }
};

const removeFromShoppingListTool: FunctionDeclaration = {
    name: 'retirerDuPanier',
    description: "Retirer ou supprimer des articles de la liste de courses. Ex: 'Enlève le lait de ma liste'.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            items: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "Nom exact ou partiel de l'article à supprimer de la liste de courses" }
            }
        },
        required: ['items']
    }
};

const addToShoppingListTool: FunctionDeclaration = {
    name: 'ajouterAuPanier',
    description: "Ajouter à la liste de courses. Ex: 'Il faut acheter du beurre'.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            items: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "Nom de l'article" }
            }
        },
        required: ['items']
    }
};

const saveRecipeTool: FunctionDeclaration = {
    name: 'sauvegarderRecette',
    description: "Sauvegarder une recette générée dans le carnet.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
            steps: { type: Type.ARRAY, items: { type: Type.STRING } },
            prepTime: { type: Type.STRING },
            macros: {
                type: Type.OBJECT,
                description: "Valeurs nutritionnelles de la recette estimées",
                properties: {
                    calories: { type: Type.INTEGER },
                    protein: { type: Type.INTEGER },
                    carbs: { type: Type.INTEGER },
                    fat: { type: Type.INTEGER }
                }
            }
        },
        required: ['title', 'ingredients', 'steps']
    }
};

const genererPlanSemaineTool: FunctionDeclaration = {
    name: 'genererPlanSemaine',
    description: "Générer un plan de repas pour la semaine (Meal Prep) avec recettes et liste de courses. Ex: 'Fais moi un plan pour 4 jours pour 2 personnes sans gluten avec 50 euros'.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            meals: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        day: { type: Type.STRING, description: "Jour. Ex: 'Lundi'" },
                        type: { type: Type.STRING, description: "Repas. Ex: 'Dîner'" },
                        recipeName: { type: Type.STRING, description: "Nom complet de la recette proposée." }
                    },
                    required: ['day', 'type', 'recipeName']
                }
            },
            shoppingList: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Liste consolidée des articles manquants à acheter pour tout le plan (en vérifiant le stock)."
            }
        },
        required: ['meals', 'shoppingList']
    }
};

const tools = [addToStockTool, removeFromStockTool, addToShoppingListTool, removeFromShoppingListTool, saveRecipeTool, genererPlanSemaineTool];

// --- FONCTION PRINCIPALE ---

export const chatWithChefStream = async function* (
    history: any[],
    message: string,
    ingredients: Ingredient[],
    shoppingList: ShoppingItem[],
    userProfile: UserProfile
): AsyncGenerator<any, void, unknown> {
    try {
        const inventoryText = ingredients.map(i => `${i.quantity} ${i.name}`).join(', ') || 'Vide';
        const shoppingText = shoppingList.map(i => i.name).join(', ') || 'Vide';

        const dietsText = userProfile?.diets?.length ? userProfile.diets.join(', ') : 'Aucun';
        const allergiesText = userProfile?.allergies?.length ? userProfile.allergies.join(', ') : 'Aucune';

        const systemInstruction = `Tu es FrigoChef AI, assistant culinaire expert interactif.
    CONTEXTE ACTUEL :
    - STOCK FRIGO : ${inventoryText}
    - LISTE COURSES : ${shoppingText}
    - RÉGIMES ALIMENTAIRES DE L'UTILISATEUR : ${dietsText}
    - ALLERGIES/INTOLÉRANCES DE L'UTILISATEUR : ${allergiesText}
    
    RÈGLES IMPORTANTES :
    - Si l'utilisateur demande une recette ou un plan de semaine, tu DOIS ABSOLUMENT respecter ses régimes et allergies.
    - Si tu fournis une recette ou proposes d'utiliser l'outil \`sauvegarderRecette\`, inclus TOUJOURS une estimation nutritionnelle des macros (calories, protéines, glucides, lipides).
    - Si on te demande de créer un "plan pour la semaine", du "Meal Prep" ou un menu, tu DOIS utiliser l'outil \`genererPlanSemaine\`. Remplis-le de manière intelligente en considérant toutes les contraintes.
    - Tu as un contrôle TOTAL sur l'application via les outils (\`ajouterAuStock\`, \`retirerDuStock\`, \`ajouterAuPanier\`, \`retirerDuPanier\`, \`sauvegarderRecette\`).
    - Quand tu crées un plan de semaine, assure-toi d'inclure dans la \`shoppingList\` uniquement les articles qui ne sont pas déjà dans le STOCK FRIGO.
    - Sois expressif et concis, tu t'adresses à voix haute à l'utilisateur. Parle comme un chef passionné.`;

        // Préparation de l'historique
        const contents = history.map(msg => {
            if (msg.parts) {
                return {
                    role: msg.role === 'assistant' ? 'model' : msg.role,
                    parts: msg.parts
                };
            }
            return {
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.text }]
            };
        });

        contents.push({ role: 'user', parts: [{ text: message }] });

        const finalTools: any[] = [{ functionDeclarations: tools }];

        const responseStream = await ai.models.generateContentStream({
            model: MODEL_NAME,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                tools: finalTools,
                temperature: 0.7
            }
        });

        // --- CORRECTION MAJEURE ICI : Lecture manuelle des chunks ---
        for await (const chunk of responseStream) {
            // 1. Extraction manuelle des "parts" (le SDK ne le fait plus tout seul)
            const parts = chunk.candidates?.[0]?.content?.parts || [];

            // 2. On récupère le texte s'il existe
            const chunkText = parts
                .filter((p: any) => p.text)
                .map((p: any) => p.text)
                .join('');

            // 3. On récupère les appels de fonction s'il y en a
            const chunkCalls = parts
                .filter((p: any) => p.functionCall)
                .map((p: any) => p.functionCall);

            // 4. On récupère les métadonnées (Grounding)
            const grounding = chunk.candidates?.[0]?.groundingMetadata;

            // 5. On construit l'objet pour l'UI
            const uiChunk: any = {
                text: chunkText,
                candidates: [{
                    content: {
                        parts: []
                    },
                    groundingMetadata: grounding
                }]
            };

            // 6. On attache les appels de fonction s'il y en a
            if (chunkCalls && chunkCalls.length > 0) {
                uiChunk.candidates[0].content.parts = chunkCalls.map((call: any) => ({
                    functionCall: {
                        name: call.name,
                        args: call.args
                    }
                }));
            }

            yield uiChunk;
        }

    } catch (error: any) {
        console.error("🚨 ERREUR GEMINI:", error);

        let msg = "Désolé, problème technique.";
        if (error.message?.includes("404") || error.message?.includes("not found")) {
            msg = "Erreur config : Modèle IA introuvable.";
        } else if (error.message?.includes("API_KEY") || error.message?.includes("403")) {
            msg = "Clé API invalide ou expirée.";
        } else if (error.message?.includes("400")) {
            msg = "Erreur de format (400). Essayez de rafraîchir.";
        } else if (error.message?.includes("429") || error.message?.includes("exceeded")) {
            msg = "⏳ Quota IA dépassé ! Attendez quelques secondes ou passez sur un plan Premium pour des requêtes illimitées.";
        }

        yield { text: msg };
    }
};

// --- STUBS ---
export const generateRecipePlan = async (ingredients: Ingredient[], request: string, userProfile: UserProfile) => {
    try {
        const dietsText = userProfile?.diets?.length ? userProfile.diets.join(', ') : 'Aucun';
        const allergiesText = userProfile?.allergies?.length ? userProfile.allergies.join(', ') : 'Aucune';

        const promptText = "Plan repas pour: " + request + ". Stock: " + ingredients.map(i => i.name).join(', ') + ". Régimes: " + dietsText + ". Allergies: " + allergiesText + ". IMPORTANT: Fournis systématiquement une estimation des macros (calories, protéines, lipides, glucides) pour chaque recette.";

        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: promptText }] }]
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || "Impossible de générer le plan.";
    } catch (e) { return "Erreur lors de la génération."; }
};