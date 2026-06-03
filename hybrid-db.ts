import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import crypto from "crypto";

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  }
}

function logFirestoreError(error: any, operationType: OperationType, collPath: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (errMsg.includes("PERMISSION_DENIED") || error?.code === 7) {
    console.log('[HYBRID_DB] Info: Sandbox permission limit detected. Operation routed to offline JSON storage.');
    return;
  }
  const errInfo = {
    msg: errMsg,
    op: operationType,
    path: collPath
  };
  console.log('[HYBRID_DB] Warning:', JSON.stringify(errInfo));
}

// Global flag to track if we should fallback to local database
let shouldFallbackToLocal = false;
let connectionTested = false;

async function testDatabaseConnectionQuietly() {
  if (connectionTested) return;
  connectionTested = true;
  try {
    const adminDb = getAdminFirestore();
    if (!adminDb) {
      shouldFallbackToLocal = true;
      return;
    }
    // Quietly run a dry run to verify IAM permissions on the target database
    await adminDb.collection("users").limit(1).get();
  } catch (err: any) {
    shouldFallbackToLocal = true;
    console.log('[HYBRID_DB] Info: Sandbox permission limit detected. Switched operation to local offline JSON storage.');
  }
}

const LOCAL_DB_PATH = path.join(process.cwd(), "db.json");

// Read helper
function readLocalDb(): any {
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const content = fs.readFileSync(LOCAL_DB_PATH, "utf-8").trim();
      if (content) {
        return JSON.parse(content);
      }
    }
  } catch (e) {
    console.error("[HYBRID_DB] Failed to read local db.json, returning empty structure:", e);
  }
  return { users: {}, history: {}, redemptions: [] };
}

// Write helper
function writeLocalDb(data: any) {
  try {
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("[HYBRID_DB] Failed to write local db.json:", e);
  }
}

// Types for Mock/Fallback Firestore interface
export class HybridDocSnapshot {
  constructor(public id: string, public exists: boolean, private _data: any) {}
  data() {
    return this._data ? { ...this._data } : undefined;
  }
}

export class HybridQuerySnapshot {
  constructor(public docs: HybridDocSnapshot[]) {}
  get empty() {
    return this.docs.length === 0;
  }
  get size() {
    return this.docs.length;
  }
}

export class HybridDocumentReference {
  constructor(public id: string, public collectionPath: string, public parentId?: string) {}

  collection(subName: string) {
    if (this.collectionPath === "users" && subName === "history") {
      return new HybridCollectionReference("history", this.id);
    }
    throw new Error(`Unsupported subcollection: ${subName}`);
  }

  async get(): Promise<HybridDocSnapshot> {
    await testDatabaseConnectionQuietly();
    if (!shouldFallbackToLocal) {
      try {
        const adminDb = getAdminFirestore();
        if (adminDb) {
          let docRef;
          if (this.parentId) {
            docRef = adminDb.collection("users").doc(this.parentId).collection("history").doc(this.id);
          } else {
            docRef = adminDb.collection(this.collectionPath).doc(this.id);
          }
          const snap = await docRef.get();
          return new HybridDocSnapshot(snap.id, snap.exists, snap.data());
        }
      } catch (err: any) {
        logFirestoreError(err, OperationType.GET, `${this.collectionPath}/${this.id}`);
        if (err.message.includes("PERMISSION_DENIED") || err.code === 7) {
          shouldFallbackToLocal = true;
        } else {
          throw err;
        }
      }
    }

    // Local fallback
    const db = readLocalDb();
    if (this.collectionPath === "users") {
      const user = db.users[this.id];
      return new HybridDocSnapshot(this.id, !!user, user);
    } else if (this.collectionPath === "history" && this.parentId) {
      const userHistory = db.history[this.parentId] || [];
      const record = userHistory.find((h: any) => h.id === this.id);
      return new HybridDocSnapshot(this.id, !!record, record);
    } else if (this.collectionPath === "redemptions") {
      const record = db.redemptions.find((r: any) => r.id === this.id);
      return new HybridDocSnapshot(this.id, !!record, record);
    }
    return new HybridDocSnapshot(this.id, false, null);
  }

