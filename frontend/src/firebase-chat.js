// src/firebase-chat.js
import { getApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "firebase/auth";
import { getDatabase, ref, push, onChildAdded, query, orderByChild, get, set, child } from "firebase/database";

let _db = null;
let _auth = null;
let _meUid = null;

/**
 * initChat - Check if user is authenticated, if not try to re-authenticate
 */
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

  // Wait for auth state
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(_auth, user => {
      unsub();
      
      if (user) {
        _meUid = user.uid;
        console.log('Firebase chat initialized for user:', _meUid);
        resolve({ uid: _meUid });
      } else {
        // User not authenticated to Firebase
        // But they might be logged into the app
        console.warn('Not authenticated to Firebase, but checking app login...');
        
        // Check if user has app token
        const token = localStorage.getItem('solennia_token');
        if (token) {
          console.log('User has app token, Firebase session might have expired');
          console.log('You may need to re-login to use chat features');
          // For now, reject - user needs to re-login
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

export async function listThreadsForCurrentUser() {
  if (!_db) throw new Error('Init chat first');
  if (!_meUid) return [];

  const threadsRef = ref(_db, 'threads');
  const snap = await get(threadsRef);
  const res = [];

  if (!snap.exists()) return res;

  const threads = snap.val();
  for (const [tid, meta] of Object.entries(threads)) {
    const participants = meta.participants || {};
    if (participants[_meUid]) {
      const otherUid = Object.keys(participants).find(x => x !== _meUid);
      
      let otherName = null;
      try {
        const pSnap = await get(child(ref(_db), `profiles/${otherUid}`));
        if (pSnap.exists()) {
          otherName = pSnap.val().displayName || pSnap.val().business_name || null;
        }
      } catch(e) {
        console.log('No profile found for:', otherUid);
      }
      
      res.push({
        threadId: tid,
        otherUid,
        otherName,
        lastMessageSnippet: meta.lastMessage ? String(meta.lastMessage).slice(0, 60) : '',
        lastTs: meta.lastTs || 0
      });
    }
  }

  res.sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));
  return res;
}

export async function openThreadByOtherUid(otherUidOrId, callback) {
  if (!_db) throw new Error('Init chat first');
  if (!_meUid) {
    callback(null);
    return;
  }

  let otherUid = otherUidOrId;

  // If it's a number (MySQL ID), try to get Firebase UID
  if (/^\d+$/.test(String(otherUidOrId))) {
    try {
      const res = await fetch(`/api/users/by-id/${encodeURIComponent(otherUidOrId)}`);
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

  const metaRef = ref(_db, `threads/${threadId}/meta`);
  const metaSnap = await get(metaRef);

  if (!metaSnap.exists()) {
    const metaData = {
      participants: { [_meUid]: true, [otherUid]: true },
      createdAt: Date.now(),
      lastMessage: null,
      lastTs: 0
    };
    await set(metaRef, metaData);
  }

  let otherMeta = null;
  try {
    const p = await get(child(ref(_db), `profiles/${otherUid}`));
    if (p.exists()) otherMeta = p.val();
  } catch(e) {
    console.log('No profile meta for:', otherUid);
  }

  callback({ threadId, otherUid, otherMeta });
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

  const metaRef = ref(_db, `threads/${threadId}/meta`);
  await set(child(metaRef, 'lastMessage'), payload.text);
  await set(child(metaRef, 'lastTs'), payload.ts);
  
  return payload;
}

export function onThreadMessages(threadId, onMessage) {
  if (!_db) throw new Error('Init chat first');
  const q = query(ref(_db, `messages/${threadId}`), orderByChild('ts'));
  
  onChildAdded(q, snap => {
    if (!snap.exists()) return;
    const m = snap.val();
    onMessage({ 
      senderUid: m.senderUid, 
      text: m.text, 
      ts: m.ts, 
      id: snap.key 
    });
  });
}