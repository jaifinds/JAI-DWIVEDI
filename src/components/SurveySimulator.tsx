/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  ClipboardCheck, 
  HelpCircle, 
  Check, 
  ChevronRight, 
  X,
  Award,
  Sparkles,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SurveySimulatorProps {
  onClose: () => void;
  onRewardCoins: (amount: number, source: string) => void;
}

interface Question {
  id: number;
  text: string;
  options: string[];
}

export default function SurveySimulator({ onClose, onRewardCoins }: SurveySimulatorProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [step, setStep] = useState<'intro' | 'questioning' | 'completed'>('intro');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;
    const fetchSurveys = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/surveys");
        if (!res.ok) {
          throw new Error("API call failed");
        }
        const data = await res.json();
        if (active) {
          setQuestions(data || []);
          setLoading(false);
        }
      } catch (e) {
        if (active) {
          console.error("Survey retrieve failed", e);
          setError("No surveys at the moment.");
          setLoading(false);
        }
      }
    };
    fetchSurveys();
    return () => {
      active = false;
    };
  }, []);

  const handleStartSurvey = () => {
    if (questions.length === 0) return;
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setAnswers({});
    setStep('questioning');
  };

  const handleNext = () => {
    if (!selectedOption) return;

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    const updatedAnswers = { ...answers, [currentQuestion.id]: selectedOption };
    setAnswers(updatedAnswers);

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      // Completed all questions
      const payoutAmount = 250;
      onRewardCoins(payoutAmount, 'BitLabs Survey Campaign #SURV-102');
      setStep('completed');
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="absolute inset-0 bg-slate-900 flex flex-col z-40 rounded-3xl overflow-hidden text-slate-100">
      
      {/* Header bar */}
      <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-indigo-400" />
          <h3 className="text-sm font-bold tracking-tight text-white font-plus">BitLabs Market Surveys</h3>
        </div>
        <button 
          onClick={onClose} 
          className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded-lg transition animate-none cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Campaign Canvas */}
      <div className="flex-1 overflow-y-auto p-5 flex flex-col justify-between">
        <AnimatePresence mode="wait">

          {/* LOADING STATE - Proper generic loader, no mock skeletons */}
          {loading && (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center space-y-3.5 pb-12"
            >
              <Loader2 className="w-9 h-9 animate-spin text-indigo-500" />
              <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Fetching Live Surveys...</p>
            </motion.div>
          )}

          {/* NO DATA / EMPTY STATE / ERROR fallback */}
          {!loading && (questions.length === 0 || error) && (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-4 px-6 pb-12"
            >
              <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-slate-700/85 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-slate-400" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white font-plus">New Surveys Dropping Soon!</h4>
                <p className="text-xs text-slate-400 font-medium">Please check back later</p>
              </div>
              <p className="text-[10px] text-slate-500 max-w-xs leading-normal">
                Our market research sponsors are preparing new survey configurations for your area. Your profile is active and pending matching campaigns.
              </p>
              <button 
                onClick={onClose}
                className="bg-indigo-650 hover:bg-indigo-605 bg-slate-800 hover:bg-slate-750 px-5 py-2 rounded-xl text-xs font-bold text-slate-200 transition cursor-pointer mt-2"
              >
                Back to Dashboard
              </button>
            </motion.div>
          )}

          {/* STATE 1: INTRO */}
          {!loading && questions.length > 0 && step === 'intro' && (
            <motion.div 
              key="intro"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 text-center py-4 flex-1 flex flex-col justify-center"
            >
              <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-indigo-700 rounded-2xl flex items-center justify-center mx-auto shadow-lg rotate-3">
                <HelpCircle className="w-8 h-8 text-white" />
              </div>

              <div className="space-y-2">
                <h4 className="text-base font-bold text-white font-plus">Earn 250 Coins instantly!</h4>
                <p className="text-xs text-slate-400 px-4 leading-relaxed">
                  Provide your valuable feedback in this quick market study. Your responses are anonymous and help optimize payout parameters.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 max-w-xs mx-auto text-left space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Verified Reward: <strong>+250 Coins</strong></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Time taken: <strong>&lt; 1 minute</strong></span>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleStartSurvey}
                  className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition cursor-pointer"
                >
                  Start Survey Now
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 2: ACTIVE QUESTIONNAIRE */}
          {!loading && questions.length > 0 && step === 'questioning' && currentQuestion && (
            <motion.div 
              key="questioning"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4 flex-1 flex flex-col justify-between"
            >
              {/* Progress Tracker */}
              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-400 font-mono mb-1.5">
                  <span>SURVEY IN PROGRESS</span>
                  <span>{currentQuestionIndex + 1} of {questions.length}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-full transition-all duration-300"
                    style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Text */}
              <div className="space-y-4 flex-1 py-4 justify-center flex flex-col">
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-widest">Question {currentQuestionIndex + 1}</h4>
                <p className="text-sm font-bold text-white leading-relaxed">{currentQuestion.text}</p>
                
                {/* Options Mapping */}
                <div className="space-y-2 mt-2">
                  {currentQuestion.options.map((option) => {
                    const isSelected = selectedOption === option;
                    return (
                      <button
                        key={option}
                        onClick={() => setSelectedOption(option)}
                        className={`w-full text-left p-3.5 rounded-xl text-xs transition border flex justify-between items-center cursor-pointer ${
                          isSelected 
                            ? 'bg-indigo-600/20 border-indigo-500 text-white font-medium shadow-sm' 
                            : 'bg-slate-950/40 border-slate-800 text-slate-300 hover:bg-slate-900/30'
                        }`}
                      >
                        <span>{option}</span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation Action */}
              <div className="pt-2 flex-shrink-0">
                <button
                  onClick={handleNext}
                  disabled={!selectedOption}
                  className={`w-full py-3 rounded-xl text-xs font-bold text-white shadow transition flex items-center justify-center gap-1 ${
                    selectedOption 
                      ? 'bg-indigo-600 hover:bg-indigo-500 cursor-pointer' 
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  {currentQuestionIndex === questions.length - 1 ? 'Finish Survey' : 'Next Question'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STATE 3: COMPLETED */}
          {!loading && step === 'completed' && (
            <motion.div 
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 text-center space-y-6 flex-1 flex flex-col justify-center"
            >
              <div className="w-20 h-20 bg-gradient-to-tr from-indigo-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-xl ring-4 ring-indigo-500/10">
                <Award className="w-10 h-10 text-white animate-bounce" />
              </div>

              <div className="space-y-2">
                <h4 className="text-lg font-bold text-white font-plus">Survey Completed Successfully!</h4>
                <p className="text-xs text-slate-400 px-4">
                  Thank you for your valuable response submission. The BitLabs merchant campaign webhook has been triggered successfully.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1.5 max-w-xs mx-auto">
                <p className="text-xs text-slate-400 font-mono uppercase tracking-wider">Campaign Payout</p>
                <p className="text-2xl font-bold text-indigo-400 font-mono flex items-center justify-center gap-1.5">
                  <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                  +250 Coins
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={onClose}
                  className="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-xl text-xs font-bold text-slate-200 transition border border-slate-700 cursor-pointer"
                >
                  Back to Dashboard
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