  async set(data: any, options?: { merge?: boolean }): Promise<void> {
    await testDatabaseConnectionQuietly();
    if (!shouldFallbackToLocal) {
      try {
        const adminDb = getAdminFirestore();
        if (adminDb) {
          let docRef;
          if (this.parentId) {
            docRef = adminDb.collection("users").doc(this.parentId).collection("history").doc(this.id);
          } else {
            docRef = adminDb.collection(this.collectionPath).doc(this.id);
          }
          await docRef.set(data, options || {});
          return;
        }
      } catch (err: any) {
        logFirestoreError(err, OperationType.WRITE, `${this.collectionPath}/${this.id}`);
        if (err.message.includes("PERMISSION_DENIED") || err.code === 7) {
          shouldFallbackToLocal = true;
        } else {
          throw err;
        }
      }
    }

    // Local fallback
    const db = readLocalDb();
    if (this.collectionPath === "users") {
      if (options?.merge && db.users[this.id]) {
        db.users[this.id] = { ...db.users[this.id], ...data };
      } else {
        db.users[this.id] = { ...data, userId: this.id };
      }
    } else if (this.collectionPath === "history" && this.parentId) {
      if (!db.history[this.parentId]) db.history[this.parentId] = [];
      const idx = db.history[this.parentId].findIndex((h: any) => h.id === this.id);
      if (idx >= 0) {
        db.history[this.parentId][idx] = { ...db.history[this.parentId][idx], ...data };
      } else {
        db.history[this.parentId].push({ ...data, id: this.id });
      }
    } else if (this.collectionPath === "redemptions") {
      const idx = db.redemptions.findIndex((r: any) => r.id === this.id);
      if (idx >= 0) {
        db.redemptions[idx] = { ...db.redemptions[idx], ...data };
      } else {
        db.redemptions.push({ ...data, id: this.id });
      }
    }
    writeLocalDb(db);
  }

  async update(data: any): Promise<void> {
    await testDatabaseConnectionQuietly();
    if (!shouldFallbackToLocal) {
      try {
        const adminDb = getAdminFirestore();
        if (adminDb) {
          let docRef;
          if (this.parentId) {
            docRef = adminDb.collection("users").doc(this.parentId).collection("history").doc(this.id);
          } else {
            docRef = adminDb.collection(this.collectionPath).doc(this.id);
          }
          await docRef.update(data);
          return;
        }
      } catch (err: any) {
        logFirestoreError(err, OperationType.UPDATE, `${this.collectionPath}/${this.id}`);
        if (err.message.includes("PERMISSION_DENIED") || err.code === 7) {
          shouldFallbackToLocal = true;
        } else {
          throw err;
        }
      }
    }

    // Local fallback
    const db = readLocalDb();
    if (this.collectionPath === "users") {
      if (db.users[this.id]) {
        db.users[this.id] = { ...db.users[this.id], ...data };
      }
    } else if (this.collectionPath === "history" && this.parentId) {
      const idx = db.history[this.parentId]?.findIndex((h: any) => h.id === this.id) ?? -1;
      if (idx >= 0) {
        db.history[this.parentId][idx] = { ...db.history[this.parentId][idx], ...data };
      }
    } else if (this.collectionPath === "redemptions") {
      const idx = db.redemptions.findIndex((r: any) => r.id === this.id);
      if (idx >= 0) {
        db.redemptions[idx] = { ...db.redemptions[idx], ...data };
      }
    }
    writeLocalDb(db);
  }
}

export class HybridCollectionReference {
  private _wheres: Array<{ field: string; op: string; val: any }> = [];
  private _orderByField?: string;
  private _orderDirection?: string;
  private _limitCount?: number;

