import React, { useState, useEffect } from 'react';
import { Gamepad2, Play, Users, X, Clock, Coins, ShieldCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GameItem {
  id: string;
  name: string;
  genre: string;
  coinsPerMin: number;
  totalCoinsPotential: number;
  playersCount: string;
  bannerPhoto: string;
}

interface PlaytimeSimulatorProps {
  userId: string;
  onClose: () => void;
  onRewardCoins: (amount: number, source: string) => void;
  triggerToast: (text: string, amount: number) => void;
}

export default function PlaytimeSimulator({ userId, onClose, onRewardCoins, triggerToast }: PlaytimeSimulatorProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameItem[]>([]);

  const [activeGame, setActiveGame] = useState<GameItem | null>(null);
  const [gameState, setGameState] = useState<'browsing' | 'booting' | 'playing' | 'earned'>('browsing');
  const [secondsPlayed, setSecondsPlayed] = useState(0);
  const [sessionEarnings, setSessionEarnings] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchGames = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/playtime-games");
        if (!res.ok) {
          throw new Error("Failed to fetch games");
        }
        const data = await res.json();
        if (active) {
          setGames(data || []);
          setLoading(false);
        }
      } catch (e) {
        if (active) {
          console.error("Game fetch error:", e);
          setError("No games available at the moment.");
          setLoading(false);
        }
      }
    };
    fetchGames();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (gameState === 'playing' && activeGame) {
      timer = setInterval(() => {
        setSecondsPlayed(prev => {
          const updated = prev + 1;
          
          // Every 10 seconds, reward coins securely over API!
          if (updated > 0 && updated % 10 === 0 && activeGame) {
            triggerSecureEarn(activeGame.coinsPerMin, `Playtime Level Up: ${activeGame.name}`);
            setSessionEarnings(earn => earn + activeGame.coinsPerMin);
          }
          
          return updated;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [gameState, activeGame]);

  const triggerSecureEarn = async (amount: number, sourceName: string) => {
    try {
      const res = await fetch(`/api/wallet/${userId}/earn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: 'playtime_gaming',
          reward: amount,
          source: sourceName
        })
      });
      if (res.ok) {
        onRewardCoins(amount, sourceName);
      }
    } catch (e) {
      console.error("Could not complete playtime secure earn", e);
    }
  };

  const handleStartPlay = (game: GameItem) => {
    setActiveGame(game);
    setGameState('booting');
    setSecondsPlayed(0);
    setSessionEarnings(0);

    setTimeout(() => {
      setGameState('playing');
    }, 2500);
  };

  const handleStopPlaying = () => {
    setGameState('browsing');
    setActiveGame(null);
  };

  return (
    <div className="absolute inset-0 bg-[#FAFAFC] z-40 rounded-3xl overflow-hidden text-slate-800 flex flex-col font-sans">
      
      {/* HEADER BAR */}
      <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-pink-500" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-wide font-plus">Playtime Games</h2>
        </div>
        {gameState === 'browsing' && (
          <button 
            onClick={onClose} 
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* BODY CANVAS */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* LOADING STATE - generic spinner, no mock skeletons */}
          {loading && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#FAFAFC] flex flex-col items-center justify-center space-y-3 p-6"
            >
              <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
              <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Syncing Playtime Hub...</p>
            </motion.div>
          )}

          {/* NO DATA / ERRORS */}
          {!loading && (games.length === 0 || error) && (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#FAFAFC] flex flex-col items-center justify-center text-center space-y-4 px-6"
            >
              <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                <Gamepad2 className="w-6 h-6 text-slate-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">New Playtime Campaigns Dropping Soon!</h4>
                <p className="text-xs text-slate-400 font-medium font-sans">Our game publishers are preparing direct playtime rewards.</p>
              </div>
              <p className="text-[10px] text-slate-500 max-w-xs leading-normal">
                Stay tuned! Top immersive games are currently syncing with our secure verifiers. Please check back shortly.
              </p>
              <button 
                onClick={onClose}
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2 rounded-xl text-xs font-bold transition cursor-pointer mt-2"
              >
                Back to Dashboard
              </button>
            </motion.div>
          )}

          {/* STATE 1: BROWSING */}
          {!loading && games.length > 0 && gameState === 'browsing' && (
            <motion.div 
              key="browsing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-5 space-y-5"
            >
              {/* Promo Banner */}
              <div className="bg-gradient-to-r from-pink-500 to-orange-500 p-5 rounded-3xl text-white shadow-md relative overflow-hidden">
                <div className="absolute inset-0 bg-white/5" />
                <div className="absolute -right-10 -bottom-10 w-36 h-36 bg-white/10 rounded-full blur-2xl" />
                
                <span className="bg-white/25 text-white uppercase text-[8px] font-black tracking-widest px-2 py-0.5 rounded border border-white/20">Active Campaign</span>
                <h3 className="text-base font-black tracking-tight mt-1.5 font-plus">Double Playtime Event!</h3>
                <p className="text-[10px] opacity-90 leading-relaxed mt-1">Get rewarded instantly directly to your registered wallet balance every second you play. Powered protectively by server-safe verifiers.</p>
              </div>

              <div className="space-y-4">
                <h4 className="text-[11px] font-black tracking-widest text-slate-400 uppercase">Available Games</h4>

                {games.map((game) => (
                  <div 
                    key={game.id}
                    className="bg-white border border-slate-100 rounded-[28px] p-4 flex flex-col gap-4 shadow-sm relative overflow-hidden group"
                  >
                    <div className="flex gap-4">
                      {/* Image representation */}
                      <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-slate-100 shadow-sm relative">
                        <img src={game.bannerPhoto} alt={game.name} className="absolute inset-0 w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] font-bold text-pink-500 block uppercase tracking-wider">{game.genre}</span>
                          <h5 className="text-xs font-black text-slate-800 truncate tracking-tight">{game.name}</h5>
                          <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5"><Users className="w-3 h-3 text-emerald-500" /> {game.playersCount}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-extrabold font-mono mt-1">
                          <Coins className="w-4 h-4 text-amber-500 fill-amber-400" />
                          <span>+{game.coinsPerMin} Coins / min</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-1 flex-shrink-0">
                      <span className="text-[9px] font-black text-slate-400">Total potential: <strong className="text-slate-600 font-bold">{game.totalCoinsPotential}🪙</strong></span>
                      <button
                        onClick={() => handleStartPlay(game)}
                        className="bg-gradient-to-r from-pink-500 to-orange-500 text-white font-black text-[11px] py-2 px-5 rounded-full shadow-md flex items-center gap-1 hover:scale-[1.03] transition cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current mt-0.5" /> Play Now
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STATE 2: BOOTING */}
          {gameState === 'booting' && (
            <motion.div 
              key="booting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center space-y-6 text-center text-white"
            >
              <div className="w-16 h-16 bg-gradient-to-r from-pink-500 to-orange-400 rounded-full flex items-center justify-center animate-spin">
                <Loader2 className="w-8 h-8 text-white animate-pulse" />
              </div>

              <div className="space-y-1.5 px-10">
                <h3 className="text-sm font-black font-plus font-sans">Jai Launcher Booting...</h3>
                <p className="text-[10px] text-slate-400">Mounting simulated smartphone playtime metrics overlay. Please wait.</p>
              </div>

              <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-full inline-flex items-center gap-1.5 text-[9px] text-pink-400 uppercase font-black tracking-widest">
                <ShieldCheck className="w-3.5 h-3.5" /> Secure Hook Active
              </div>
            </motion.div>
          )}

          {/* STATE 3: PLAYING ENVIRONMENT */}
          {gameState === 'playing' && activeGame && (
            <motion.div 
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-slate-950 flex flex-col justify-between p-6 text-white"
            >
              {/* Header metrics overlay */}
              <div className="flex justify-between items-center bg-black/40 backdrop-blur border border-white/5 p-3 rounded-full">
                <span className="text-[9px] font-black tracking-widest text-pink-400 block uppercase">Simulator Playing</span>
                <span className="text-[9px] font-mono font-black text-rose-400 flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full">
                  <Clock className="w-3.5 h-3.5 animate-spin" /> {Math.floor(secondsPlayed / 60)}m {secondsPlayed % 60}s
                </span>
              </div>

              {/* Game Frame Canvas */}
              <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                
                <div className="relative w-36 h-36 rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                  <img src={activeGame.bannerPhoto} alt={activeGame.name} className="absolute inset-0 w-full h-full object-cover opacity-80 animate-none" referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-3 justify-center">
                    <span className="text-[9px] font-black text-white bg-pink-500/80 px-2 py-0.5 rounded uppercase">LIVE</span>
                  </div>
                </div>

                <div className="text-center space-y-2 px-10">
                  <h4 className="text-sm font-black tracking-tight">{activeGame.name}</h4>
                  <p className="text-[10px] text-slate-400 leading-normal">Your playing metrics are tracked protectively on our server. Keep game active and earn Coins!</p>
                </div>

                {/* Earnings stack box */}
                <div className="bg-white/5 border border-white/10 p-4 rounded-3xl text-center space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Session Coins Stacked</span>
                  <div className="text-xl font-black text-amber-400 flex items-center justify-center gap-1.5 font-mono">
                    <Coins className="w-5 h-5 text-amber-500 fill-amber-400" />
                    +{sessionEarnings} Coins
                  </div>
                  <span className="text-[8px] text-pink-400 block uppercase font-bold tracking-wider">+{activeGame.coinsPerMin} coins credited secure every 10s</span>
                </div>
              </div>

              {/* Exit button */}
              <button
                onClick={handleStopPlaying}
                className="w-full bg-[#1A0A10] hover:bg-rose-950 font-black text-rose-400 py-3 rounded-2xl transition border border-rose-950 flex items-center justify-center gap-1 text-xs cursor-pointer"
              >
                Exit Game &amp; Keep Earnings <X className="w-4 h-4 ml-1" />
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
