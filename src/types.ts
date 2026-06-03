/// <reference types="vite/client" />
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  type: 'earn' | 'redeem';
  source: string;
  coins: number;
  status: 'Completed' | 'Pending' | 'Failed';
  timestamp: string;
  code?: string;
  pin?: string;
}

export interface EarnTask {
  id: string;
  title: string;
  subtitle: string;
  actionText: string;
  coinsReward: string;
  tag?: string;
}

export interface RewardItem {
  id: string;
  category: 'upi' | 'google-play' | 'flipkart' | 'amazon' | 'apple' | 'gaming' | 'crypto' | 'paypal';
  title: string;
  valueText: string;
  coinsCost: number;
  imageAlt: string;
  userId?: string;
}

export interface UserProfile {
  name: string;
  username: string;
  avatarUrl: string;
  referralCode: string;
}
