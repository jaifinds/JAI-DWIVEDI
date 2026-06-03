/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Coins, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  ArrowRight,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { RewardItem } from '../types';

interface RedemptionSheetProps {
  reward: RewardItem & { userId?: string };
  userEmail: string;
  userName: string;
  currentBalance: number;
  onClose: () => void;
  onRedeemSuccess: (reward: RewardItem) => void;
}

export default function RedemptionSheet({ 
  reward, 
  userEmail,
  userName,
  currentBalance, 
  onClose, 
  onRedeemSuccess 
}: RedemptionSheetProps) {
  const [redeemState, setRedeemState] = useState<'confirm' | 'success' | 'failed'>('confirm');
  const [paymentDetail, setPaymentDetail] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  const canAfford = currentBalance >= reward.coinsCost;
  const isUPI = reward.category === 'upi';

  // Pre-fill email/UPI if user is logged in
  useEffect(() => {
    if (!isUPI && userEmail) {
      setPaymentDetail(userEmail);
    }
  }, [userEmail, isUPI]);

  // Validation function
  const validateInput = (val: string) => {
    if (!val.trim()) {
      return "Detail is required";
    }
    if (isUPI) {
      // Basic UPI ID validation (must contain @)
      if (!val.includes('@') || val.trim().endsWith('@') || val.trim().startsWith('@')) {
        return "Please enter a valid UPI Address (contains @)";
      }
    } else {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val.trim())) {
        return "Please enter a valid Gmail / Email address";
      }
    }
    return null;
  };

  const handleConfirmRedeem = async () => {
    if (!canAfford) {
      setRedeemState('failed');
      return;
    }

    const errorResult = validateInput(paymentDetail);
    if (errorResult) {
      setFormError(errorResult);
      return;
    }

    try {
      // Hit secure Express Backend with UPI ID / Gmail Address
      const res = await fetch(`/api/wallet/${reward.userId || 'player_1'}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rewardId: reward.id,
          cost: reward.coinsCost,
          details: reward.title,
          paymentDetail: paymentDetail.trim(),
          userName,
          userEmail
        })
      });

      if (!res.ok) {
        setRedeemState('failed');
        return;
      }

      setRedeemState('success');
      onRedeemSuccess(reward);

    } catch (e) {
      console.error("Redemption error: ", e);
      setRedeemState('failed');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPaymentDetail(val);
    if (formError) {
      setFormError(validateInput(val));
    }
  };

  const inputError = formError || validateInput(paymentDetail);

  return (
    <div className="absolute inset-0 bg-black/60 z-50 flex flex-col justify-end rounded-3xl overflow-hidden backdrop-blur-xs font-sans">
      
      {/* Click outside to close */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Body container */}
      <motion.div 
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="bg-white/90 backdrop-blur-3xl text-slate-950 rounded-[42px] rounded-b-none max-h-[90%] overflow-y-auto shadow-2xl p-6 space-y-5 flex flex-col border-t border-white"
      >
        {/* Drawer handle indicator */}
        <div className="w-12 h-1.5 bg-slate-300/50 rounded-full mx-auto" />

        {/* Header bar */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <span className="text-[10px] bg-slate-100 text-slate-500 uppercase tracking-widest font-mono font-bold px-2 py-0.5 rounded border border-slate-200">
              Confirm Reward
            </span>
            <h3 className="text-base font-extrabold text-slate-900 mt-1 font-plus">
              {reward.title}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dynamic Screen View State */}
        {redeemState === 'confirm' && (
          <div className="space-y-4 text-left">
            
            {/* Visual Icon card representation */}
            <div className="bg-gradient-to-tr from-slate-50 to-slate-100 p-4.5 rounded-2xl border border-slate-200/80 text-center relative overflow-hidden">
              <span className="text-4xl block animate-pulse select-none mb-1">
                {reward.category === 'upi' && '🇮🇳'}
                {reward.category === 'google-play' && '🎮'}
              </span>
              <p className="font-extrabold text-sm text-slate-950 font-plus">{reward.valueText}</p>
              <div className="inline-flex items-center gap-1.2 bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 mt-2 font-bold rounded-full border border-amber-200/50">
                <Coins className="w-3 h-3 text-amber-600 fill-amber-500" />
                <span>{reward.coinsCost} Coins Needed</span>
              </div>
            </div>

            {/* PAYMENT INFORMATION INCOMING FIELDS */}
            <div className="bg-white border border-slate-100 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  {isUPI ? "⚡ Deliver to UPI ID" : "📧 Delivery Email ID"}
                </span>
                <span className="text-[10px] font-mono text-slate-400">Required</span>
              </div>
              
              <div className="relative">
                <input
                  type="text"
                  value={paymentDetail}
                  onChange={handleInputChange}
                  placeholder={isUPI ? "Enter UPI ID (e.g. name@paytm , 9988xxx@ybl)" : "Enter registered Gmail ID"}
                  className={`w-full bg-slate-50 border px-3.5 py-2.5 rounded-xl text-xs font-mono font-bold focus:outline-none focus:ring-1 transition ${
                    formError 
                      ? 'border-rose-400 focus:ring-rose-400 focus:bg-white' 
                      : 'border-slate-200 focus:ring-pink-400 focus:bg-white'
                  }`}
                />
              </div>

              {formError && (
                <div className="flex items-center gap-1.5 text-rose-600 text-[10.5px] font-bold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{formError}</span>
                </div>
              )}

              <p className="text-[10px] text-slate-400 leading-normal">
                {isUPI 
                  ? "Coins will be deducted from your app wallet. Real UPI cash transfer will be manually approved and pushed directly to this address."
                  : "We'll send the Google Play active redeem voucher directly to this Gmail. Please verify the spelling to prevent lost keys."
                }
              </p>
            </div>

            {/* Notice elements */}
            <div className="bg-amber-50/60 border border-amber-100/60 p-4 rounded-xl space-y-1.5 text-xs">
              <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>Manual Verification Policy</span>
              </div>
              <p className="text-amber-700/90 leading-relaxed text-[11px] font-medium">
                Our security script checks for hacks &amp; duplicate tasks. Verified users get their UPI payouts or gift voucher coupon codes delivered <strong>within 24 hours</strong>.
              </p>
            </div>

            {/* Wallet State confirmation */}
            <div className="flex items-center justify-between text-[11px] p-3.5 bg-slate-50 rounded-xl border border-slate-200/60 font-mono">
              <span className="text-slate-500">Your current wallet balance</span>
              <span className={`font-bold font-mono ${canAfford ? 'text-emerald-600' : 'text-rose-600'}`}>
                {canAfford ? '🟢 ' : '🔴 '} {currentBalance} Coins
              </span>
            </div>

            {/* Error disclaimer if insufficient balance */}
            {!canAfford && (
              <div className="flex items-start gap-2 text-rose-700 bg-rose-50 border border-rose-200/60 p-3 rounded-lg text-xs leading-normal">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span className="font-medium">
                  <strong>Insufficient balance!</strong> Complete tasks, playtime games, or surveys on the <strong>Earn</strong> screen to stack up more coins.
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer text-center"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRedeem}
                disabled={!canAfford || !!inputError}
                className={`flex-1 py-3 text-xs font-bold text-white rounded-xl shadow-md transition flex items-center justify-center gap-1.5 ${
                  (canAfford && !inputError)
                    ? 'bg-gradient-to-r from-pink-500 to-orange-500 hover:scale-[1.02] active:scale-[0.98] cursor-pointer' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                Confirm Reward <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: SUCCESS REDEMPTION SCREEN */}
        {redeemState === 'success' && (
          <div className="space-y-4 text-center py-2">
            
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-md">
              <CheckCircle className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-950 font-plus">Redemption Handshaked!</h4>
              <p className="text-[11.5px] text-slate-500 px-6 font-medium leading-relaxed">
                Deducted <span className="text-amber-600 font-black">{reward.coinsCost} coins</span>. Your payout claim card is registered under verification ticket list.
              </p>
            </div>

            {/* Displays code based on items */}
            <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 text-left border border-slate-800 space-y-2 font-mono">
              <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Verification Status</span>
              <span className="text-amber-400 font-black font-mono text-xs tracking-wide bg-slate-950/80 px-2.5 py-1.5 rounded block border border-slate-800 uppercase">
                PENDING FULFILLMENT
              </span>
              <div className="text-[10.5px] text-slate-400 space-y-0.5 mt-2 leading-relaxed">
                <span className="font-bold text-slate-300">Deliver To: </span> <span className="font-semibold text-pink-400">{paymentDetail}</span>
                <p className="mt-1 text-slate-400 text-[9.5px]">
                  Voucher Delivery and payment check is processed securely. The admin will check, confirm and release the fund/code manually within 24 hours.
                </p>
              </div>
            </div>

            <div className="bg-slate-100 p-3 rounded-xl flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-500 shrink-0" />
              <p className="text-[10px] text-slate-500 text-left leading-normal font-medium">
                You can track payout and get your live redeem voucher keys directly inside <strong>My Redemptions</strong> on your Profile screen.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full bg-slate-900 hover:bg-slate-800 py-3 rounded-xl text-xs font-bold text-white transition shadow cursor-pointer text-center font-plus"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* STATE 3: FAILED */}
        {redeemState === 'failed' && (
          <div className="space-y-4 text-center py-2">
            
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-extrabold text-slate-950">Redemption Failed</h4>
              <p className="text-xs text-slate-500 px-6 leading-relaxed">
                An error occurred during backend verification. Ensure you have positive synced balances and stable network.
              </p>
            </div>

            <div className="pt-3">
              <button
                onClick={onClose}
                className="w-full bg-slate-800 hover:bg-slate-700 py-3 rounded-xl text-xs font-bold text-white transition cursor-pointer text-center"
              >
                Close Drawer
              </button>
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
}
