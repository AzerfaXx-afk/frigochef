// types.ts

export interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  expiryDate: string | null; // ISO string YYYY-MM-DD
  category: 'produce' | 'meat' | 'drinks' | 'sauce' | 'pantry' | 'frozen' | 'other';
}

export interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
}

export interface ShoppingListTemplate {
  id: string;
  name: string;
  items: string[];
  isCustom?: boolean;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  ingredients: string[];
  steps: string[];
  prepTime?: string;
  createdAt: number;
  isFavorite?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isThinking?: boolean;
  groundingUrls?: string[];
  image?: string; // base64
}

export interface UserProfile {
  name: string;
  avatar?: string; // base64 data url
}

export enum AppTab {
  INVENTORY = 'inventory',
  SHOPPING = 'shopping',
  ASSISTANT = 'assistant',
  CARNET = 'carnet',
  PROFILE = 'profile',
}

// AJOUTÉ POUR LE SYSTÈME DE NOTIFICATIONS
export interface AppNotification {
  id: number;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'system' | 'expiry' | 'streak' | 'info';
}

// AJOUTÉ POUR LES FONCTIONNALITÉS PREMIUM
export interface MissingIngredientResult {
  name: string;
  quantity: string;
}

export interface Meal {
  day: string; // Lundi, Mardi...
  type: 'Déjeuner' | 'Dîner';
  recipeName: string;
}

export interface WeeklyPlan {
  meals: Meal[];
  shoppingList: string[]; // Liste consolidée de tous les ingrédients manquants pour la semaine
}