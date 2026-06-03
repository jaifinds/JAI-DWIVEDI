import React, { useState } from 'react';
import { Gamepad2, Gift, PiggyBank, ArrowRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OnboardingFlowProps {
  onFinish: () => void;
}

export default function OnboardingFlow({ onFinish }: OnboardingFlowProps) {
  const [activeSlide, setActiveSlide] = useState(0);

  const slides = [
    {
      title: "Play Games & Earn",
      description: "Earn coins for every single minute you spend playing games. The more you play, the richer you accumulate!",
      icon: (
        <div className="relative">
          <div className="absolute inset-0 bg-pink-500/20 blur-3xl rounded-full scale-110 animate-pulse" />
          <div className="w-32 h-32 bg-gradient-to-tr from-pink-500 to-orange-400 rounded-[36px] flex items-center justify-center shadow-lg relative border border-white/20">
            <Gamepad2 className="w-16 h-16 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]" />
          </div>
        </div>
      ),
      bgClass: "from-pink-500 to-orange-400"
    },
    {
      title: "Refer Friends & Accumulate",
      description: "Invite your buddies to join Jai Rewards and obtain 250 Coins instantly, plus pocket a lifetime 10% cash commission of their earnings!",
      icon: (
        <div className="relative">
          <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-110 animate-pulse" />
          <div className="w-32 h-32 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-[36px] flex items-center justify-center shadow-lg relative border border-white/20">
            <Gift className="w-16 h-16 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]" />
          </div>
        </div>
      ),
      bgClass: "from-emerald-400 to-teal-500"
    },
    {
      title: "Instant UPI & Vouchers",
      description: "Redeem your accumulated wealth instantly to Google Play Redeem Codes or direct UPI Cash transfers!",
      icon: (
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full scale-110 animate-pulse" />
          <div className="w-32 h-32 bg-gradient-to-tr from-blue-500 to-indigo-600 rounded-[36px] flex items-center justify-center shadow-lg relative border border-white/20">
            <PiggyBank className="w-16 h-16 text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.15)]" />
          </div>
        </div>
      ),
      bgClass: "from-blue-500 to-indigo-600"
    }
  ];

  const handleNext = () => {
    if (activeSlide < slides.length - 1) {
      setActiveSlide(prev => prev + 1);
    } else {
      onFinish();
    }
  };

  const currentSlide = slides[activeSlide];

  return (
    <div className="p-5 flex-1 flex flex-col justify-between h-full bg-[#FAFAFC] relative font-sans text-slate-800">
      
      {/* Skip Button */}
      <div className="flex justify-end pt-10 px-2 z-10">
        {activeSlide < slides.length - 1 && (
          <button 
            onClick={onFinish}
            className="text-[11px] font-black tracking-widest text-slate-400 uppercase hover:text-slate-600 transition"
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide Content wrapper */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -15 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex flex-col items-center text-center space-y-8 max-w-sm"
          >
            {/* Visual Icon */}
            {currentSlide.icon}

            <div className="space-y-4">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight font-plus px-4">
                {currentSlide.title}
              </h2>
              <p className="text-[12px] font-medium leading-relaxed text-slate-500 px-6">
                {currentSlide.description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Indicator dots and Action Arrow Button */}
      <div className="pb-10 pt-4 flex flex-col items-center space-y-6">
        
        {/* Step dots */}
        <div className="flex items-center gap-1.5 justify-center">
          {slides.map((_, idx) => (
            <div 
              key={idx}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === activeSlide 
                  ? 'w-6 bg-gradient-to-r from-pink-500 to-orange-400' 
                  : 'w-2 bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* Swipe Button / Continue */}
        <button
          onClick={handleNext}
          className="relative group w-14 h-14 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full flex items-center justify-center text-white shadow-[0_10px_20px_rgba(244,63,94,0.3)] hover:scale-105 active:scale-95 transition cursor-pointer"
          id={`onboarding-next-${activeSlide}`}
        >
          <div className="absolute inset-0 bg-white/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          {activeSlide === slides.length - 1 ? (
            <Sparkles className="w-5 h-5" />
          ) : (
            <ArrowRight className="w-5 h-5 text-white" />
          )}
        </button>
        
        {activeSlide === slides.length - 1 && (
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">Tap arrow to begin earning</p>
        )}
      </div>

    </div>
  );
}