  constructor(public collectionPath: string, public parentId?: string) {}

  doc(id: string) {
    return new HybridDocumentReference(id, this.collectionPath, this.parentId);
  }

  where(field: string, op: string, val: any) {
    const q = new HybridCollectionReference(this.collectionPath, this.parentId);
    q._wheres = [...this._wheres, { field, op, val }];
    q._orderByField = this._orderByField;
    q._orderDirection = this._orderDirection;
    q._limitCount = this._limitCount;
    return q;
  }

  orderBy(field: string, direction?: string) {
    const q = new HybridCollectionReference(this.collectionPath, this.parentId);
    q._wheres = [...this._wheres];
    q._orderByField = field;
    q._orderDirection = direction || "asc";
    q._limitCount = this._limitCount;
    return q;
  }

  limit(n: number) {
    const q = new HybridCollectionReference(this.collectionPath, this.parentId);
    q._wheres = [...this._wheres];
    q._orderByField = this._orderByField;
    q._orderDirection = this._orderDirection;
    q._limitCount = n;
    return q;
  }

  async get(): Promise<HybridQuerySnapshot> {
    await testDatabaseConnectionQuietly();
    if (!shouldFallbackToLocal) {
      try {
        const adminDb = getAdminFirestore();
        if (adminDb) {
          let ref: any;
          if (this.collectionPath === "history" && this.parentId) {
            ref = adminDb.collection("users").doc(this.parentId).collection("history");
          } else {
            ref = adminDb.collection(this.collectionPath);
          }

          for (const w of this._wheres) {
            ref = ref.where(w.field, w.op as any, w.val);
          }
          if (this._orderByField) {
            ref = ref.orderBy(this._orderByField, this._orderDirection as any);
          }
          if (this._limitCount !== undefined) {
            ref = ref.limit(this._limitCount);
          }

          const snap = await ref.get();
          const docs = snap.docs.map((d: any) => new HybridDocSnapshot(d.id, d.exists, d.data()));
          return new HybridQuerySnapshot(docs);
        }
      } catch (err: any) {
        logFirestoreError(err, OperationType.LIST, this.collectionPath);
        if (err.message.includes("PERMISSION_DENIED") || err.code === 7) {
          shouldFallbackToLocal = true;
        } else {
          throw err;
        }
      }
    }

    // Local fallback query
    const db = readLocalDb();
    let list: any[] = [];

    if (this.collectionPath === "users") {
      list = Object.values(db.users);
    } else if (this.collectionPath === "history" && this.parentId) {
      list = db.history[this.parentId] || [];
    } else if (this.collectionPath === "redemptions") {
      list = db.redemptions || [];
    }

    // Filter using where
    for (const w of this._wheres) {
      list = list.filter(item => {
        const v = item[w.field];
        if (w.op === "==") return v === w.val;
        if (w.op === "!=") return v !== w.val;
        if (w.op === ">") return v > w.val;
        if (w.op === "<") return v < w.val;
        if (w.op === ">=") return v >= w.val;
        if (w.op === "<=") return v <= w.val;
        return true;
      });
    }

    // Sort using orderBy
    if (this._orderByField) {
      const field = this._orderByField;
      const desc = this._orderDirection === "desc";
      list.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        if (typeof valA === "string" && typeof valB === "string") {
          return desc ? valB.localeCompare(valA) : valA.localeCompare(valB);
        }
        return desc ? valB - valA : valA - valB;
      });
    }

    // Limit count
    if (this._limitCount !== undefined) {
      list = list.slice(0, this._limitCount);
    }

    const docs = list.map(item => new HybridDocSnapshot(item.id || item.userId || "", true, item));
    return new HybridQuerySnapshot(docs);
  }
}

