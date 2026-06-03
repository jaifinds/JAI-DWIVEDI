/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Tv, 
  X, 
  Loader2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AdSimulatorProps {
  onClose: () => void;
  onRewardCoins: (amount: number, source: string) => void;
}

export default function AdSimulator({ onClose }: AdSimulatorProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [videoAds, setVideoAds] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const fetchVideoAds = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/videos");
        if (!res.ok) {
          throw new Error("Failed to contact Google AdMob server");
        }
        const data = await res.json();
        if (active) {
          setVideoAds(data || []);
          setLoading(false);
        }
      } catch (e: any) {
        if (active) {
          console.error("AdMob connection failure:", e);
          setError("No video ads at the moment.");
          setLoading(false);
        }
      }
    };
    fetchVideoAds();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="absolute inset-0 bg-slate-950 flex flex-col z-40 rounded-3xl overflow-hidden text-slate-100 font-sans">
      
      {/* Header bar */}
      <div className="bg-slate-900/90 backdrop-blur p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tv className="w-5 h-5 text-violet-400" />
          <h3 className="text-sm font-bold tracking-tight text-white font-plus">Watch Videos</h3>
        </div>
        <button 
          onClick={onClose} 
          className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col justify-center p-6 text-center">
        <AnimatePresence mode="wait">

          {/* LOADING STATE - Generic spinner as instructed */}
          {loading && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3 flex flex-col items-center justify-center"
            >
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Requesting Google AdMob Fills...</p>
            </motion.div>
          )}

          {/* NO ADS AVAILABLE / ERROR / EMPTY STATE - Proper fallback as instructed */}
          {!loading && (videoAds.length === 0 || error) && (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4 flex flex-col items-center"
            >
              <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Tv className="w-6 h-6 text-slate-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white font-sans">No Videos Available Right Now</h4>
                <p className="text-xs text-slate-400 font-medium">New sponsor videos dropping soon!</p>
              </div>
              <p className="text-[10px] text-slate-500 max-w-xs leading-normal">
                Our ad networks are preparing personalized video placements. Please check back later.
              </p>
              <button 
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-750 text-slate-200 px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer mt-2"
              >
                Back to Dashboard
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
