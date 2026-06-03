import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Flame, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(data => {
        setLeaders(data);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  return (
    <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} className="flex-1 overflow-y-auto pb-32">
      <div className="pt-12 px-5 pb-6 bg-gradient-to-b from-amber-500/10 to-transparent sticky top-0 z-10 backdrop-blur-md">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
          <Trophy className="w-8 h-8 text-amber-500 fill-amber-400" /> Leaderboard
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-medium">Top 10 lifetime earners.</p>
      </div>

      <div className="px-5 space-y-3 relative z-10">
        
        {loading ? (
            <div className="flex items-center justify-center p-10">
                <Loader2 className="w-8 h-8 animate-spin text-slate-500" />
            </div>
        ) : leaders.length === 0 ? (
            <div className="text-center text-slate-400 p-10 font-bold text-sm">No ranks acquired yet</div>
        ) : (
            leaders.map((user, idx) => (
            <div key={user.rank} className={`bg-white border p-4 rounded-3xl flex items-center gap-4 transition-transform hover:scale-[1.02] ${idx < 3 ? 'border-amber-300 shadow-[0_8px_20px_rgba(245,158,11,0.06)]' : 'border-slate-100 shadow-sm'}`}>
              <div className={`w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center font-black shadow-inner ${idx === 0 ? 'bg-amber-500 text-white' : idx === 1 ? 'bg-slate-350 text-slate-700 bg-slate-200' : idx === 2 ? 'bg-orange-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {idx < 3 ? <Medal className="w-6 h-6 text-white" /> : `#${user.rank}`}
              </div>
              
              <div className="flex-1 overflow-hidden">
                <h3 className="text-slate-800 font-extrabold text-[15px] truncate">{user.name}</h3>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Global Ranking</div>
              </div>
              
              <div className="text-right shrink-0">
                <div className="text-amber-600 font-black text-[15px]">{user.coins.toLocaleString()}</div>
                <div className="text-[9px] text-amber-500 font-bold uppercase tracking-widest">Coins</div>
              </div>
            </div>
          ))
        )}

      </div>
    </motion.div>
  );
}