export class HybridTransaction {
  private _localWrites = new Map<string, { path: string; parentId?: string; data: any; merge?: boolean }>();
  private _localUpdates = new Map<string, { path: string; parentId?: string; data: any }>();
  private _localReads = new Map<string, any>();

  constructor(private _realTx?: any) {}

  async get(ref: HybridDocumentReference): Promise<HybridDocSnapshot> {
    if (!shouldFallbackToLocal && this._realTx) {
      try {
        const adminDb = getAdminFirestore();
        if (adminDb) {
          let realRef;
          if (ref.parentId) {
            realRef = adminDb.collection("users").doc(ref.parentId).collection("history").doc(ref.id);
          } else {
            realRef = adminDb.collection(ref.collectionPath).doc(ref.id);
          }
          const snap = await this._realTx.get(realRef);
          return new HybridDocSnapshot(snap.id, snap.exists, snap.data());
        }
      } catch (err: any) {
        logFirestoreError(err, OperationType.GET, `transaction/${ref.collectionPath}/${ref.id}`);
        if (err.message.includes("PERMISSION_DENIED") || err.code === 7) {
          shouldFallbackToLocal = true;
        } else {
          throw err;
        }
      }
    }

    // Fallback load
    const key = `${ref.collectionPath}/${ref.parentId || ""}/${ref.id}`;
    if (this._localReads.has(key)) {
      return this._localReads.get(key);
    }

    const db = readLocalDb();
    let data: any = null;
    let exists = false;

    if (ref.collectionPath === "users") {
      data = db.users[ref.id];
      exists = !!data;
    } else if (ref.collectionPath === "history" && ref.parentId) {
      data = db.history[ref.parentId]?.find((h: any) => h.id === ref.id);
      exists = !!data;
    } else if (ref.collectionPath === "redemptions") {
      data = db.redemptions.find((r: any) => r.id === ref.id);
      exists = !!data;
    }

    const snap = new HybridDocSnapshot(ref.id, exists, data);
    this._localReads.set(key, snap);
    return snap;
  }

  set(ref: HybridDocumentReference, data: any, options?: { merge?: boolean }) {
    if (!shouldFallbackToLocal && this._realTx) {
      try {
        const adminDb = getAdminFirestore();
        if (adminDb) {
          let realRef;
          if (ref.parentId) {
            realRef = adminDb.collection("users").doc(ref.parentId).collection("history").doc(ref.id);
          } else {
            realRef = adminDb.collection(ref.collectionPath).doc(ref.id);
          }
          this._realTx.set(realRef, data, options || {});
          return this;
        }
      } catch (err: any) {
        logFirestoreError(err, OperationType.WRITE, `transaction/set/${ref.collectionPath}/${ref.id}`);
        if (err.message.includes("PERMISSION_DENIED") || err.code === 7) {
          shouldFallbackToLocal = true;
        } else {
          throw err;
        }
      }
    }

    const key = `${ref.collectionPath}/${ref.parentId || ""}/${ref.id}`;
    this._localWrites.set(key, { path: ref.collectionPath, parentId: ref.parentId, data, merge: options?.merge });
    return this;
  }

  update(ref: HybridDocumentReference, data: any) {
    if (!shouldFallbackToLocal && this._realTx) {
      try {
        const adminDb = getAdminFirestore();
        if (adminDb) {
          let realRef;
          if (ref.parentId) {
            realRef = adminDb.collection("users").doc(ref.parentId).collection("history").doc(ref.id);
          } else {
            realRef = adminDb.collection(ref.collectionPath).doc(ref.id);
          }
          this._realTx.update(realRef, data);
          return this;
        }
      } catch (err: any) {
        logFirestoreError(err, OperationType.UPDATE, `transaction/update/${ref.collectionPath}/${ref.id}`);
        if (err.message.includes("PERMISSION_DENIED") || err.code === 7) {
          shouldFallbackToLocal = true;
        } else {
          throw err;
        }
      }
    }

    const key = `${ref.collectionPath}/${ref.parentId || ""}/${ref.id}`;
    this._localUpdates.set(key, { path: ref.collectionPath, parentId: ref.parentId, data });
    return this;
  }

