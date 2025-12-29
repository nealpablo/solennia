// src/firebase-chat.js - FIXED VERSION
import { getApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, push, onChildAdded, onValue, query, orderByChild, get, set, child, update } from "firebase/database";

const API_BASE = 
  import.meta.env.VITE_API_BASE || 
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD 
    ? "https://solennia.up.railway.app" : "");

let _db = null;
let _auth = null;
let _meUid = null;

export async function initChat() {
  let app;
  try {
    app = getApp();
  } catch (e) {
    const apps = getApps();
    app = apps[0];
    if (!app) throw new Error('Firebase app not initialized');
  }
  
  _auth = getAuth(app);
  _db = getDatabase(app);

  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(_auth, user => {
      unsub();
      
      if (user) {
        _meUid = user.uid;
        console.log('✅ Firebase chat initialized for user:', _meUid);
        resolve({ uid: _meUid });
      } else {
        const token = localStorage.getItem('solennia_token');
        if (token) {
          console.error('❌ Firebase session expired. Please logout and login again.');
          reject(new Error('Firebase session expired. Please logout and login again.'));
        } else {
          reject(new Error('Not authenticated. Please login first.'));
        }
      }
    });
  });
}

export function currentUserUid() {
  return _meUid;
}

function threadIdFromPair(a, b) {
  if (!a || !b) return null;
  return (a < b) ? `${a}__${b}` : `${b}__${a}`;
}

// ✅ FIXED: Correct thread structure handling + otherUid validation
export async function listThreadsForCurrentUser() {
  if (!_db) throw new Error('Init chat first');
  if (!_meUid) return [];

  const threadsRef = ref(_db, 'threads');
  const snap = await get(threadsRef);
  const res = [];

  if (!snap.exists()) {
    console.log('📭 No threads found');
    return res;
  }

  const threads = snap.val();

  for (const [tid, threadData] of Object.entries(threads)) {
    // ✅ FIX: Access threadData.meta, not threadData.participants directly
    const meta = threadData.meta || threadData;
    const participants = meta.participants || {};
    
    if (participants[_meUid]) {
      const otherUid = Object.keys(participants).find(x => x !== _meUid);
      
      // ✅ FIX: Only add thread if otherUid exists (skip malformed threads)
      if (otherUid) {
        res.push({
          threadId: tid,
          otherUid,
          otherName: null,
          lastMessageSnippet: meta.lastMessage ? String(meta.lastMessage).slice(0, 60) : '',
          lastTs: meta.lastTs || 0
        });
      }
    }
  }

  res.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
  return res;
}

// ✅ FIXED: Listen for real-time updates to all threads + otherUid validation
export function onAllThreadsUpdate(callback) {
  if (!_db) throw new Error('Init chat first');
  if (!_meUid) return () => {};

  const threadsRef = ref(_db, 'threads');
  
  const unsubscribe = onValue(threadsRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback([]);
      return;
    }

    const threads = snapshot.val();
    const res = [];

    for (const [tid, threadData] of Object.entries(threads)) {
      const meta = threadData.meta || threadData;
      const participants = meta.participants || {};
      
      if (participants[_meUid]) {
        const otherUid = Object.keys(participants).find(x => x !== _meUid);
        
        // ✅ FIX: Only add thread if otherUid exists (skip malformed threads)
        if (otherUid) {
          res.push({
            threadId: tid,
            otherUid,
            otherName: null,
            lastMessageSnippet: meta.lastMessage ? String(meta.lastMessage).slice(0, 60) : '',
            lastTs: meta.lastTs || 0
          });
        }
      }
    }

    res.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
    callback(res);
  });

  return unsubscribe;
}

export async function openThreadByOtherUid(otherUidOrId, callback) {
  if (!_db) throw new Error('Init chat first');
  if (!_meUid) {
    callback(null);
    return;
  }

  let otherUid = otherUidOrId;

  if (/^\d+$/.test(String(otherUidOrId))) {
    try {
      const res = await fetch(`${API_BASE}/api/users/by-id/${encodeURIComponent(otherUidOrId)}`);
      const json = await res.json();
      if (res.ok && json.user && json.user.firebase_uid) {
        otherUid = json.user.firebase_uid;
      } else {
        console.warn('Could not resolve Firebase UID for user ID:', otherUidOrId);
        callback(null);
        return;
      }
    } catch(err) {
      console.error('Error fetching Firebase UID:', err);
      callback(null);
      return;
    }
  }

  const threadId = threadIdFromPair(_meUid, otherUid);
  if (!threadId) {
    callback(null);
    return;
  }

  const threadRef = ref(_db, `threads/${threadId}`);
  const threadSnap = await get(threadRef);

  if (!threadSnap.exists()) {
    const threadData = {
      meta: {
        participants: { [_meUid]: true, [otherUid]: true },
        createdAt: Date.now(),
        lastMessage: null,
        lastTs: 0
      }
    };
    await set(threadRef, threadData);
  }

  callback({ threadId, otherUid, otherMeta: null });
}

export async function sendMessageToThread(threadId, { text }) {
  if (!_db) throw new Error('Init chat first');
  if (!_meUid) throw new Error('Not signed in');

  const messagesRef = ref(_db, `messages/${threadId}`);
  const newMsgRef = push(messagesRef);
  const payload = {
    senderUid: _meUid,
    text: String(text || ''),
    ts: Date.now(),
    aiContext: null
  };
  await set(newMsgRef, payload);

  // ✅ FIX: Update thread meta properly
  const metaRef = ref(_db, `threads/${threadId}/meta`);
  await update(metaRef, {
    lastMessage: payload.text,
    lastTs: payload.ts
  });
  
  return payload;
}

export function onThreadMessages(threadId, onMessage) {
  if (!_db) throw new Error('Init chat first');
  const q = query(ref(_db, `messages/${threadId}`), orderByChild('ts'));
  
  const unsubscribe = onChildAdded(q, snap => {
    if (!snap.exists()) return;
    const m = snap.val();
    onMessage({ 
      senderUid: m.senderUid, 
      text: m.text, 
      ts: m.ts, 
      id: snap.key 
    });
  });
  
  // ✅ FIX: Return the unsubscribe function
  return unsubscribe;
}