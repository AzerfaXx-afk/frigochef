import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppTab, Ingredient, ShoppingItem, Recipe, UserProfile, AppNotification } from './types';
import Inventory from './components/Inventory';
import RecipeAssistant from './components/RecipeAssistant';
import ShoppingList from './components/ShoppingList';
import Profile from './components/Profile';
import Carnet from './components/Carnet';
import InteractiveOnboarding from './components/InteractiveOnboarding';
import { LayoutGrid, ShoppingCart, ChefHat, User, BookOpen } from 'lucide-react';
import { ChatMessage } from './types';

// --- FONCTION UTILITAIRE CATÉGORIES ---
const detectCategory = (name: string): Ingredient['category'] => {
  const lower = name.toLowerCase();
  if (lower.match(/poulet|viande|poisson|oeuf|jambon|steak/)) return 'meat';
  if (lower.match(/pomme|banane|carotte|salade|tomate|oignon|légume|fruit/)) return 'produce';
  if (lower.match(/eau|lait|jus|soda|bière|vin/)) return 'drinks';
  if (lower.match(/sauce|sel|poivre|huile|épice/)) return 'sauce';
  if (lower.match(/surgelé|glace/)) return 'frozen';
  return 'pantry';
};

const App: React.FC = () => {
  // --- ÉTATS ---
  const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
    try { const saved = localStorage.getItem('fc_ingredients'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>(() => {
    try { const saved = localStorage.getItem('fc_shopping'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>(() => {
    try { const saved = localStorage.getItem('fc_recipes'); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [darkMode, setDarkMode] = useState(() => {
    try { const saved = localStorage.getItem('fc_darkmode'); return saved ? JSON.parse(saved) : false; } catch { return false; }
  });
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    try { const saved = localStorage.getItem('fc_profile'); return saved ? JSON.parse(saved) : { name: 'Chef' }; } catch { return { name: 'Chef' }; }
  });
  const [streak, setStreak] = useState(() => parseInt(localStorage.getItem('fc_streak_count') || '0'));

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('fc_chat_messages');
      return saved ? JSON.parse(saved) : [{
        id: '0',
        role: 'model',
        text: "Salut Chef ! 👨‍🍳\nJe gère ton stock, ta liste et tes recettes. Par quoi on commence ?"
      }];
    } catch {
      return [{
        id: '0',
        role: 'model',
        text: "Salut Chef ! 👨‍🍳\nJe gère ton stock, ta liste et tes recettes. Par quoi on commence ?"
      }];
    }
  });

  // --- GESTION CENTRALISÉE DES NOTIFICATIONS ---
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try { const saved = localStorage.getItem('fc_notifs_active'); return saved ? JSON.parse(saved) : false; } catch { return false; }
  });

  const [showOnboarding, setShowOnboarding] = useState(() => {
    const hasCompleted = localStorage.getItem('fc_onboarding_done');
    return !hasCompleted; // Show if not completed
  });

  const startOnboarding = () => {
    localStorage.removeItem('fc_onboarding_done');
    setShowOnboarding(true);
    setCurrentTab(AppTab.ASSISTANT); // Go to first tab so the animation works immediately
  };

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('fc_notifications');
      // On vérifie que c'est bien un JSON et que c'est un tableau
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return []; // En cas d'erreur de lecture, on renvoie un tableau vide
    }
  });

  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.ASSISTANT);
  const notificationChecked = useRef(false);

  // --- LOGIQUE CARROUSEL ---
  const TAB_ORDER = [AppTab.INVENTORY, AppTab.SHOPPING, AppTab.ASSISTANT, AppTab.CARNET, AppTab.PROFILE];

  const handleTabChange = (newTab: AppTab) => {
    if (newTab !== currentTab) {
      setCurrentTab(newTab);
    }
  };


  useEffect(() => { localStorage.setItem('fc_ingredients', JSON.stringify(ingredients)); }, [ingredients]);
  useEffect(() => { localStorage.setItem('fc_shopping', JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { localStorage.setItem('fc_recipes', JSON.stringify(savedRecipes)); }, [savedRecipes]);
  useEffect(() => { localStorage.setItem('fc_notifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => { localStorage.setItem('fc_notifs_active', JSON.stringify(notificationsEnabled)); }, [notificationsEnabled]);
  useEffect(() => { localStorage.setItem('fc_chat_messages', JSON.stringify(chatMessages)); }, [chatMessages]);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('fc_darkmode', JSON.stringify(darkMode));
  }, [darkMode]);

  // --- SYSTÈME DE NOTIFICATION (LE VRAI) ---
  const sendSystemNotification = async (title: string, body: string, type: AppNotification['type'] = 'info') => {
    // 1. Ajouter à l'historique interne (In-App)
    const newNotif: AppNotification = {
      id: Date.now(),
      title,
      message: body,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      type
    };
    setNotifications(prev => [newNotif, ...prev]);

    // 2. Envoyer la notification Système (Push OS)
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      try {
        // Vibrate the phone if it is currently being used (foreground)
        if ("vibrate" in navigator) {
          navigator.vibrate([200, 100, 200]);
        }

        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          registration.showNotification(title, {
            body: body,
            icon: '/icon.png?v=2',
            badge: '/icon.png?v=2',
            // @ts-ignore
            vibrate: [200, 100, 200],
            tag: 'fc-notif-' + Date.now()
          });
        } else {
          // @ts-ignore - TS sometimes forgets vibrate exists on new Notification
          new Notification(title, { body, icon: '/icon.png?v=2', vibrate: [200, 100, 200] });
        }
      } catch (e) {
        console.error("Erreur envoi notif système:", e);
      }
    }
  };

  // Fonction spéciale pour le bouton TEST
  const handleTestNotification = () => {
    sendSystemNotification(
      "🔔 Test de notification réussi !",
      "Merci de tester mon système de notification. Tout fonctionne nickel sur ton appareil !",
      "system"
    );
  };

  // Toggle Permission
  const toggleNotifications = async () => {
    if (notificationsEnabled) {
      setNotificationsEnabled(false);
    } else {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        sendSystemNotification("Notifications activées", "Tu recevras désormais les alertes sur cet appareil.", "system");
      } else {
        alert("Permission refusée par le navigateur. Vérifie tes réglages.");
        setNotificationsEnabled(false);
      }
    }
  };

  // Actions sur les notifs
  const markAsRead = (id: number) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const deleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Calcul du badge global
  const unreadCount = notifications.filter(n => !n.read).length;

  // --- LOGIQUE AUTOMATIQUE (Péremption, Streak) ---
  useEffect(() => {
    if (!notificationsEnabled) return;

    const checkRoutine = () => {
      if (notificationChecked.current) return;
      notificationChecked.current = true;

      const today = new Date().toISOString().split('T')[0];
      const lastVisit = localStorage.getItem('fc_last_visit');
      const lastExpiryCheck = localStorage.getItem('fc_last_expiry_check');

      // Streak Check
      if (lastVisit !== today) {
        // Logique simplifiée streak...
        let newStreak = streak;
        if (lastVisit) { /* check date logic */ newStreak += 1; }
        else { newStreak = 1; }

        setStreak(newStreak);
        localStorage.setItem('fc_streak_count', newStreak.toString());
        localStorage.setItem('fc_last_visit', today);

        // Notif Streak
        setTimeout(() => sendSystemNotification("🔥 Streak !", `Tu es connecté ! Série actuelle : ${newStreak} jours.`, 'streak'), 3000);
      }

      // Expiry Check
      if (lastExpiryCheck !== today) {
        const expiring = ingredients.filter(i => i.expiryDate && new Date(i.expiryDate) <= new Date(Date.now() + 2 * 86400000));
        if (expiring.length > 0) {
          setTimeout(() => {
            sendSystemNotification("⚠️ Anti-Gaspi", `Attention, ${expiring.length} produits périment bientôt !`, 'expiry');
          }, 6000);
        }
        localStorage.setItem('fc_last_expiry_check', today);
      }
    };

    checkRoutine();
  }, [notificationsEnabled, ingredients]); // Dépendances pour relancer si besoin

  return (
    <div className="h-[100dvh] w-full flex flex-col max-w-md mx-auto bg-slate-50 dark:bg-slate-900 shadow-2xl overflow-hidden relative border-x border-slate-200 dark:border-slate-800 transition-colors duration-300">

      {/* CONTENU PRINCIPAL */}
      <div className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 touch-pan-y">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab}
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full h-full absolute inset-0"
          >
            {currentTab === AppTab.INVENTORY && <Inventory ingredients={ingredients} setIngredients={setIngredients} />}
            {currentTab === AppTab.SHOPPING && (
              <ShoppingList
                items={shoppingList}
                setItems={setShoppingList}
                ingredients={ingredients}
                onAddToStock={(items) => {
                  setIngredients(prev => [...prev, ...items.map(i => ({
                    id: Date.now().toString() + Math.random(),
                    name: i.name, quantity: '1', expiryDate: null, category: detectCategory(i.name)
                  }))]);
                }}
              />
            )}
            {currentTab === AppTab.ASSISTANT && (
              <RecipeAssistant
                ingredients={ingredients}
                setIngredients={setIngredients}
                setSavedRecipes={setSavedRecipes}
                shoppingList={shoppingList}
                setShoppingList={setShoppingList}
                isActive={currentTab === AppTab.ASSISTANT}
                messages={chatMessages}
                setMessages={setChatMessages}
                userProfile={userProfile}
              />
            )}
            {currentTab === AppTab.CARNET && (
              <Carnet
                savedRecipes={savedRecipes}
                setSavedRecipes={setSavedRecipes}
                ingredients={ingredients}
                shoppingList={shoppingList}
                setShoppingList={setShoppingList}
              />
            )}
            {currentTab === AppTab.PROFILE && (
              <Profile
                userProfile={userProfile}
                setUserProfile={setUserProfile}
                darkMode={darkMode}
                setDarkMode={setDarkMode}
                streak={streak}
                notificationsEnabled={notificationsEnabled}
                toggleNotifications={toggleNotifications}
                notifications={notifications}
                markAsRead={markAsRead}
                deleteNotification={deleteNotification}
                clearAllNotifications={clearAllNotifications}
                triggerTestNotification={handleTestNotification}
                startOnboarding={startOnboarding}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ONBOARDING OVERLAY */}
      <AnimatePresence>
        {showOnboarding && (
          <InteractiveOnboarding
            onComplete={() => {
              setShowOnboarding(false);
              localStorage.setItem('fc_onboarding_done', 'true');
            }}
            onTabChange={handleTabChange}
          />
        )}
      </AnimatePresence>

      {/* BARRE DE NAVIGATION */}
      <nav className="bg-white/90 dark:bg-[#0b132b]/95 backdrop-blur-xl px-2 pt-2 pb-safe flex justify-between items-center z-40 h-[88px] shrink-0 border-t border-slate-200 dark:border-slate-800/80 select-none touch-none">
        <button id="nav-inventory" onClick={() => handleTabChange(AppTab.INVENTORY)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${currentTab === AppTab.INVENTORY ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'}`}><LayoutGrid size={24} /><span className="text-[10px]">Stock</span></button>
        <button id="nav-shopping" onClick={() => handleTabChange(AppTab.SHOPPING)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${currentTab === AppTab.SHOPPING ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'}`}><ShoppingCart size={24} /><span className="text-[10px]">Liste</span></button>
        <div className="relative -top-6"><button id="nav-assistant" onClick={() => handleTabChange(AppTab.ASSISTANT)} className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${currentTab === AppTab.ASSISTANT ? 'bg-emerald-500 text-white scale-110 shadow-emerald-500/40' : 'bg-white dark:bg-[#1c2541] text-slate-400 hover:scale-105'}`}><ChefHat size={30} /></button></div>
        <button id="nav-carnet" onClick={() => handleTabChange(AppTab.CARNET)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${currentTab === AppTab.CARNET ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'}`}><BookOpen size={24} /><span className="text-[10px]">Carnet</span></button>

        {/* BOUTON PROFIL AVEC BADGE GLOBAL */}
        <button id="nav-profile" onClick={() => handleTabChange(AppTab.PROFILE)} className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${currentTab === AppTab.PROFILE ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-300'}`}>
          <div className="relative">
            <User size={24} />
            {/* LE BADGE DISPARAIT SI UNREADCOUNT == 0 */}
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white dark:border-[#0b132b]">{unreadCount}</span>}
          </div>
          <span className="text-[10px]">Profil</span>
        </button>
      </nav>
    </div>
  );
};

export default App;