  // Commit local transaction changes to local db file
  commitLocal() {
    const db = readLocalDb();
    
    // Process writes
    for (const [key, item] of this._localWrites.entries()) {
      const parts = key.split("/");
      const id = parts[parts.length - 1];

      if (item.path === "users") {
        if (item.merge && db.users[id]) {
          db.users[id] = { ...db.users[id], ...item.data };
        } else {
          db.users[id] = { ...item.data, userId: id };
        }
      } else if (item.path === "history" && item.parentId) {
        if (!db.history[item.parentId]) db.history[item.parentId] = [];
        const idx = db.history[item.parentId].findIndex((h: any) => h.id === id);
        if (idx >= 0) {
          db.history[item.parentId][idx] = { ...db.history[item.parentId][idx], ...item.data };
        } else {
          db.history[item.parentId].push({ ...item.data, id });
        }
      } else if (item.path === "redemptions") {
        const idx = db.redemptions.findIndex((r: any) => r.id === id);
        if (idx >= 0) {
          db.redemptions[idx] = { ...db.redemptions[idx], ...item.data };
        } else {
          db.redemptions.push({ ...item.data, id });
        }
      }
    }

    // Process updates
    for (const [key, item] of this._localUpdates.entries()) {
      const parts = key.split("/");
      const id = parts[parts.length - 1];

      if (item.path === "users") {
        if (db.users[id]) {
          db.users[id] = { ...db.users[id], ...item.data };
        }
      } else if (item.path === "history" && item.parentId) {
        const idx = db.history[item.parentId]?.findIndex((h: any) => h.id === id) ?? -1;
        if (idx >= 0) {
          db.history[item.parentId][idx] = { ...db.history[item.parentId][idx], ...item.data };
        }
      } else if (item.path === "redemptions") {
        const idx = db.redemptions.findIndex((r: any) => r.id === id);
        if (idx >= 0) {
          db.redemptions[idx] = { ...db.redemptions[idx], ...item.data };
        }
      }
    }

    writeLocalDb(db);
  }
}

export class HybridFirestore {
  collection(name: string) {
    return new HybridCollectionReference(name);
  }

  async runTransaction(callback: (transaction: HybridTransaction) => Promise<any>): Promise<any> {
    await testDatabaseConnectionQuietly();
    if (!shouldFallbackToLocal) {
      try {
        const adminDb = getAdminFirestore();
        if (adminDb) {
          const result = await adminDb.runTransaction(async (realTx: any) => {
            const tx = new HybridTransaction(realTx);
            return await callback(tx);
          });
          return result;
        }
      } catch (err: any) {
        logFirestoreError(err, OperationType.WRITE, `transaction/runTransaction`);
        if (err.message.includes("PERMISSION_DENIED") || err.code === 7) {
          shouldFallbackToLocal = true;
        } else {
          throw err;
        }
      }
    }

    // Local fallback
    const tx = new HybridTransaction();
    const result = await callback(tx);
    tx.commitLocal();
    return result;
  }
}

// Global cached Firestore Admin connection
let adminDbCached: any = null;

function getAdminFirestore(): any {
  if (adminDbCached) return adminDbCached;
  try {
    const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (!fs.existsSync(firebaseConfigPath)) return null;
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    if (!firebaseConfig.projectId) return null;

    const app = admin.apps.length === 0
      ? admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: firebaseConfig.projectId,
        })
      : admin.app();

    adminDbCached = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
    return adminDbCached;
  } catch (err) {
    console.warn("[HYBRID_DB] Admin Firestore connection error, will use local fallback:", err);
    shouldFallbackToLocal = true;
    return null;
  }
}

export function getFirestoreDb(): HybridFirestore {
  return new HybridFirestore();
}
