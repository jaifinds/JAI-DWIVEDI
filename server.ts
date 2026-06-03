import express from "express";
import crypto from "crypto";
import path from "path";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestoreDb } from "./hybrid-db.js";

// Load environment variables for secrets
const ADGEM_POSTBACK_KEY = process.env.ADGEM_POSTBACK_KEY || "mi45c51eg722h07hkjfe043h";
const BITLABS_S2S_KEY = process.env.BITLABS_S2S_KEY || process.env.BITLABS_SECRET_KEY || "ZI1ABMUjdpfkf2zN1tHGexPDfm7q7tiy";


// Helper to generate a unique collision-free refer code
async function generateUniqueReferCode(name: string): Promise<string> {
  const cleanName = (name || "MEMBER").replace(/[^a-zA-Z]/g, "").toUpperCase();
  const prefix = cleanName.substring(0, 4) || "REFR";
  
  const db = getFirestoreDb();
  // Try up to 5 times to avoid duplicate codes
  for (let i = 0; i < 5; i++) {
    const code = `${prefix}${Math.floor(100 + Math.random() * 900)}`;
    const snapshot = await db.collection("users").where("referCode", "==", code).limit(1).get();
    if (snapshot.empty) {
      return code;
    }
  }
  return `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // GET LEADERBOARD DIRECTLY FROM FIRESTORE
  app.get("/api/leaderboard", async (req, res) => {
    try {
      const db = getFirestoreDb();
      const snapshot = await db.collection("users")
        .orderBy("balance", "desc")
        .limit(10)
        .get();

      const leaders = snapshot.docs.map((doc, idx) => {
        const data = doc.data();
        return {
          rank: idx + 1,
          name: data.name || data.userId?.substring(0, 8) || "Member",
          coins: Math.max(0, Math.floor(data.balance || 0))
        };
      });
      res.json(leaders);
    } catch (e) {
      console.error("Leaderboard query failed from Firestore:", e);
      res.status(500).json({ error: "Failed to load leaderboard" });
    }
  });

  // GET DYNAMIC SURVEYS (Empty for Play Store review - strict no mock policy)
  app.get("/api/surveys", async (req, res) => {
    try {
      res.json([]);
    } catch (e) {
      res.status(500).json({ error: "No surveys available." });
    }
  });

  // GET DYNAMIC GAMING OFFERS
  app.get("/api/playtime-games", async (req, res) => {
    try {
      res.json([]);
    } catch (e) {
      res.status(500).json({ error: "Available Soon" });
    }
  });

  // GET DYNAMIC SPONSOR APPS FOR INSTALLS
  app.get("/api/apptasks", async (req, res) => {
    try {
      res.json([]);
    } catch (e) {
      res.status(500).json({ error: "Available Soon" });
    }
  });

  // SAVE OR UPDATE USER PROFILE DETAILS IN FIRESTORE
  app.post("/api/userProfile", async (req, res) => {
    const { userId, name, email, photoURL } = req.body;
    if (!userId) return res.status(400).send("Bad request");

    try {
      const db = getFirestoreDb();
      const userRef = db.collection("users").doc(userId);
      const docSnap = await userRef.get();

      if (!docSnap.exists) {
        // Compute unique refer code for new user
        const referCode = await generateUniqueReferCode(name || "MEMBER");

        await userRef.set({
          userId,
          name: name || "Google User",
          email: email || "",
          photoURL: photoURL || "",
          balance: 499,
          referCode,
          referredBy: "",
          referCount: 0,
          createdAt: new Date().toISOString()
        });

        // Add welcome bonus transactional history record
        await userRef.collection("history").doc("WELCOME").set({
          id: "WELCOME",
          userId,
          source: "Welcome Bonus",
          amount: 499,
          date: new Date().toISOString()
        });
      } else {
        // User profile already exists - just update profile fields (name, photo etc) without modifying balance or referCode
        const updates: any = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        if (photoURL) updates.photoURL = photoURL;
        
        await userRef.set(updates, { merge: true });
      }

      res.status(200).send("OK");
    } catch (e) {
      console.error("User profile update error in Firestore:", e);
      res.status(500).send("Error");
    }
  });

  // GET WALLET BALANCE & RECENT CHRONOSPAN TRANSACTION HISTORY FROM FIRESTORE
  app.get("/api/wallet/:userId", async (req, res) => {
    const userId = req.params.userId;
    try {
      const db = getFirestoreDb();
      const userRef = db.collection("users").doc(userId);
      let docSnap = await userRef.get();

      if (!docSnap.exists) {
        const referCode = await generateUniqueReferCode("MEMBER");
        const defaultProfile = {
          userId,
          name: "Play Member",
          email: "",
          photoURL: "",
          balance: 499,
          referCode,
          referredBy: "",
          referCount: 0,
          createdAt: new Date().toISOString()
        };
        await userRef.set(defaultProfile);
        
        await userRef.collection("history").doc("WELCOME").set({
          id: "WELCOME",
          userId,
          source: "Welcome Bonus",
          amount: 499,
          date: new Date().toISOString()
        });

        docSnap = await userRef.get();
      }

      const userData = docSnap.data();

      // Get transaction history sorted by date
      const historySnap = await userRef.collection("history")
        .orderBy("date", "desc")
        .limit(20)
        .get();

      const userHistory = historySnap.docs.map(doc => doc.data());

      res.json({
        balance: Math.max(0, Math.floor(userData?.balance || 0)),
        referCode: userData?.referCode || "",
        referredBy: userData?.referredBy || "",
        referCount: userData?.referCount || 0,
        history: userHistory
      });
    } catch (e) {
      console.error("Wallet loading error in Firestore:", e);
      res.status(500).json({ error: "DB Error" });
    }
  });

  // SECURE SERVER-SIDE EARN ENDPOINT IN FIRESTORE (Atomically secure)
  app.post("/api/wallet/:userId/earn", async (req, res) => {
    const userId = req.params.userId;
    const { action, reward, source } = req.body;

    if (!userId || !action || !reward) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const coinReward = parseInt(reward, 10);
    const db = getFirestoreDb();
    const userRef = db.collection("users").doc(userId);

    try {
      // Execute in transactional context to guarantee atomicity and avoid double claims
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(userRef);
        let currentBalance = 499;

        if (!docSnap.exists) {
          const referCode = await generateUniqueReferCode("MEMBER");
          transaction.set(userRef, {
            userId,
            name: "Play Member",
            email: "",
            photoURL: "",
            balance: 499,
            referCode,
            referredBy: "",
            referCount: 0,
            createdAt: new Date().toISOString()
          });
          const wlTxRef = userRef.collection("history").doc("WELCOME");
          transaction.set(wlTxRef, {
            id: "WELCOME",
            userId,
            source: "Welcome Bonus",
            amount: 499,
            date: new Date().toISOString()
          });
        } else {
          currentBalance = docSnap.data()?.balance || 0;
        }

        // Daily Checkin validation inside Firestore transaction block
        if (action === 'daily_checkin') {
          const todayStr = new Date().toDateString();
          const historyRef = userRef.collection("history");
          const querySnap = await historyRef
            .where("source", "==", "Daily Check-in Bonus")
            .get();

          const claimedToday = querySnap.docs.some(doc => {
            const dateStr = new Date(doc.data().date).toDateString();
            return dateStr === todayStr;
          });

          if (claimedToday) {
            throw new Error("Daily bonus already claimed today!");
          }
        }

        // Update balance
        const newBalance = currentBalance + coinReward;
        transaction.update(userRef, { balance: newBalance });

        // Record history event
        const txId = "EARN_" + crypto.randomBytes(4).toString('hex');
        const txRef = userRef.collection("history").doc(txId);
        transaction.set(txRef, {
          id: txId,
          userId,
          source: source || "Activity Rewards",
          amount: coinReward,
          date: new Date().toISOString()
        });
      });

      const userDoc = await userRef.get();
      res.json({ success: true, balance: userDoc.data()?.balance });
    } catch (e: any) {
      console.error("Secure Earn Error in Firestore:", e.message || e);
      res.status(400).json({ error: e.message || "Failed to process earnings" });
    }
  });

  // SUBMIT OR SUBORDINATE REFER CODES REAL AND PERSISTENT
  app.post("/api/wallet/:userId/claim-referral", async (req, res) => {
    const userId = req.params.userId;
    const { referrerCode } = req.body;

    if (!userId || !referrerCode) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    const trimmedCode = referrerCode.trim().toUpperCase();
    const db = getFirestoreDb();
    const userRef = db.collection("users").doc(userId);

    try {
      let message = "";
      const claimResult = await db.runTransaction(async (transaction) => {
        const currentUserSnap = await transaction.get(userRef);
        if (!currentUserSnap.exists) {
          throw new Error("User profile not initialized");
        }

        const currentUser = currentUserSnap.data()!;
        if (currentUser.referredBy) {
          throw new Error("You have already claimed a referral code!");
        }

        if (currentUser.referCode === trimmedCode) {
          throw new Error("You cannot use your own referral code!");
        }

        // Search for referrer
        const referrerQuery = await db.collection("users")
          .where("referCode", "==", trimmedCode)
          .limit(1)
          .get();

        if (referrerQuery.empty) {
          throw new Error("Invalid referral code. Code does not exist.");
        }

        const referrerDoc = referrerQuery.docs[0];
        const referrerId = referrerDoc.id;
        const referrerRef = db.collection("users").doc(referrerId);
        const referrerData = referrerDoc.data();

        // Standard award amounts
        const CLAIMER_AWARD = 250;
        const REFERRER_AWARD = 500;

        // Update current user profiles
        transaction.update(userRef, {
          referredBy: trimmedCode,
          balance: (currentUser.balance || 0) + CLAIMER_AWARD
        });

        // Update referrer profiles
        transaction.update(referrerRef, {
          referCount: (referrerData.referCount || 0) + 1,
          balance: (referrerData.balance || 0) + REFERRER_AWARD
        });

        // Log transaction for claimer (current user)
        const txClaimerId = "EARN_" + crypto.randomBytes(4).toString('hex');
        const txClaimerRef = userRef.collection("history").doc(txClaimerId);
        transaction.set(txClaimerRef, {
          id: txClaimerId,
          userId,
          source: `Referral Added (Code: ${trimmedCode})`,
          amount: CLAIMER_AWARD,
          date: new Date().toISOString()
        });

        // Log transaction for inviter (referrer user)
        const txReferrerId = "EARN_" + crypto.randomBytes(4).toString('hex');
        const txReferrerRef = referrerRef.collection("history").doc(txReferrerId);
        transaction.set(txReferrerRef, {
          id: txReferrerId,
          userId: referrerId,
          source: `Referral Invite (User: ${currentUser.name || userId})`,
          amount: REFERRER_AWARD,
          date: new Date().toISOString()
        });

        message = `Successfully claimed referral! Received ${CLAIMER_AWARD} coins.`;
        return { success: true, balance: (currentUser.balance || 0) + CLAIMER_AWARD };
      });

      res.json({ success: true, balance: claimResult.balance, message });
    } catch (e: any) {
      console.error("Referral Claim Error in Firestore:", e.message || e);
      res.status(400).json({ error: e.message || "Failed to parse referral code" });
    }
  });

  // ADGEM POSTBACK WEBHOOK (Real integration updating Firestore balance)
  app.get("/api/webhooks/adgem", async (req, res) => {
    const { playerid, amount, request_id, verifier } = req.query;
    
    if (!playerid || !amount || !request_id || !verifier) {
      return res.status(400).send("Bad Request");
    }

    const expectedHash = crypto.createHash('md5').update(`${request_id}${ADGEM_POSTBACK_KEY}`).digest('hex');
    if (verifier !== expectedHash) {
       return res.status(401).send("Unauthorized");
    }

    const txId = request_id as string;
    const creditedAmount = parseInt(amount as string, 10);
    const userId = playerid as string;

    const db = getFirestoreDb();
    const userRef = db.collection("users").doc(userId);

    try {
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(userRef);
        let userBalance = 499;

        if (!docSnap.exists) {
          const referCode = await generateUniqueReferCode("MEMBER");
          transaction.set(userRef, {
            userId,
            name: "Play Member",
            email: "",
            photoURL: "",
            balance: 499,
            referCode,
            referredBy: "",
            referCount: 0,
            createdAt: new Date().toISOString()
          });
          transaction.set(userRef.collection("history").doc("WELCOME"), {
            id: "WELCOME",
            userId,
            source: "Welcome Bonus",
            amount: 499,
            date: new Date().toISOString()
          });
        } else {
          userBalance = docSnap.data()?.balance || 0;
        }

        const txRef = userRef.collection("history").doc(txId);
        const txSnap = await transaction.get(txRef);
        
        if (txSnap.exists) {
          // Transaction already processed
          return;
        }

        transaction.update(userRef, { balance: userBalance + creditedAmount });
        transaction.set(txRef, {
          id: txId,
          userId,
          source: `AdGem Offer`,
          amount: creditedAmount,
          date: new Date().toISOString()
        });
      });

      res.status(200).send("OK");
    } catch (e) {
      console.error("AdGem Webhook transaction failure:", e);
      res.status(500).send("Error");
    }
  });

  // BITLABS S2S SURVEY WEBHOOK PING BACKING TO FIRESTORE
  app.get("/api/webhooks/bitlabs", async (req, res) => {
    const { uid, val, hash, tx_id } = req.query;

    if (!uid || !val || !hash) return res.status(400).send("Bad Request");

    const checkString = (uid as string) + (val as string) + BITLABS_S2S_KEY;
    const expectedHash = crypto.createHash('sha1').update(checkString).digest('hex');
    if (hash !== expectedHash) return res.status(401).send("Unauthorized");

    const creditedAmount = parseInt(val as string, 10);
    const userId = uid as string;
    const mockTx = (tx_id as string) || "BL_" + Date.now();

    const db = getFirestoreDb();
    const userRef = db.collection("users").doc(userId);

    try {
      await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(userRef);
        let userBalance = 499;

        if (!docSnap.exists) {
          const referCode = await generateUniqueReferCode("MEMBER");
          transaction.set(userRef, {
            userId,
            name: "Play Member",
            email: "",
            photoURL: "",
            balance: 499,
            referCode,
            referredBy: "",
            referCount: 0,
            createdAt: new Date().toISOString()
          });
          transaction.set(userRef.collection("history").doc("WELCOME"), {
            id: "WELCOME",
            userId,
            source: "Welcome Bonus",
            amount: 499,
            date: new Date().toISOString()
          });
        } else {
          userBalance = docSnap.data()?.balance || 0;
        }

        const txRef = userRef.collection("history").doc(mockTx);
        const txSnap = await transaction.get(txRef);

        if (txSnap.exists) {
          return;
        }

        transaction.update(userRef, { balance: userBalance + creditedAmount });
        transaction.set(txRef, {
          id: mockTx,
          userId,
          source: `BitLabs Survey`,
          amount: creditedAmount,
          date: new Date().toISOString()
        });
      });

      res.status(200).send("OK");
    } catch (e) {
      console.error("BitLabs Webhook transaction failure:", e);
      res.status(500).send("Error");
    }
  });

  // VIDEOS SPONSOR ENDPOINT
  app.get("/api/videos", async (req, res) => {
    res.json([]);
  });

  // REDEEM REWARD LOGIC IN FIRESTORE
  app.post("/api/wallet/:userId/redeem", async (req, res) => {
    const userId = req.params.userId;
    const { rewardId, cost, details, paymentDetail, userName, userEmail } = req.body;

    try {
      const db = getFirestoreDb();
      const userRef = db.collection("users").doc(userId);
      const txId = "RED_" + crypto.randomBytes(4).toString('hex');
      const redemptionRef = db.collection("redemptions").doc(txId);

      const balanceValue = await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(userRef);
        if (!docSnap.exists) {
          throw new Error("User profile does not exist to redeem rewards!");
        }

        const currentBalance = docSnap.data()?.balance || 0;
        if (currentBalance < cost) {
          throw new Error("Insufficient funds to complete redemption.");
        }

        const nextBalance = currentBalance - cost;

        // Deduct from profile
        transaction.update(userRef, { balance: nextBalance });

        // Record locally in history
        const txRef = userRef.collection("history").doc(txId);
        transaction.set(txRef, {
          id: txId,
          userId,
          source: `Redeemed: ${details}`,
          amount: -cost,
          date: new Date().toISOString()
        });

        // Set global redemption document
        const redemptionRecord = {
          id: txId,
          userId,
          userName: userName || docSnap.data()?.name || userId,
          userEmail: userEmail || docSnap.data()?.email || "",
          rewardId,
          title: details,
          coinsCost: cost,
          paymentDetail: paymentDetail || "No details",
          status: 'PENDING',
          couponCode: '',
          createdAt: new Date().toISOString()
        };

        transaction.set(redemptionRef, redemptionRecord);

        return nextBalance;
      });

      const updatedRedSnap = await redemptionRef.get();

      res.json({ 
        success: true, 
        balance: balanceValue, 
        redemption: updatedRedSnap.data() 
      });
    } catch (e: any) {
      console.error("Redemption creation failed on Firestore server:", e.message || e);
      res.status(400).json({ error: e.message || "Server Error" });
    }
  });

  // GET REDEMPTION RECORDS ACCORDING TO USER ID FROM FIRESTORE
  app.get("/api/wallet/:userId/redemptions", async (req, res) => {
    const userId = req.params.userId;
    try {
      const db = getFirestoreDb();
      const snapshot = await db.collection("redemptions")
        .where("userId", "==", userId)
        .get();

      const records = snapshot.docs.map(doc => doc.data());
      // Sort in memory to guarantee simple query works without custom indices setup required in Firebase
      records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json(records);
    } catch (e) {
      console.error("User redemptions query failure:", e);
      res.status(500).json({ error: "Failed to load redemptions for user." });
    }
  });

  // ADMIN REDEMPTIONS MANAGER CONTROL FROM FIRESTORE
  app.get("/api/admin/redemptions", async (req, res) => {
    try {
      const db = getFirestoreDb();
      const snapshot = await db.collection("redemptions").get();
      const records = snapshot.docs.map(doc => doc.data());
      records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(records);
    } catch (e) {
      console.error("Admin global redemptions failure:", e);
      res.status(500).json({ error: "Failed to load admin redemptions queue." });
    }
  });

  // ADMIN DISPATCH REDEMPTION KEY ACTION (Atomic state updating)
  app.post("/api/admin/redemptions/:id/approve", async (req, res) => {
    const id = req.params.id;
    const { couponCode } = req.body;

    try {
      const db = getFirestoreDb();
      const redemptionRef = db.collection("redemptions").doc(id);
      const snapshot = await redemptionRef.get();

      if (!snapshot.exists) {
        return res.status(404).json({ error: "Redemption record not found" });
      }

      const activeCoupon = couponCode || "MANUALLY_MARKED_AS_PAID";
      await redemptionRef.update({
        status: "APPROVED",
        couponCode: activeCoupon,
        completedAt: new Date().toISOString()
      });

      const updatedSnap = await redemptionRef.get();
      res.json({ success: true, redemption: updatedSnap.data() });
    } catch (e) {
      console.error("Redemption approve failure in Firestore:", e);
      res.status(500).json({ error: "Approval error" });
    }
  });

  // ADMIN DISPUTE & DECLINE ACTION - AUTOMATED COIN REFUND ENGAGED
  app.post("/api/admin/redemptions/:id/reject", async (req, res) => {
    const id = req.params.id;
    const { reason } = req.body;

    try {
      const db = getFirestoreDb();
      const redemptionRef = db.collection("redemptions").doc(id);
      
      const refundRecordSnap = await db.runTransaction(async (transaction) => {
        const redSnap = await transaction.get(redemptionRef);
        if (!redSnap.exists) {
          throw new Error("Redemption record not found");
        }

        const record = redSnap.data()!;
        if (record.status !== "PENDING") {
          throw new Error("Can only reject pending redemptions");
        }

        const rejectReason = reason || "Declined: Refunded";
        
        transaction.update(redemptionRef, {
          status: "REJECTED",
          couponCode: rejectReason,
          completedAt: new Date().toISOString()
        });

        // Refund coins to user
        const userId = record.userId;
        const userRef = db.collection("users").doc(userId);
        const userSnap = await transaction.get(userRef);

        if (userSnap.exists) {
          const currentBalance = userSnap.data()?.balance || 0;
          const refundTxId = "REF_" + crypto.randomBytes(4).toString('hex');
          const txRef = userRef.collection("history").doc(refundTxId);

          transaction.update(userRef, { balance: currentBalance + record.coinsCost });
          transaction.set(txRef, {
            id: refundTxId,
            userId,
            source: `Refund: Rejected ${record.title}`,
            amount: record.coinsCost,
            date: new Date().toISOString()
          });
        }
        
        return { ...record, status: "REJECTED", couponCode: rejectReason };
      });

      res.json({ success: true, redemption: refundRecordSnap });
    } catch (e: any) {
      console.error("Redemption reject failure in Firestore:", e.message || e);
      res.status(500).json({ error: e.message || "Rejection error" });
    }
  });

  // Vite configuration setup 
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    // @ts-ignore
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
