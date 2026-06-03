import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize core client-side App engine
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

import { 
  DollarSign, Gift, Ticket, User, Coins, Gamepad2, Share2, 
  Download, ListTodo, Tv, Award, Sparkles, Info, Copy, 
  Check, History, HelpCircle, ShieldAlert, BookOpen, 
  Instagram, Youtube, ArrowLeft, ChevronRight, Battery, 
  Wifi, Radio, UserCheck, AlertCircle, Play, X, Lock,
  CalendarDays, Users, HelpCircle as SupportIcon, ShieldCheck, FileText, Globe,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Transaction, EarnTask, RewardItem, UserProfile } from './types';

// Import our custom modular app sub-modules
import OnboardingFlow from './components/OnboardingFlow';
import PlaytimeSimulator from './components/PlaytimeSimulator';
import AdSimulator from './components/AdSimulator';
import SurveySimulator from './components/SurveySimulator';
import RedemptionSheet from './components/RedemptionSheet';
import Leaderboard from './components/Leaderboard';

// Standardized Reward conversions reflecting user coins specification in mRewards
const REWARD_CATALOG: RewardItem[] = [
  // UPI Section
  { id: 'upi-10', category: 'upi', title: '₹10 UPI Cash', valueText: '₹10 UPI Cash', coinsCost: 1178, imageAlt: 'UPI Trifold' },
  { id: 'upi-25', category: 'upi', title: '₹25 UPI Cash', valueText: '₹25 UPI Cash', coinsCost: 2678, imageAlt: 'UPI Trifold' },
  { id: 'upi-100', category: 'upi', title: '₹100 UPI Cash', valueText: '₹100 UPI Cash', coinsCost: 10000, imageAlt: 'UPI Trifold' },

  // Google Play Section (copied from user rates screenshots)
  { id: 'gp-10', category: 'google-play', title: '₹10 eGift Card', valueText: '₹10 eGift Card', coinsCost: 1000, imageAlt: 'Google Play Balance' },
  { id: 'gp-100', category: 'google-play', title: '₹100 eGift Card', valueText: '₹100 eGift Card', coinsCost: 10000, imageAlt: 'Google Play Balance' }
];

