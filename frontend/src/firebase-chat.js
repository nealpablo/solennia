// src/firebase-chat.js
// Firebase Realtime Database chat helpers for Solennia
// Exports:
//  - initChat()
//  - currentUserUid()
//  - listThreadsForCurrentUser()
//  - openThreadByOtherUid(otherUidOrId, callback)   // callback(threadInfo|null)
//  - sendMessageToThread(threadId, {text})
//  - onThreadMessages(threadId, onMessage)

import { getApp, getApps } from "firebase/app";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, push, onChildAdded, query, orderByChild, get, set, child } from "firebase/database";

/**
 * Data model (Realtime DB):
 * /threads/{threadId}/meta => { participants: { uid1: true, uid2: true }, createdAt, lastMessage, lastTs }
 * /messages/{threadId}/{pushId} => { senderUid, text, ts, aiContext }
 * /profiles/{uid} => optional profile info that helps display names
 *
 * threadId format: sorted pair joined with '__' e.g. uidA__uidB
 */

let _db = null;
let _auth = null;
let _meUid = null;

/**
 * initChat:
 *  - resolves firebase app
 *  - waits for firebase auth to be ready
 */
export async function initChat() {
  let app;
  try {
    app = getApp();
  } catch (e) {
    // try to fall back to first app in getApps()
    const apps = getApps();
    app = apps[0];
    if (!app) throw new Error('Firebase app not initialized. Call initializeApp first (main.js).');
  }
  _auth = getAuth(app);
  _db = getDatabase(app);

  // await auth ready (currentUser may be null if not signed in)
  await new Promise(resolve => {
    const unsub = onAuthStateChanged(_auth, user => {
      _meUid = user ? user.uid : null;
      unsub();
      resolve();
    });
  });

  return { uid: _meUid };
}

export function currentUserUid() {
  return _meUid;
}

/**
 * threadIdFromPair(uidA, uidB)
 */
function threadIdFromPair(a, b) {
  if (!a || !b) return null;
  return (a < b) ? `${a}__${b}` : `${b}__${a}`;
}

/**
 * listThreadsForCurrentUser
 * returns array of { threadId, otherUid, otherName, lastMessageSnippet, lastTs }
 */
export async function listThreadsForCurrentUser() {
  if (!_db) throw new Error('Init first');
  if (!_meUid) return [];

  const threadsRef = ref(_db, 'threads');
  // naive approach: read all threads and filter by participation
  // For larger scale, you should index threads by participant: /user-threads/{uid}/{threadId}: true
  const snap = await get(threadsRef);
  const res = [];

  if (!snap.exists()) return res;

  const threads = snap.val();
  for (const [tid, meta] of Object.entries(threads)) {
    const participants = meta.participants || {};
    if (participants[_meUid]) {
      const otherUid = Object.keys(participants).find(x => x !== _meUid);
      // try to get profile
      let otherName = null;
      try {
        const pSnap = await get(child(ref(_db), `profiles/${otherUid}`));
        if (pSnap.exists()) otherName = pSnap.val().displayName || pSnap.val().business_name || null;
      } catch(e){}
      res.push({
        threadId: tid,
        otherUid,
        otherName,
        lastMessageSnippet: meta.lastMessage ? (String(meta.lastMessage).slice(0,60)) : '',
        lastTs: meta.lastTs || 0
      });
    }
  }

  // sort by lastTs desc
  res.sort((a,b)=> (b.lastTs||0) - (a.lastTs||0));
  return res;
}

/**
 * openThreadByOtherUid — will create if not exists.
 * Accepts either a firebase UID (preferred) or fallback numeric/mysql ID.
 * If a MySQL id is passed, this function will attempt to fetch a firebase_uid from backend:
 *    GET /api/vendor/fetch-firebase-uid/{mysqlId}
 * (You can add a tiny endpoint server-side to return the firebase_uid for an id.)
 *
 * callback receives threadInfo { threadId, otherUid, otherMeta } or null on failure.
 */
export async function openThreadByOtherUid(otherUidOrId, callback) {
  if (!_db) throw new Error('Init first');
  if (!_meUid) {
    callback(null); return;
  }

  let otherUid = otherUidOrId;

  // Heuristic: if it looks like a number (mysql id), try to look up firebase_uid via backend
  if (/^\d+$/.test(String(otherUidOrId))) {
    try {
      const res = await fetch(`/api/vendor/firebase-uid/${encodeURIComponent(otherUidOrId)}`);
      const json = await res.json();
      if (res.ok && json.firebase_uid) otherUid = json.firebase_uid;
      else {
        // as a fallback, create a thread id using a prefix so messages are still stored
        // but warn the caller (we pass otherUid as 'mysql_{id}')
        otherUid = `mysql_${otherUidOrId}`;
      }
    } catch(err) {
      otherUid = `mysql_${otherUidOrId}`;
    }
  }

  const threadId = threadIdFromPair(_meUid, otherUid);
  if (!threadId) { callback(null); return; }

  const metaRef = ref(_db, `threads/${threadId}/meta`);
  const metaSnap = await get(metaRef);

  if (!metaSnap.exists()) {
    // create
    const metaData = {
      participants: { [ _meUid ]: true, [ otherUid ]: true },
      createdAt: Date.now(),
      lastMessage: null,
      lastTs: 0
    };
    await set(metaRef, metaData);
  }

  // try to fetch other profile meta (non-blocking)
  let otherMeta = null;
  try {
    const p = await get(child(ref(_db), `profiles/${otherUid}`));
    if (p.exists()) otherMeta = p.val();
  } catch(e){}

  callback({ threadId, otherUid, otherMeta });
}

/**
 * sendMessageToThread(threadId, {text})
 */
export async function sendMessageToThread(threadId, { text }) {
  if (!_db) throw new Error('Init first');
  if (!_meUid) throw new Error('Not signed in');

  const messagesRef = ref(_db, `messages/${threadId}`);
  const newMsgRef = push(messagesRef);
  const payload = {
    senderUid: _meUid,
    text: String(text || ''),
    ts: Date.now(),
    aiContext: null // reserved for future AI integration
  };
  await set(newMsgRef, payload);

  // update thread meta
  const metaRef = ref(_db, `threads/${threadId}/meta`);
  await set(child(metaRef, 'lastMessage'), payload.text);
  await set(child(metaRef, 'lastTs'), payload.ts);
  return payload;
}

/**
 * onThreadMessages(threadId, onMessage)
 * onMessage receives message object { senderUid, text, ts } as soon as a child is added
 */
export function onThreadMessages(threadId, onMessage) {
  if (!_db) throw new Error('Init first');
  const q = query(ref(_db, `messages/${threadId}`), orderByChild('ts'));
  onChildAdded(q, snap => {
    if (!snap.exists()) return;
    const m = snap.val();
    onMessage({ senderUid: m.senderUid, text: m.text, ts: m.ts, id: snap.key });
  });
}
