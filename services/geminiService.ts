import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Ingredient, ShoppingItem } from "../types";

// 1. Initialisation
const ai = new GoogleGenAI({ 
    apiKey: import.meta.env.VITE_GEMINI_API_KEY 
});

// Modèle stable
const MODEL_NAME = 'gemini-2.5-flash';

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
            prepTime: { type: Type.STRING }
        },
        required: ['title', 'ingredients', 'steps']
    }
};

const tools = [addToStockTool, removeFromStockTool, addToShoppingListTool, saveRecipeTool];

// --- FONCTION PRINCIPALE ---

export const chatWithChefStream = async function* (
  history: any[],
  message: string,
  ingredients: Ingredient[],
  shoppingList: ShoppingItem[],
  useSearch: boolean
) {
  try {
    const inventoryText = ingredients.map(i => `${i.quantity} ${i.name}`).join(', ') || 'Vide';
    const shoppingText = shoppingList.map(i => i.name).join(', ') || 'Vide';

    const systemInstruction = `Tu es FrigoChef AI, assistant culinaire expert.
    CONTEXTE ACTUEL :
    - STOCK FRIGO : ${inventoryText}
    - LISTE COURSES : ${shoppingText}
    
    RÈGLES :
    - Si on te demande une recette, vérifie le stock.
    - Utilise les outils pour modifier le stock ou la liste si l'utilisateur le demande explicitement.
    - Sois concis et utile.`;

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
    if (useSearch) {
        finalTools.push({ googleSearch: {} });
    }

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
    }
    
    yield { text: msg };
  }
};

// --- STUBS ---
export const generateRecipePlan = async (ingredients: Ingredient[], request: string) => {
    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: 'user', parts: [{ text: `Plan repas pour: ${request}. Stock: ${ingredients.map(i => i.name).join(', ')}` }] }]
        });
        
        // Correction ici aussi pour la lecture du résultat unique
        const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
        return text || "Impossible de générer le plan.";
    } catch (e) { return "Erreur lors de la génération."; }
};

export const generateSpeech = async () => null;
export const playTextAsAudio = async () => {};
export const base64ToBytes = () => new Uint8Array();
export const startLiveTranscription = async () => null;
export const pcmToAudioBuffer = () => null;