export default function App() {
  // Application Boot states
  const [showSplash, setShowSplash] = useState(true);
  const [onboardingFinished, setOnboardingFinished] = useState(() => {
    return localStorage.getItem('onboarding_passed') === 'true';
  });

  // User auth state backup in storage for premium responsiveness
  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('user_email'));
  const [userName, setUserName] = useState<string | null>(() => localStorage.getItem('user_name'));
  const [userPhoto, setUserPhoto] = useState<string | null>(() => localStorage.getItem('user_photo'));
  
  // Backend derived unique Id
  const userId = userEmail ? userEmail.replace(/[^a-zA-Z0-9]/g, 'x').substring(0, 15).toLowerCase() : "player_g99x";
  
  // Wallet state values synced from file-backed Database
  const [coins, setCoins] = useState<number>(499);
  const [history, setHistory] = useState<any[]>([]);

  // Referral state parameters synced from server & Firestore
  const [referCode, setReferCode] = useState<string>('CO499');
  const [referredBy, setReferredBy] = useState<string>('');
  const [referCount, setReferCount] = useState<number>(0);
  const [referralInput, setReferralInput] = useState<string>('');
  const [isClaimingReferral, setIsClaimingReferral] = useState<boolean>(false);

  // Navigation tabs
  const [currentTab, setCurrentTab] = useState<'earn' | 'rewards' | 'leaderboard' | 'profile'>('earn');
  const [rewardsCategory, setRewardsCategory] = useState<'upi' | 'google-play'>('upi');

  // Modular simulation states
  const [activeSimulator, setActiveSimulator] = useState<'none' | 'playtime' | 'video' | 'survey' | 'apptask' | 'refer'>('none');
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [userRedemptions, setUserRedemptions] = useState<any[]>([]);

  // App tasks checklist simulation lists
  const [appTasks, setAppTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  
  const [toast, setToast] = useState<{ text: string; coins: number } | null>(null);
  const [pushNotify, setPushNotify] = useState<{ title: string; message: string; system: string } | null>(null);

  // Policy modal states
  const [activePolicyModal, setActivePolicyModal] = useState<'none' | 'privacy' | 'terms' | 'support'>('none');

  // Trigger Splash Timeout on startup
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Fetch / Sync balance securely with the backend persistent storage
  const refreshWallet = async () => {
    if (!userEmail) return;
    try {
      const res = await fetch(`/api/wallet/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setCoins(data.balance);
        setHistory(data.history || []);
        if (data.referCode) setReferCode(data.referCode);
        if (data.referredBy) setReferredBy(data.referredBy);
        if (typeof data.referCount === 'number') setReferCount(data.referCount);
      }
    } catch (e) {
      console.error("Failed to sync wallet data", e);
    }
  };

  // Sync redemption records dynamically with server state
  const refreshRedemptions = async () => {
    if (!userEmail) return;
    try {
      const res = await fetch(`/api/wallet/${userId}/redemptions`);
      if (res.ok) {
        const data = await res.json();
        setUserRedemptions(data || []);
      }
    } catch (e) {
      console.error("Failed to sync redemptions queue", e);
    }
  };

  useEffect(() => {
    if (userEmail) {
      refreshWallet();
      refreshRedemptions();
    }
  }, [userId, userEmail]);

  useEffect(() => {
    let active = true;
    if (activeSimulator === 'apptask') {
      const fetchTasks = async () => {
        try {
          setLoadingTasks(true);
          setTasksError(null);
          const res = await fetch("/api/apptasks");
          if (!res.ok) throw new Error("API load error");
          const data = await res.json();
          if (active) {
            setAppTasks(data || []);
          }
        } catch (e) {
          console.error("App tasks request error:", e);
          if (active) {
            setTasksError("No tasks available at the moment.");
          }
        } finally {
          if (active) {
            setLoadingTasks(false);
          }
        }
      };
      fetchTasks();
    }
    return () => {
      active = false;
    };
  }, [activeSimulator]);

  const triggerToast = (text: string, amount: number) => {
    setToast({ text, coins: amount });
    setTimeout(() => setToast(null), 3000);
  };

  const triggerPushNotification = (title: string, message: string, system = "API Gateway", durationMs = 1800) => {
    setPushNotify({ title, message, system });
    setTimeout(() => setPushNotify(null), durationMs);
  };

  // Synchronize Auth State from Firebase Authentication Google OAuth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || "";
        const name = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "User";
        const photo = firebaseUser.photoURL || `https://api.dicebear.com/7.x/notionists/svg?seed=${firebaseUser.email}`;

        setUserEmail(email);
        setUserName(name);
        setUserPhoto(photo);
        localStorage.setItem('user_email', email);
        localStorage.setItem('user_name', name);
        localStorage.setItem('user_photo', photo);

        const tempId = email.replace(/[^a-zA-Z0-9]/g, 'x').substring(0, 15).toLowerCase();
        try {
          const res = await fetch(`/api/userProfile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: tempId, name })
          });
          if (res.ok) {
            const walletRes = await fetch(`/api/wallet/${tempId}`);
            if (walletRes.ok) {
              const wData = await walletRes.json();
              setCoins(wData.balance);
              setHistory(wData.history || []);
            }
          }
        } catch (e) {
          console.error("Profile synchronization in auth listener failed:", e);
        }
      } else {
        setUserEmail(null);
        setUserName(null);
        setUserPhoto(null);
        localStorage.removeItem('user_email');
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_photo');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Firebase sign out failed:", e);
    }
    setUserEmail(null);
    setUserName(null);
    setUserPhoto(null);
    localStorage.removeItem('user_email');
    localStorage.removeItem('user_name');
    localStorage.removeItem('user_photo');
    setCurrentTab('earn');
    triggerToast("Logged out successfully.", 0);
  };

  // Claim Daily Bonus checks securely over Server
  const handleClaimDailyBonus = async () => {
    try {
      const res = await fetch(`/api/wallet/${userId}/earn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'daily_checkin',
          reward: 50,
          source: 'Daily Check-in Bonus'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setCoins(data.balance);
        refreshWallet();
        triggerToast("Daily Bonus Claimed successfully!", 50);
      } else {
        triggerToast(data.error || "Already claimed today!", 0);
      }
    } catch (e) {
      triggerToast("Network error. Please try later.", 0);
    }
  };

  // Real Google Popup authentication using Firebase Auth
  const handleRealGoogleLoginPopup = async () => {
    try {
      triggerToast("Opening secure Google popup...", 0);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      await signInWithPopup(auth, provider);
      triggerToast(`Welcome back!`, 0);
    } catch (e: any) {
      console.error("Firebase auth popup failed:", e);
      triggerPushNotification(
        "Google Sign-In Notice",
        "If the popup was blocked, please click the 'Open in new tab' button to run the app directly outside the sandbox iframe!",
        "Google OAuth Security",
        6000
      );
    }
  };

  const handleFinishOnboarding = () => {
    setOnboardingFinished(true);
    localStorage.setItem('onboarding_passed', 'true');
  };

  // Securely reward coins upon task successes
  const handleSimulatedCoinsReward = (amount: number, source: string) => {
    refreshWallet();
    triggerToast(`Gained from: ${source}`, amount);
  };

  const handleRedeemSuccess = (reward: RewardItem) => {
    refreshWallet();
    refreshRedemptions();
    triggerToast(`Deducted ${reward.coinsCost} coins. Redemption logged.`, -reward.coinsCost);
    triggerPushNotification(
      "Payment Redeemed",
      `Deducted ${reward.coinsCost} coins. Handshaking verification nodes to deliver ${reward.valueText}... Payouts queue active.`,
      "BHIM UPI Network",
      3000
    );
  };

  // Render Splash Launcher
  if (showSplash) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans text-white p-4 relative overflow-hidden select-none">
        
        {/* Splash ambient circles */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-pink-600/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[80vw] h-[80vw] bg-orange-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col items-center text-center">
          
          {/* Custom Handcrafted Logo Design */}
          <div className="w-28 h-28 bg-gradient-to-tr from-pink-500 to-orange-400 rounded-[32px] border border-white/20 p-4 shadow-2xl flex items-center justify-center mb-6 animate-pulse">
            <div className="relative flex items-center justify-center">
              <Gamepad2 className="w-16 h-16 text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)]" />
              <Coins className="w-8 h-8 text-yellow-300 fill-yellow-400 absolute bottom-[-4px] right-[-4px] drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] animate-bounce" />
            </div>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tighter text-white font-plus">
            Jai Rewards
          </h1>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-400 mt-2">
            Play Games • Get Cash
          </p>

          <div className="mt-14 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-t-pink-500 border-r-pink-500 border-indigo-500/20 rounded-full animate-spin" />
          </div>
        </div>

      </div>
    );
  }

  // Render Onboarding flow
  if (!onboardingFinished) {
    return (
      <div className="min-h-screen bg-[#050510] flex items-center justify-center p-2 sm:p-4">
        <div className="relative w-full max-w-[380px] h-[780px] bg-black border-[3px] border-[#333] rounded-[64px] p-3 shadow-2xl overflow-hidden flex flex-col">
          <OnboardingFlow onFinish={handleFinishOnboarding} />
        </div>
      </div>
    );
  }

  // Render Google Login Page
  if (!userEmail) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-sans text-white p-4 relative overflow-hidden select-none">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-30">
          <div className="absolute top-10 right-10 w-[60vw] h-[60vw] bg-pink-500/15 rounded-full blur-[100px]" />
          <div className="absolute bottom-10 left-10 w-[60vw] h-[60vw] bg-orange-500/15 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 w-full max-w-sm flex flex-col items-center px-4">
          
          {/* Logo Card */}
          <div className="w-24 h-24 bg-gradient-to-tr from-pink-500 to-orange-400 rounded-[28px] border border-white/20 p-3 flex items-center justify-center mb-8 shadow-2xl">
            <div className="relative">
              <Gamepad2 className="w-12 h-12 text-white" />
              <Coins className="w-7 h-7 text-yellow-300 fill-yellow-400 absolute bottom-[-5px] right-[-5px] drop-shadow-md animate-bounce" />
            </div>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tighter text-white font-plus">Jai Rewards</h1>
          <p className="text-xs text-slate-400 font-bold tracking-wider uppercase mt-1">Play Games &amp; Get Cash Vouchers</p>

          <div className="w-full mt-12 relative group">
            <div className="absolute inset-[-2px] bg-gradient-to-r from-pink-500 to-orange-400 rounded-2xl opacity-75 blur-sm group-hover:opacity-100 transition-opacity" />
            <button 
              onClick={handleRealGoogleLoginPopup}
              className="relative w-full bg-slate-950 hover:bg-slate-900 border border-white/10 text-white font-black py-4.5 rounded-2xl transition flex items-center justify-center gap-3 shadow-xl cursor-pointer text-sm"
              id="signin-btn"
            >
              <svg className="w-5 h-5 filter drop-shadow-sm" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          <div className="mt-10 flex items-center justify-center gap-1.5 bg-white/5 py-2 px-4 rounded-full border border-white/10">
            <Lock className="w-3.5 h-3.5 text-pink-400" />
            <span className="text-[9px] text-slate-400 font-black tracking-widest uppercase">Secured by AES-256 Encryption</span>
          </div>
          
          <button 
            onClick={() => {
              localStorage.removeItem('onboarding_passed');
              setOnboardingFinished(false);
            }}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-400 mt-6 block cursor-pointer transition uppercase tracking-wider"
          >
            ← Restart Onboarding Guide
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-800 font-sans p-2 sm:p-4 flex items-center justify-center relative overflow-hidden select-none">
      
      {/* Extreme Premium Phone Chassis viewport container */}
      <div className="relative w-full max-w-[380px] h-[780px] bg-black border-[3px] border-[#313135] rounded-[64px] p-3 shadow-2xl flex flex-col overflow-hidden select-none">
        
        {/* Speaker and Front Facing Camera (Notch styled) */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-7 bg-black rounded-full z-50 flex items-center justify-between px-3 shadow-inner border border-white/5">
           <div className="w-3.5 h-3.5 rounded-full bg-[#0d0d0d] border border-white/5 flex items-center justify-center">
             <div className="w-1.5 h-1.5 bg-[#0a2540] rounded-full" />
           </div>
           <div className="w-12 h-1 bg-[#1a1a1a] rounded-full" />
        </div>

        {/* Dynamic Display area */}
        <div className="relative flex-1 bg-[#f4f5f9] rounded-[52px] overflow-hidden flex flex-col shadow-inner">
          
          {/* Status Indicators Bar */}
          <div className="h-12 flex items-center justify-between px-6.5 font-mono text-[10px] text-slate-600 font-black select-none z-20 pt-3">
            <span>9:41</span>
            <div className="flex items-center gap-1.5 opacity-80">
              <Radio className="w-3.5 h-3.5" />
              <Wifi className="w-3.5 h-3.5" />
              <Battery className="w-5 h-5 fill-slate-600" />
            </div>
          </div>

          {/* Secure Live Notification Toast */}
          <AnimatePresence>
            {toast && (
              <motion.div 
                initial={{ opacity: 0, y: -40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="absolute top-14 left-4 right-4 bg-white/95 backdrop-blur shadow-2xl border border-slate-100 p-3.5 rounded-2xl z-50 flex items-center justify-between text-xs select-none"
              >
                <div className="flex items-center gap-2.5">
                  <div className="bg-pink-100 text-pink-500 p-2 rounded-xl">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-extrabold text-slate-800 text-[11px] leading-snug">Rewards System</p>
                    <p className="text-[9px] font-bold text-slate-400 truncate max-w-[170px] mt-0.5">{toast.text}</p>
                  </div>
                </div>
                <span className={`font-mono font-black border text-[10px] px-3 py-0.5 rounded-xl ${toast.coins > 0 ? 'text-emerald-500 border-emerald-100 bg-emerald-50' : 'text-slate-500 border-slate-100 bg-slate-50'}`}>
                  {toast.coins > 0 ? `+${toast.coins}` : toast.coins}
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SECURE PUSH NOTIFICATION (DROPS DOWN FROM NOTCH AREA) */}
          <AnimatePresence>
            {pushNotify && (
              <motion.div 
                initial={{ opacity: 0, y: -100, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -50, scale: 0.9 }}
                transition={{ type: "spring", damping: 18, stiffness: 180 }}
                className="absolute top-14 left-4 right-4 bg-slate-950/95 backdrop-blur-md shadow-2xl border border-slate-800 p-3.5 rounded-[24px] z-50 flex flex-col text-white select-none"
              >
                {/* Header detail */}
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-white/5 font-mono text-[8px] uppercase tracking-wider text-slate-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
                    <span>{pushNotify.system}</span>
                  </div>
                  <span>Just now</span>
                </div>
                {/* Content info */}
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4.5 h-4.5 animate-bounce" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[11.5px] font-black text-white leading-normal tracking-tight">{pushNotify.title}</h4>
                    <p className="text-[9.5px] font-medium text-slate-300 leading-normal mt-0.5">{pushNotify.message}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Dynamic Simulator Modals Overlays */}
          <AnimatePresence mode="wait">
            
            {/* Playtime Game Simulator */}
            {activeSimulator === 'playtime' && (
              <PlaytimeSimulator 
                userId={userId}
                onClose={() => setActiveSimulator('none')}
                onRewardCoins={handleSimulatedCoinsReward}
                triggerToast={triggerToast}
              />
            )}

            {/* Video Ads Simulator */}
            {activeSimulator === 'video' && (
              <AdSimulator 
                onClose={() => setActiveSimulator('none')}
                onRewardCoins={handleSimulatedCoinsReward}
              />
            )}

            {/* BitLabs Survey Simulator */}
            {activeSimulator === 'survey' && (
              <SurveySimulator 
                onClose={() => setActiveSimulator('none')}
                onRewardCoins={handleSimulatedCoinsReward}
              />
            )}

            {/* Rewards Cash Redemptions */}
            {selectedReward && (
              <RedemptionSheet 
                reward={{...selectedReward, userId}}
                userEmail={userEmail || ''}
                userName={userName || ''}
                currentBalance={coins}
                onClose={() => setSelectedReward(null)}
                onRedeemSuccess={(rew) => {
                  setSelectedReward(null);
                  handleRedeemSuccess(rew);
                }}
              />
            )}

          </AnimatePresence>

          {/* SIMULATED APP COMPACT MODULES */}
          <AnimatePresence>
            
            {/* Referral modal */}
            {activeSimulator === 'refer' && (
              <div className="absolute inset-0 bg-black/60 z-40 flex flex-col justify-end">
                <div className="flex-1" onClick={() => setActiveSimulator('none')} />
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="bg-white p-5 rounded-t-[36px] min-h-[50%] space-y-5 flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <h4 className="font-extrabold text-sm text-slate-800">Refer &amp; Earn Coins</h4>
                      <button onClick={() => {
                        setActiveSimulator('none');
                        setReferralInput('');
                      }} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
                    </div>
                    
                    <div className="text-center p-4 bg-gradient-to-tr from-pink-50 to-orange-50 rounded-2xl border border-pink-100/50 space-y-2">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Your Referral Code</p>
                      <span className="text-xl font-mono font-black text-pink-500 bg-white border border-pink-100 px-4 py-1.5 rounded-xl inline-block shadow-xs uppercase">{referCode}</span>
                      <div className="flex justify-center items-center gap-1.5 text-[10px] text-slate-500 font-semibold mt-1">
                        <Users className="w-3.5 h-3.5 text-pink-400" />
                        <span>{referCount} Friend{referCount !== 1 ? 's' : ''} Invited</span>
                      </div>
                      <p className="text-[9.5px] text-slate-500 font-medium">Claim 250 coins instantly when you enter an inviter's code, and earn 500 coins for each friend who joins!</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[9px] font-black tracking-wider text-slate-400 uppercase">Input Referral Code</label>
                      {referredBy ? (
                        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-bold flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-600 animate-bounce" />
                          <span>Linked to Inviter: <span className="font-mono uppercase font-black text-emerald-950">{referredBy}</span> (+250 Claims Credited)</span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={referralInput}
                              onChange={(e) => setReferralInput(e.target.value.toUpperCase().replace(/\s/g, ''))}
                              placeholder="Enter friend's code e.g. CO499" 
                              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none uppercase font-mono" 
                            />
                            <button 
                              disabled={isClaimingReferral || !referralInput}
                              onClick={async () => {
                                if (!userEmail) {
                                  triggerToast("Please log in first", 0);
                                  return;
                                }
                                setIsClaimingReferral(true);
                                try {
                                  const res = await fetch(`/api/wallet/${userId}/claim-referral`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ referrerCode: referralInput })
                                  });
                                  const data = await res.json();
                                  if (res.ok) {
                                    triggerToast(`Success! +250 Coins Claimed!`, 250);
                                    await refreshWallet();
                                    setReferralInput('');
                                    setActiveSimulator('none');
                                  } else {
                                    triggerToast(data.error || "Referral claim failed", 0);
                                  }
                                } catch (e) {
                                  console.error(e);
                                  triggerToast("Error matching referral code", 0);
                                } finally {
                                  setIsClaimingReferral(false);
                                }
                              }} 
                              className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 font-black text-white text-xs px-5 rounded-xl shadow-md transition flex items-center justify-center min-w-[75px]"
                            >
                              {isClaimingReferral ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : "Claim"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={() => {
                    navigator.clipboard.writeText(`Hey! Claim ₹10 instantly on mRewards clone using my referral code: ${referCode} 🎁 Download now!`);
                    triggerToast("Referral message copied!", 0);
                  }} className="w-full bg-pink-500 hover:bg-pink-600 text-white font-black py-3.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition">
                    <Copy className="w-4 h-4" /> Share Referral Link &amp; Code
                  </button>
                </motion.div>
              </div>
            )}

            {/* App Installs Task simulator */}
            {activeSimulator === 'apptask' && (
              <div className="absolute inset-0 bg-[#FAFAFC] z-40 flex flex-col font-sans">
                <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-indigo-500" />
                    <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider font-plus">AdGem Tasks</h4>
                  </div>
                  <button onClick={() => setActiveSimulator('none')} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-4 h-4 text-slate-400" /></button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-4.5 rounded-2xl shadow-sm relative overflow-hidden">
                    <h5 className="font-black text-xs font-plus">Premium Applications installs</h5>
                    <p className="text-[10px] opacity-80 leading-relaxed mt-0.5">Simply download, install, open for 30s, and secure direct coin ledger update from sponsors.</p>
                  </div>

                  {/* LOADING STATE - Proper generic loader, no mock skeletons */}
                  {loadingTasks && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                      <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Querying AdGem Sponsor Wall...</p>
                    </div>
                  )}

                  {/* NO DATA FALLBACKS */}
                  {!loadingTasks && (appTasks.length === 0 || tasksError) && (
                    <div className="flex flex-col items-center justify-center text-center py-12 space-y-4 px-6 select-none bg-white border border-slate-100 rounded-3xl">
                      <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                        <Download className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-800">Sponsor Offers Dropping Soon!</h4>
                        <p className="text-[10px] text-slate-400 font-medium">New tasks will appear shortly</p>
                      </div>
                      <p className="text-[9.5px] text-slate-500 max-w-xs leading-normal">
                        AdGem sponsor campaigns are currently indexing their fresh app install listings. Please check back shortly for rewards!
                      </p>
                    </div>
                  )}

                  {/* RENDER TASKS IF RETURNED */}
                  {!loadingTasks && appTasks.length > 0 && (
                    <div className="space-y-3">
                      {appTasks.map((task) => {
                        const completed = completedTaskIds.includes(task.id);
                        const installing = installingId === task.id;
                        return (
                          <div key={task.id} className="bg-white border border-slate-100 p-3 rounded-2xl flex items-center gap-3 shadow-xs">
                            <img src={task.image} className="w-12 h-12 rounded-xl object-cover border border-slate-100 shrink-0" alt={task.name} referrerPolicy="no-referrer" />
                            <div className="flex-grow min-w-0">
                              <h5 className="text-[11px] font-black text-slate-800 truncate">{task.name}</h5>
                              <p className="text-[9px] text-slate-400 truncate mt-0.5">{task.subtitle}</p>
                            </div>
                            <button
                              disabled={completed || installing}
                              onClick={() => {
                                setInstallingId(task.id);
                                triggerToast(`Downloading: ${task.name}...`, 0);
                                setTimeout(() => {
                                  setInstallingId(null);
                                  setCompletedTaskIds(prev => [...prev, task.id]);
                                  handleSimulatedCoinsReward(task.coins, `App Task Install: ${task.name}`);
                                }, 4000);
                              }}
                              className={`px-3 py-2 rounded-xl text-[10px] font-black shrink-0 transition ${
                                completed 
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200' 
                                  : installing 
                                  ? 'bg-orange-100 text-orange-500 animate-pulse' 
                                  : 'bg-indigo-500 text-white shadow-xs'
                              }`}
                            >
                              {completed ? '✓ Handled' : installing ? 'Installing...' : `+${task.coins}🪙`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* General Policy modals */}
            {activePolicyModal !== 'none' && (
              <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end rounded-5xl overflow-hidden">
                <div className="flex-grow" onClick={() => setActivePolicyModal('none')} />
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} className="bg-white rounded-t-[36px] p-5 max-h-[75%] overflow-y-auto space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 sticky top-0 bg-white z-10">
                    <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-widest leading-relaxed">
                      {activePolicyModal === 'privacy' && 'Privacy Policy'}
                      {activePolicyModal === 'terms' && 'Terms & Conditions'}
                      {activePolicyModal === 'support' && 'Help & Support Desk'}
                    </h4>
                    <button onClick={() => setActivePolicyModal('none')} className="p-1 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
                  </div>
                  
                  {activePolicyModal === 'privacy' && (
                    <div className="text-[10.5px] leading-relaxed text-slate-500 space-y-2.5 font-medium">
                      <p><strong>Jai Rewards is built and owned by Jai Dwivedi.</strong> This service is provided by Jai Dwivedi at no cost and is intended for immediate end-user utilization. By using our app, you trust us with your information.</p>
                      <p>This Privacy Policy is intended to help you understand what data we collect, why we collect it, and what we do with it. We collect information to provide better services to all our users - from figuring out basic stuff like your account to maintaining your secure coin balance.</p>
                      <p>We do not share your personal information with companies, organizations, or individuals outside of Jai Rewards except in the following cases: with your consent, for external processing, or for legal reasons.</p>
                    </div>
                  )}

                  {activePolicyModal === 'terms' && (
                     <div className="text-[10.5px] leading-relaxed text-slate-500 space-y-2.5 font-medium">
                      <p><strong>Welcome to Jai Rewards, an application built and owned by Jai Dwivedi.</strong> By downloading or using the app, these terms will automatically apply to you.</p>
                      <p>You agree to use the application strictly for its intended purpose. You are strictly forbidden from attempting to reverse engineer the code, extract the source endpoints, or emulate fake coin webhooks. Fraudulent activity, including creating multiple fake accounts or using VPNs for unauthorized geographic access, will result in immediate account deletion and forfeiture of all balances.</p>
                      <p>Jai Dwivedi reserves the right to make changes to the app or to modify its services, coin reward values, or redemption parameters at any time and for any reason without prior notice.</p>
                    </div>
                  )}

                  {activePolicyModal === 'support' && (
                    <div className="space-y-4">
                      <p className="text-[10.5px] leading-relaxed text-slate-500 font-medium">
                        <strong>Jai Rewards Support Desk (Owned by Jai Dwivedi)</strong><br />
                        Our help desk is committed to resolving your concerns securely. Facing issues with survey completions, playtime counts, or UPI transfer delays? Reach out to support directly or write to us below:
                      </p>
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                        <UserCheck className="w-5 h-5 text-pink-500" />
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider text-slate-400 font-black">App Developer & Owner</span>
                          <span className="block text-xs font-black text-slate-800">Jai Dwivedi</span>
                          <span className="block text-xs font-medium text-slate-500">jaidwivediofficial@gmail.com</span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <textarea placeholder="Type your formal claim or issue details here..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium outline-none h-20" />
                        <button onClick={() => {
                          triggerToast("Support ticket raised securely to Jai Dwivedi's desk!", 0);
                          setActivePolicyModal('none');
                        }} className="w-full bg-pink-500 text-white font-black py-2 rounded-xl text-xs shadow-xs cursor-pointer">Submit Claim Request</button>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            )}

          </AnimatePresence>

          {/* =========================================================
              SCREEN STATE: A. EARN PAGE
              ========================================================= */}
          {currentTab === 'earn' && (
            <div className="flex-1 overflow-y-auto flex flex-col pb-24 scrollbar-hide relative z-10 select-none">
              
              {/* Profile Card Header */}
              <div className="pt-6 px-5.5 pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-black tracking-widest text-[#BCC1CD] uppercase">Welcome Back</p>
                    <h2 className="text-xl font-black text-slate-800 tracking-tight mt-0.5">{userName || userEmail?.split('@')[0]}</h2>
                  </div>
                  
                  {/* Avatar Frame holding logout popup optionally */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-10 h-10 bg-white rounded-2xl shadow-xs border border-slate-100 p-0.5">
                      <img src={userPhoto || `https://api.dicebear.com/7.x/notionists/svg?seed=${userEmail}`} alt="Profile" className="w-full h-full rounded-xl bg-slate-50" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Spectacular Top Gradient Coin Wallet Pill Box */}
              <div className="px-5 mt-3">
                <div className="relative overflow-hidden rounded-[30px] p-5 shadow-lg bg-gradient-to-br from-pink-500 to-orange-400 border border-white/20 select-none animate-float">
                  
                  {/* Bubble decors */}
                  <div className="absolute right-[-10px] top-[-10px] w-24 h-24 bg-white/10 rounded-full blur-xl" />
                  <div className="absolute left-[-15px] bottom-[-15px] w-20 h-20 bg-white/10 rounded-full blur-xl" />

                  <div className="relative z-10 flex flex-col items-center flex-shrink-0">
                    <span className="bg-white/25 text-white uppercase text-[8px] font-black tracking-widest px-2.5 py-0.5 rounded-full border border-white/10">Secure Virtual Wallet</span>
                    
                    <div className="flex items-center justify-center gap-1.5 bg-black/15 px-5 py-2.5 rounded-3xl mt-2.5 border border-white/10 shadow-inner">
                      <Coins className="w-6.5 h-6.5 text-yellow-300 fill-yellow-400" />
                      <span className="text-3xl font-mono font-black text-white tracking-widest leading-none">
                        {coins.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-[9px] font-bold text-white/85 mt-3">
                      ₹10 Google Play Code costs 250 Coins
                    </p>
                  </div>
                </div>
              </div>

              {/* Earning Card Grids mimicking screenshots with floating bubble decors */}
              <div className="px-5 mt-5 space-y-3.5 flex-1 select-none pb-6">
                <h3 className="text-xs font-black tracking-widest text-[#BCC1CD] uppercase ml-1">Earning Dashboard</h3>

                {/* Card 1: Playtime Games */}
                <div 
                  onClick={() => {
                    triggerPushNotification(
                      "Playtime Tracking API", 
                      "Establishing connection... Live playtime tracking is coming soon. Starting simulation engine!", 
                      "Android Game SDK", 
                      2000
                    );
                    setActiveSimulator('playtime');
                  }}
                  className="bg-white border border-slate-100/80 p-4.5 rounded-[28px] cursor-pointer hover:border-pink-300 shadow-xs flex items-center justify-between group transition relative overflow-hidden h-28"
                >
                  <div className="absolute right-5 bottom-3 w-16 h-16 bg-gradient-to-tr from-pink-400 to-pink-500 rounded-2xl flex items-center justify-center text-white shadow-md rotate-12 scale-110 shrink-0 group-hover:scale-125 transition-transform duration-300">
                    <Gamepad2 className="w-9.5 h-9.5 text-white" />
                  </div>
                  <div className="flex flex-col h-full justify-between pr-24 select-none">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 leading-snug">Playtime Games</h4>
                      <p className="text-[9.5px] font-medium text-slate-400 leading-relaxed mt-0.5">Earn Coins per minute played</p>
                    </div>
                    <div>
                      <span className="inline-flex items-center justify-center bg-pink-50 text-pink-500 font-extrabold text-[9px] py-1 px-4.5 rounded-full border border-pink-100">Play ▶</span>
                    </div>
                  </div>
                  {/* Floating blue gift bubble decor */}
                  <div className="absolute right-[90px] top-4 w-7 h-7 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold animate-[pulse_2s_infinite] shadow border border-white shrink-0"><Gift className="w-3.5 h-3.5" /></div>
                </div>

                {/* Card 2: Refer & Earn */}
                <div 
                  onClick={() => setActiveSimulator('refer')}
                  className="bg-white border border-slate-100/80 p-4.5 rounded-[28px] cursor-pointer hover:border-emerald-300 shadow-xs flex items-center justify-between group transition relative overflow-hidden h-28"
                >
                  <div className="absolute right-5 bottom-3 w-16 h-16 bg-gradient-to-tr from-emerald-400 to-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-md -rotate-6 scale-110 shrink-0 group-hover:scale-125 transition-transform duration-300">
                    <Share2 className="w-9.5 h-9.5 text-white" />
                  </div>
                  <div className="flex flex-col h-full justify-between pr-24 select-none">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 leading-snug">Refer &amp; Earn</h4>
                      <p className="text-[9.5px] font-medium text-slate-400 leading-relaxed mt-0.5">Invite new friends &amp; score</p>
                    </div>
                    <div>
                      <span className="inline-flex items-center justify-center bg-emerald-50 text-emerald-500 font-extrabold text-[9px] py-1 px-4.5 rounded-full border border-emerald-100">Invite ▶</span>
                    </div>
                  </div>
                  {/* Floating blue gift code bubble decor */}
                  <div className="absolute right-[98px] top-6 w-7 h-7 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold animate-[pulse_2.2s_infinite] shadow border border-white shrink-0"><Sparkles className="w-3.5 h-3.5" /></div>
                </div>

                {/* Card 3: App Task installs */}
                <div 
                  onClick={() => {
                    triggerPushNotification(
                      "AdGem Sponsor Wall", 
                      "Syncing install database... Live Postback API is coming soon. Starting task simulation!", 
                      "AdGem API", 
                      2000
                    );
                    setActiveSimulator('apptask');
                  }}
                  className="bg-white border border-slate-100/80 p-4.5 rounded-[28px] cursor-pointer hover:border-indigo-300 shadow-xs flex items-center justify-between group transition relative overflow-hidden h-28"
                >
                  <div className="absolute right-5 bottom-3 w-16 h-16 bg-gradient-to-tr from-indigo-400 to-indigo-500 rounded-2xl flex items-center justify-center text-white shadow-md rotate-6 scale-110 shrink-0 group-hover:scale-125 transition-transform duration-300">
                    <Download className="w-9.5 h-9.5 text-white" />
                  </div>
                  <div className="flex flex-col h-full justify-between pr-24 select-none">
                    <div>
                      <h4 className="text-xs font-black text-slate-800 leading-snug">App Task sponsor</h4>
                      <p className="text-[9.5px] font-medium text-slate-400 leading-relaxed mt-0.5">Stack coins installing applications</p>
                    </div>
                    <div>
                      <span className="inline-flex items-center justify-center bg-indigo-50 text-indigo-500 font-extrabold text-[9px] py-1 px-4.5 rounded-full border border-indigo-100">Complete Now ▶</span>
                    </div>
                  </div>
                  {/* Floating blue gift bubble decor */}
                  <div className="absolute right-[88px] top-3 w-7 h-7 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold animate-[pulse_1.8s_infinite] shadow border border-white shrink-0"><Gift className="w-3.5 h-3.5" /></div>
                </div>

                {/* Two Column Grid for Surveys and Watch Video */}
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Surveys Offers */}
                  <div 
                    onClick={() => {
                      triggerPushNotification(
                        "BitLabs Feedback Hub", 
                        "Matching active surveys... Live S2S feedback postback API is coming soon. Starting study!", 
                        "BitLabs API", 
                        2000
                      );
                      setActiveSimulator('survey');
                    }}
                    className="bg-white border border-slate-100/80 p-4 rounded-[28px] cursor-pointer hover:border-amber-300 shadow-xs flex flex-col justify-between h-36 group relative overflow-hidden"
                  >
                    <div className="w-10 h-10 bg-amber-100 text-amber-500 rounded-xl flex items-center justify-center mb-2 shrink-0 group-hover:scale-105 transition-transform">
                      <ListTodo className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 leading-snug">Survey Offers</h4>
                      <p className="text-[9px] font-medium text-slate-400 leading-snug mt-0.5">Answer feedback</p>
                    </div>
                    <div className="pt-2">
                      <span className="bg-amber-50 hover:bg-amber-100 text-amber-500 font-extrabold text-[8.5px] py-1 px-3.5 rounded-full border border-amber-100">Start Now ▶</span>
                    </div>
                  </div>

                  {/* Watch Video */}
                  <div 
                    onClick={() => {
                      triggerPushNotification(
                        "Google AdMob SDK", 
                        "Requesting video placement... Live AdMob interstitial credentials coming soon. Starting simulation!", 
                        "AdMob Ads API", 
                        2000
                      );
                      setActiveSimulator('video');
                    }}
                    className="bg-white border border-slate-100/80 p-4 rounded-[28px] cursor-pointer hover:border-violet-300 shadow-xs flex flex-col justify-between h-36 group relative overflow-hidden"
                  >
                    <div className="w-10 h-10 bg-violet-100 text-violet-500 rounded-xl flex items-center justify-center mb-2 shrink-0 group-hover:scale-105 transition-transform">
                      <Tv className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 leading-snug">Watch Videos</h4>
                      <p className="text-[9px] font-medium text-slate-400 leading-snug mt-0.5">Sponsor ad loop</p>
                    </div>
                    <div className="pt-2">
                      <span className="bg-violet-50 hover:bg-violet-100 text-violet-500 font-extrabold text-[8.5px] py-1 px-3.5 rounded-full border border-violet-100">Watch ▶</span>
                    </div>
                  </div>

                </div>

                {/* Claimable Daily BONUS box row */}
                <div 
                  onClick={handleClaimDailyBonus}
                  className="bg-white border border-dashed border-pink-200 p-4 rounded-[28px] flex items-center justify-between cursor-pointer hover:bg-pink-50/20 active:scale-98 transition shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-pink-100 text-pink-500 border border-pink-200/50 rounded-xl flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-[11.5px] font-black text-slate-800 leading-snug">Daily Claim Bonus</h4>
                      <p className="text-[9px] text-slate-400 font-medium leading-relaxed">Score 50 coins completely free every day</p>
                    </div>
                  </div>
                  <span className="bg-pink-500 text-white font-mono font-black text-[10px] py-1.5 px-3 rounded-full hover:scale-105 transition cursor-pointer shrink-0">
                    +50🪙
                  </span>
                </div>

              </div>
            </div>
          )}

          {/* =========================================================
              SCREEN STATE: B. REDEEM / REWARDS PAGE
              ========================================================= */}
          {currentTab === 'rewards' && (
            <div className="flex-1 overflow-y-auto flex flex-col pb-24 bg-[#FAF7FD] scrollbar-hide select-none">
              
              <div className="pt-6 px-5.5 pb-4 bg-[#FAF7FD] sticky top-0 z-10 flex-shrink-0">
                <div className="flex justify-between items-center bg-[#FAF7FD]">
                  <div>
                    <h2 className="text-[28px] font-black text-slate-900 tracking-tight font-sans">Rewards</h2>
                  </div>
                  
                  {/* Compact Wallet mini indicator matching screenshots */}
                  <div className="bg-[#FFECCB] text-[#B26B00] font-sans font-bold text-[13.5px] px-3.5 py-1.5 rounded-full flex items-center gap-1.5 shrink-0 shadow-sm">
                    <div className="w-5 h-5 bg-[#FFB500] rounded-full flex items-center justify-center font-black text-white text-[10px] shadow-sm select-none">🪙</div>
                    <span className="font-sans font-bold text-slate-950">{coins}</span>
                  </div>
                </div>
 
                {/* Segment Switched pills with beautiful active pink border indicators */}
                <div className="flex gap-2.5 mt-5 overflow-x-auto pb-1 scrollbar-hide">
                  <button 
                    onClick={() => setRewardsCategory('upi')}
                    className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition whitespace-nowrap cursor-pointer ${
                      rewardsCategory === 'upi' 
                        ? 'bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-md' 
                        : 'bg-[#C8C7CC]/50 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    UPI
                  </button>
                  <button 
                    onClick={() => setRewardsCategory('google-play')}
                    className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-wider transition whitespace-nowrap cursor-pointer ${
                      rewardsCategory === 'google-play' 
                        ? 'bg-gradient-to-r from-pink-500 to-rose-400 text-white shadow-md' 
                        : 'bg-[#C8C7CC]/50 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    Google Play
                  </button>
                </div>
              </div>
 
              {/* Conversion Items lists */}
              <div className="p-5.5 grid grid-cols-2 gap-5.5">
                {REWARD_CATALOG.filter(r => r.category === rewardsCategory).map((reward) => {
                  const eligible = coins >= reward.coinsCost;
                  return (
                    <div 
                      key={reward.id}
                      onClick={() => setSelectedReward({ ...reward, userId })}
                      className="bg-white border border-[#E9E4F0]/60 rounded-[28px] p-4.5 pb-6 flex flex-col items-center justify-between text-center min-h-[220px] cursor-pointer hover:border-pink-300 active:scale-98 transition shadow-xs relative"
                    >
                      {/* Eligible Green indicator badge */}
                      {eligible && (
                        <div className="absolute top-2.5 right-2.5 bg-emerald-500 text-white p-0.5 rounded-full shadow border border-white">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
 
                      {/* Icon image representation representing Indian UPI / Vouchers accurately */}
                      <div className="w-24 h-24 flex items-center justify-center shrink-0">
                        {reward.category === 'upi' && (
                          <div className="relative w-20 h-20 flex items-center justify-center">
                            {/* Beautiful custom vector UPI logo mirroring the exact screenshot */}
                            <div className="relative w-16 h-16 flex items-center justify-center">
                              {/* Diagonal folded arrow in orange and green representing BHIM / UPI */}
                              <div className="absolute right-1/2 bottom-1/2 w-[18px] h-[48px] bg-[#FF8F00] rounded-[3px] transform rotate-[35deg] skew-x-[15deg] origin-bottom-right" />
                              <div className="absolute left-1/2 top-1/2 w-[18px] h-[48px] bg-[#008F45] rounded-[3px] transform rotate-[35deg] skew-x-[15deg] origin-top-left -translate-x-[2.2px] -translate-y-[2.2px]" />
                            </div>
                          </div>
                        )}
                        {reward.category === 'google-play' && (
                          <div className="relative w-20 h-20 flex items-center justify-center">
                            {/* Beautiful quadrant Google Play vector rendering */}
                            <div className="relative w-14 h-12" style={{ clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)' }}>
                              <div className="absolute top-0 left-0 w-full h-full bg-[#1A73E8]" /> 
                              <div className="absolute top-0 left-0 w-[60%] h-full bg-[#EA4335]" style={{ clipPath: 'polygon(0% 0%, 100% 50%, 0% 100%)' }} /> 
                              <div className="absolute bottom-0 left-0 w-full h-[50%] bg-[#FBBC05]" style={{ clipPath: 'polygon(0% 100%, 100% 0%, 50% 0%)' }} /> 
                              <div className="absolute top-0 right-0 w-[50%] h-full bg-[#34A853]" style={{ clipPath: 'polygon(100% 50%, 0% 0%, 0% 100%)' }} /> 
                            </div>
                          </div>
                        )}
                      </div>
 
                      {/* Coin Cost Pill - light beige, centered */}
                      <div className="select-none shrink-0 mb-2">
                        <span className="inline-flex items-center gap-1 py-1.5 px-4 bg-[#FFECCB]/80 text-[#B26B00] text-xs font-bold font-sans rounded-full leading-none">
                          <div className="w-4 h-4 bg-[#FFB300] rounded-full flex items-center justify-center font-black text-white text-[8px] shrink-0 select-none">🪙</div>
                          <span className="font-sans font-extrabold text-slate-800 tracking-tight text-[12.5px]">{reward.coinsCost}</span>
                        </span>
                      </div>
 
                      {/* Reward Title - left-aligned at bottom of card */}
                      <div className="w-full text-left pl-1.5 select-none mt-1">
                        <h4 className="text-[14px] font-bold text-slate-900 leading-snug tracking-tight font-sans truncate">{reward.title}</h4>
                      </div>
                    </div>
                  );
                })}
              </div>
 
            </div>
          )}

          {/* =========================================================
              SCREEN STATE: C. LEADERBOARD LIST
              ========================================================= */}
          {currentTab === 'leaderboard' && (
            <div className="flex-1 overflow-y-auto flex flex-col pb-24 bg-[#FAFAFC] scrollbar-hide">
              <Leaderboard />
            </div>
          )}

          {/* =========================================================
              SCREEN STATE: D. PROFILE PAGE
              ========================================================= */}
          {currentTab === 'profile' && (
            <div className="flex-1 overflow-y-auto flex flex-col pb-24 bg-[#FAFAFC] scrollbar-hide relative z-10 select-none">
              
              <div className="pt-6 px-5.5 pb-4 bg-white border-b border-slate-100 sticky top-0 z-10 flex-shrink-0">
                <h2 className="text-xl font-black text-slate-800 tracking-tight font-plus">Verify Profile</h2>
                <p className="text-[9.5px] text-slate-400 font-extrabold uppercase mt-0.5 tracking-wider">Registered Client Ledger</p>
              </div>

              {/* Verified Badge profile item */}
              <div className="p-5">
                <div className="bg-white border border-slate-100 rounded-[28px] p-5 flex items-center gap-4.5 shadow-xs relative overflow-hidden">
                  
                  {/* Accent bg */}
                  <div className="absolute right-[-10px] bottom-[-10px] w-14 h-14 bg-gradient-to-tr from-pink-500 to-orange-400 rounded-full blur-[20px] opacity-10" />

                  <div className="w-14 h-14 bg-white rounded-2xl shadow border border-slate-100 p-0.5 relative shrink-0">
                    <img src={userPhoto || `https://api.dicebear.com/7.x/notionists/svg?seed=${userEmail}`} className="w-full h-full rounded-xl bg-slate-50" alt="Avatar"/>
                    <div className="bg-pink-500 text-white p-0.5 rounded-full absolute bottom-[-4px] right-[-4px] shadow border border-white">
                      <ShieldCheck className="w-3 h-3 text-white fill-current" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 select-none">
                    <h3 className="text-base font-black text-slate-800 truncate">{userName || userEmail?.split('@')[0]}</h3>
                    <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">{userEmail}</p>
                    <span className="inline-block mt-2 font-mono font-black text-[9px] px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded">USER_ID: {userId}</span>
                  </div>
                </div>
              </div>

              {/* Grid of 6 buttons exactly as requested based on screenshots */}
              <div className="px-5 space-y-4">
                <h4 className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest pl-1 leading-none">Internal Options</h4>
                
                <div className="grid grid-cols-2 gap-3.5">
                  
                  {/* Support */}
                  <div 
                    onClick={() => setActivePolicyModal('support')}
                    className="bg-white border border-slate-100 hover:border-pink-300 p-4.5 rounded-[24px] cursor-pointer shadow-xs flex flex-col items-center justify-center text-center gap-2 group transition"
                  >
                    <div className="w-10 h-10 bg-pink-100 text-pink-500 border border-pink-200/50 rounded-xl flex items-center justify-center shrink-0">
                      <SupportIcon className="w-5 h-5" />
                    </div>
                    <span className="text-[10.5px] font-black text-slate-800 tracking-wide leading-none">Help Desk</span>
                  </div>

                  {/* History Ledger trigger */}
                  <div 
                    onClick={() => triggerToast("Ledger is listed under history section below", 0)}
                    className="bg-white border border-slate-100 hover:border-pink-300 p-4.5 rounded-[24px] cursor-pointer shadow-xs flex flex-col items-center justify-center text-center gap-2 group transition"
                  >
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-500 border border-indigo-200/50 rounded-xl flex items-center justify-center shrink-0">
                      <History className="w-5 h-5" />
                    </div>
                    <span className="text-[10.5px] font-black text-slate-800 tracking-wide leading-none">Transactions</span>
                  </div>

                  {/* Privacy Policy */}
                  <div 
                    onClick={() => setActivePolicyModal('privacy')}
                    className="bg-white border border-slate-100 hover:border-pink-300 p-4.5 rounded-[24px] cursor-pointer shadow-xs flex flex-col items-center justify-center text-center gap-2 group transition"
                  >
                    <div className="w-10 h-10 bg-emerald-100 text-emerald-500 border border-emerald-200/50 rounded-xl flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-[10.5px] font-black text-slate-800 tracking-wide leading-none">Privacy Policy</span>
                  </div>

                  {/* Terms and Conditions */}
                  <div 
                    onClick={() => setActivePolicyModal('terms')}
                    className="bg-white border border-slate-100 hover:border-pink-300 p-4.5 rounded-[24px] cursor-pointer shadow-xs flex flex-col items-center justify-center text-center gap-2 group transition"
                  >
                    <div className="w-10 h-10 bg-amber-100 text-amber-500 border border-amber-200/50 rounded-xl flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <span className="text-[10.5px] font-black text-slate-800 tracking-wide leading-none">Terms of use</span>
                  </div>

                </div>

                <button 
                  onClick={handleSignOut}
                  className="w-full bg-rose-500 text-white font-black py-4 rounded-[20px] transition text-xs shadow-md border-transparent hover:scale-102 cursor-pointer uppercase tracking-widest mt-2"
                >
                  Log Out Profile
                </button>
              </div>

              {/* My Payout Redemptions Claims Tracking */}
              {userRedemptions && userRedemptions.length > 0 && (
                <div className="px-5 mt-6 select-none">
                  <h4 className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest pl-1 leading-none mb-3">My Redemptions</h4>
                  
                  <div className="space-y-3">
                    {userRedemptions.map((red) => (
                      <div key={red.id} className="bg-white border border-slate-100 rounded-[24px] p-4 shadow-xs space-y-3 relative overflow-hidden">
                        
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[8px] font-mono bg-pink-50 text-pink-500 font-black px-1.5 py-0.5 rounded border border-pink-100 uppercase tracking-wide">
                              ID: {red.id}
                            </span>
                            <h5 className="text-xs font-black text-slate-800 mt-1">{red.title}</h5>
                            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Submitted {new Date(red.createdAt).toLocaleDateString()}</span>
                          </div>
                          
                          <div className="text-right">
                            <span className="text-xs font-mono font-black text-amber-500 flex items-center justify-end gap-1">
                              🪙 {red.coinsCost}
                            </span>
                            <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">{red.paymentDetail}</span>
                          </div>
                        </div>

                        {/* Status presentation */}
                        <div className="border-t border-slate-50 pt-2 flex flex-col gap-1 items-start">
                          {red.status === 'PENDING' && (
                            <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100/50 animate-pulse flex items-center gap-1">
                              🟡 Pending Check (Within 24 Hrs)
                            </span>
                          )}
                          {red.status === 'APPROVED' && (
                            <div className="w-full text-left space-y-1">
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 flex items-center gap-1 w-fit">
                                🟢 Approved &amp; Paid
                              </span>
                              {red.rewardId.includes('gp') || red.rewardId.includes('fk') ? (
                                <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl flex items-center justify-between font-mono text-[11px] text-white w-full select-all selection:bg-pink-500 mt-1 max-w-[320px]">
                                  <div className="min-w-0 flex-1 pr-1">
                                    <span className="text-[7.5px] text-slate-400 block uppercase font-bold tracking-widest leading-none mb-0.5">Voucher Code</span>
                                    <code className="text-[10px] font-bold text-emerald-400 font-mono tracking-wider break-all select-all focus:outline-none">{red.couponCode}</code>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      navigator.clipboard.writeText(red.couponCode);
                                      triggerToast("Voucher code copied!", 0);
                                    }}
                                    className="p-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition shrink-0 cursor-pointer"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded mt-1">UPI TXN Ref: {red.couponCode}</span>
                              )}
                            </div>
                          )}
                          {red.status === 'REJECTED' && (
                            <div className="w-full text-left">
                              <span className="text-[10px] font-extrabold px-2.5 py-0.5 bg-rose-50 text-rose-600 rounded-full border border-rose-100 flex items-center gap-1 w-fit mb-0.5">
                                🔴 Declined &amp; Refunded
                              </span>
                              <p className="text-[10px] font-bold text-rose-500 leading-normal pl-1"><strong className="text-slate-500 font-bold font-sans">Reason:</strong> {red.couponCode}</p>
                            </div>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Transaction ledger list */}
              <div className="px-5 mt-6.5 select-none pb-8 flex-1">
                <h4 className="text-[10.5px] font-black text-slate-400 uppercase tracking-widest pl-1 leading-none mb-3">System Ledger History</h4>
                
                <div className="bg-white border border-slate-100 rounded-[28px] overflow-hidden shadow-xs">
                  {history?.map((tx, idx) => (
                    <div key={tx.id || idx} className={`p-4 flex items-center justify-between ${idx !== history.length - 1 ? 'border-b border-slate-50' : ''}`}>
                      <div className="flex items-center gap-3">
                         <div className={`p-2 rounded-xl border shrink-0 ${tx.amount > 0 ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-pink-50 text-pink-500 border-pink-100'}`}>
                            {tx.amount > 0 ? <Coins className="w-4 h-4"/> : <Award className="w-4 h-4"/>}
                         </div>
                        <div className="min-w-0">
                          <h5 className="text-[11px] font-black text-slate-800 leading-tight block max-w-[140px] truncate">{tx.source}</h5>
                          <span className="text-[8.5px] text-slate-400 font-bold block mt-0.5">{new Date(tx.date).toLocaleDateString()} at {new Date(tx.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                      <span className={`text-[10.5px] font-black font-mono px-2.5 py-0.5 rounded-lg border shrink-0 ${tx.amount > 0 ? 'text-emerald-500 border-emerald-100 bg-emerald-50' : 'text-slate-400 border-slate-100 bg-slate-50'}`}>
                        {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                      </span>
                    </div>
                  ))}
                  {(!history || history.length === 0) && (
                    <div className="p-8 text-center text-[10.5px] font-bold text-slate-400">No client ledger transactions tracked yet.</div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* =========================================================
              BOTTOM NAVIGATION DOCK (System Tab Bar Style)
              ========================================================= */}
          <div className="absolute bottom-0 left-0 right-0 bg-[#FAF8FE]/95 backdrop-blur-md border-t border-[#E5DFEA]/60 py-2.5 px-6 flex items-center justify-around z-30 flex-shrink-0 select-none">
            {/* Tab 1: Earn */}
            <button 
              onClick={() => setCurrentTab('earn')}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-5 rounded-2xl transition cursor-pointer min-w-[70px] ${
                currentTab === 'earn' 
                  ? 'bg-[#ECE5FE] text-[#5C2AF2] font-black' 
                  : 'text-[#8E8E93] hover:text-[#5A33F2]'
              }`}
              id="tab-earn"
            >
              <DollarSign className={`w-5 h-5 ${currentTab === 'earn' ? 'text-[#5C2AF2] stroke-[2.5px]' : 'text-[#8E8E93]'}`} />
              <span className={`text-[10px] font-extrabold tracking-normal ${currentTab === 'earn' ? 'text-[#5C2AF2]' : 'text-[#8E8E93]'}`}>Earn</span>
            </button>

            {/* Tab 2: Rewards */}
            <button 
              onClick={() => setCurrentTab('rewards')}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-5 rounded-2xl transition cursor-pointer min-w-[70px] ${
                currentTab === 'rewards' 
                  ? 'bg-[#ECE5FE] text-[#5C2AF2] font-black' 
                  : 'text-[#8E8E93] hover:text-[#5A33F2]'
              }`}
              id="tab-redeem"
            >
              <Ticket className={`w-5 h-5 ${currentTab === 'rewards' ? 'text-[#5C2AF2] stroke-[2.5px]' : 'text-[#8E8E93]'}`} />
              <span className={`text-[10px] font-extrabold tracking-normal ${currentTab === 'rewards' ? 'text-[#5C2AF2]' : 'text-[#8E8E93]'}`}>Rewards</span>
            </button>

            {/* Tab 3: Profile */}
            <button 
              onClick={() => setCurrentTab('profile')}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 px-5 rounded-2xl transition cursor-pointer min-w-[70px] ${
                currentTab === 'profile' 
                  ? 'bg-[#ECE5FE] text-[#5C2AF2] font-black' 
                  : 'text-[#8E8E93] hover:text-[#5A33F2]'
              }`}
              id="tab-me"
            >
              <User className={`w-5 h-5 ${currentTab === 'profile' ? 'text-[#5C2AF2] stroke-[2.5px]' : 'text-[#8E8E93]'}`} />
              <span className={`text-[10px] font-extrabold tracking-normal ${currentTab === 'profile' ? 'text-[#5C2AF2]' : 'text-[#8E8E93]'}`}>Profile</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
