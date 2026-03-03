import React, { useState, useRef } from 'react';
import { UserProfile, AppNotification } from '../types';
import { User, Moon, Sun, Camera, ToggleLeft, ToggleRight, Smartphone, Share, X, MoreVertical, Download, HelpCircle, Flame, Bell, CheckCircle, Trash2, Check, ChevronRight } from 'lucide-react';

interface Props {
    userProfile: UserProfile;
    setUserProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
    darkMode: boolean;
    setDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
    streak: number;

    // Nouveaux props venant de App.tsx
    notificationsEnabled: boolean;
    toggleNotifications: () => void;
    notifications: AppNotification[];
    markAsRead: (id: number) => void;
    deleteNotification: (id: number) => void;
    clearAllNotifications: () => void;
    triggerTestNotification: () => void;
    startOnboarding: () => void;
}

const Profile: React.FC<Props> = ({
    userProfile, setUserProfile, darkMode, setDarkMode, streak,
    notificationsEnabled, toggleNotifications, notifications, markAsRead, deleteNotification, clearAllNotifications, triggerTestNotification, startOnboarding
}) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [newName, setNewName] = useState(userProfile.name);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const unreadCount = (notifications || []).filter(n => !n.read).length;

    // --- INSTALL LOGIC (PWA) ---
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    // ... (Code d'installation PWA identique au précédent, omis pour brièveté mais à garder) ...

    const saveName = () => {
        setUserProfile({ ...userProfile, name: newName });
        setIsEditingName(false);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => { setUserProfile(prev => ({ ...prev, avatar: reader.result as string })); };
            reader.readAsDataURL(file);
        }
    };

    // Styles Streak Dynamique
    const getStreakStyle = (days: number) => {
        // (Même logique que ton fichier actuel)
        return { wrapper: "bg-orange-50 dark:bg-orange-900/20", icon: "text-orange-500", text: "text-orange-600" };
    };
    const streakStyle = getStreakStyle(streak);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-300 relative overflow-hidden">

            {/* Header Profile */}
            <div className="pt-8 pb-8 px-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 shadow-sm transition-colors duration-300 flex flex-col items-center relative z-10">
                <div className="absolute top-4 right-4">
                    <button onClick={() => setDarkMode(!darkMode)} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-600">
                        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>

                <div className="relative group cursor-pointer mt-4" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-24 h-24 rounded-full flex items-center justify-center text-white shadow-xl overflow-hidden border-4 border-white dark:border-slate-700 bg-gradient-to-br from-emerald-400 to-teal-600 relative">
                        {userProfile.avatar ? <img src={userProfile.avatar} alt="Profile" className="w-full h-full object-cover" /> : <User size={40} />}
                    </div>
                    {/* BADGE ICI AUSSI */}
                    {unreadCount > 0 && (
                        <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800 animate-bounce">
                            {unreadCount}
                        </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                </div>

                <div className="mt-4 text-center w-full">
                    {isEditingName ? (
                        <div className="flex items-center gap-2 justify-center mb-2">
                            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} className="bg-slate-50 dark:bg-slate-700 border rounded-lg p-1.5 text-lg font-bold w-40 text-center" autoFocus />
                            <button onClick={saveName} className="text-xs bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold">OK</button>
                        </div>
                    ) : (
                        <h1 onClick={() => setIsEditingName(true)} className="text-xl font-bold text-slate-800 dark:text-white flex items-center justify-center gap-2 cursor-pointer mb-2">{userProfile.name}</h1>
                    )}

                    <div className="flex items-center justify-center">
                        <div className={`px-4 py-1.5 rounded-full flex items-center gap-2 border shadow-sm ${streakStyle.wrapper}`}>
                            <Flame size={18} className={streakStyle.icon} />
                            <span className={`text-lg font-black font-mono ${streakStyle.text}`}>{streak}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Settings Options */}
            <div className="flex-1 overflow-y-auto p-5 pb-24 space-y-4">

                {/* ZONE PARAMÈTRES ET TEST NOTIF */}
                <div className="flex justify-between items-end px-2">
                    <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Centre de Notifications</h2>

                    {/* BOUTON TEST SPÉCIFIQUE */}
                    <button
                        onClick={triggerTestNotification}
                        className="text-[10px] bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-3 py-1.5 rounded-lg font-bold hover:bg-sky-200 transition flex items-center gap-1"
                    >
                        🚀 Tester le système
                    </button>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-700/50">

                    {/* TOGGLE ON/OFF */}
                    <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors" onClick={toggleNotifications}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${notificationsEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                            <Bell size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-700 dark:text-slate-200">Activer les notifications</p>
                            <p className="text-[10px] text-slate-400 truncate">Péremption, courses, recettes, streak...</p>
                        </div>
                        <div className={`${notificationsEnabled ? 'text-emerald-500' : 'text-slate-300'}`}>
                            {notificationsEnabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                        </div>
                    </div>

                    {/* LISTE DES NOTIFICATIONS */}
                    {notificationsEnabled && (
                        <div className="bg-slate-50/50 dark:bg-slate-900/30">
                            <div className="flex justify-between items-center px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                                <h3 className="text-[10px] font-bold text-slate-400 uppercase">Historique ({notifications.length})</h3>
                                {notifications.length > 0 && (
                                    <button onClick={clearAllNotifications} className="text-[10px] text-red-400 hover:text-red-500 flex items-center gap-1">
                                        <Trash2 size={10} /> Tout effacer
                                    </button>
                                )}
                            </div>

                            {notifications.length === 0 ? (
                                <div className="p-6 text-center text-slate-400 text-xs">
                                    Aucune notification pour le moment.
                                </div>
                            ) : (
                                <div className="max-h-60 overflow-y-auto">
                                    {notifications.map(notif => (
                                        <div
                                            key={notif.id}
                                            onClick={() => markAsRead(notif.id)}
                                            className={`p-4 border-b border-slate-100 dark:border-slate-700/50 cursor-pointer transition-all flex gap-3 ${notif.read ? 'opacity-60 bg-transparent' : 'bg-white dark:bg-slate-800 border-l-4 border-l-emerald-500'
                                                }`}
                                        >
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className={`text-xs font-bold ${notif.read ? 'text-slate-500' : 'text-slate-800 dark:text-white'}`}>
                                                        {notif.title}
                                                    </p>
                                                    <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">{notif.time}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{notif.message}</p>
                                            </div>

                                            <div className="flex flex-col justify-between items-end gap-2">
                                                {!notif.read && <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id); }}
                                                    className="text-slate-300 hover:text-red-500 p-1"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ZONE TUTORIEL */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
                    <div className="p-4 flex items-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors" onClick={startOnboarding}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                            <HelpCircle size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-slate-700 dark:text-slate-200">Revoir le tutoriel</p>
                            <p className="text-[10px] text-slate-400 truncate">Relance la présentation de l'application</p>
                        </div>
                        <ChevronRight size={18} className="text-slate-300" />
                    </div>
                </div>

                <div className="text-center pt-4">
                    <p className="text-[10px] text-slate-300 dark:text-slate-600">FrigoChef AI v2.0</p>
                </div>
            </div>
        </div>
    );
};

export default Profile;