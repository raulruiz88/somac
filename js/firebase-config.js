// ============================================================
// SOMAC - Firebase Cloud Firestore Bidirectional Sync Engine
// ============================================================

window.SOMAC_FIREBASE_CONFIG = {
  apiKey: "AIzaSyDUDYJRuGy-trFL88mynLVVGFYN9bd4QlY",
  authDomain: "somac-danfoss.firebaseapp.com",
  projectId: "somac-danfoss",
  storageBucket: "somac-danfoss.firebasestorage.app",
  messagingSenderId: "990658636698",
  appId: "1:990658636698:web:4f65c059f43eb9260a6823"
};

const FirebaseSync = {
  db: null,
  app: null,
  isSyncing: false,
  unsubscribers: [],
  lastStatus: 'connecting', // 'connected' | 'permission-denied' | 'error' | 'disconnected'
  lastErrorMsg: '',

  collectionMap: {
    'mtto_reports':      'reports',
    'mtto_users':        'users',
    'mtto_machines':     'machines',
    'mtto_plants':       'plants',
    'mtto_pm_tickets':   'pm_tickets',
    'mtto_requisitions': 'requisitions',
    'mtto_inventory':    'inventory',
    'mtto_config':       'config',
    'mtto_audit_log':    'audit_log',
  },

  getConfig() {
    try {
      const saved = localStorage.getItem('somac_firebase_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.projectId && parsed.apiKey && !parsed.projectId.includes('YOUR_PROJECT')) {
          return parsed;
        }
      }
    } catch (e) {}
    return window.SOMAC_FIREBASE_CONFIG || null;
  },

  saveConfig(configObj) {
    localStorage.setItem('somac_firebase_config', JSON.stringify(configObj));
    this.db = null;
    this.init();
  },

  isConnected() {
    return !!this.db && this.lastStatus === 'connected';
  },

  init() {
    if (this.db && this.lastStatus === 'connected') return true;
    const config = this.getConfig();
    if (!config || !config.projectId || config.projectId.includes('YOUR_PROJECT')) {
      this.lastStatus = 'disconnected';
      return false;
    }

    try {
      if (!window.firebase) {
        this.lastStatus = 'error';
        console.warn('⚠️ SDK de Firebase no encontrado.');
        return false;
      }

      if (!firebase.apps || firebase.apps.length === 0) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.apps[0];
      }

      this.db = firebase.firestore();
      console.log('🔥 Firebase Cloud Firestore inicializado:', config.projectId);

      this.startRealtimeListeners();
      this.syncAll();
      return true;
    } catch (err) {
      this.lastStatus = 'error';
      this.lastErrorMsg = err.message || '';
      console.error('❌ Error al inicializar Firebase:', err);
      return false;
    }
  },

  // Merge array by unique key (username for users, id for others)
  mergeArrays(localArr, remoteArr, keyProp = 'id') {
    if (!Array.isArray(localArr)) localArr = [];
    if (!Array.isArray(remoteArr)) remoteArr = [];

    const map = new Map();
    remoteArr.forEach(item => {
      if (item) {
        const k = (keyProp === 'username' && item.username) ? item.username.toLowerCase() : (item[keyProp] || item.id || item.username);
        if (k) map.set(k, item);
      }
    });

    localArr.forEach(item => {
      if (item) {
        const k = (keyProp === 'username' && item.username) ? item.username.toLowerCase() : (item[keyProp] || item.id || item.username);
        if (k) {
          if (map.has(k)) {
            const existing = map.get(k);
            const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            const itemTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
            if (itemTime >= existingTime) {
              map.set(k, { ...existing, ...item });
            }
          } else {
            map.set(k, item);
          }
        }
      }
    });

    return Array.from(map.values());
  },

  // Listen to remote changes in Firestore and update local storage & UI in real time
  startRealtimeListeners() {
    if (!this.db) return;

    this.unsubscribers.forEach(unsub => { try { unsub(); } catch(e){} });
    this.unsubscribers = [];

    Object.entries(this.collectionMap).forEach(([localKey, colName]) => {
      try {
        const unsub = this.db.collection('somac_data').doc(colName).onSnapshot(docSnap => {
          this.lastStatus = 'connected';
          this.lastErrorMsg = '';

          if (docSnap.exists) {
            const data = docSnap.data();
            if (data && data.items !== undefined) {
              const localVal = db.get(localKey);
              let finalVal = data.items;

              // If it's an array, perform a smart merge so local offline entries aren't lost
              if (Array.isArray(localVal) && Array.isArray(data.items)) {
                const keyProp = localKey === 'mtto_users' ? 'username' : 'id';
                finalVal = this.mergeArrays(localVal, data.items, keyProp);
              }

              if (JSON.stringify(localVal) !== JSON.stringify(finalVal)) {
                this.isSyncing = true;
                db.set(localKey, finalVal, true);
                this.isSyncing = false;
              }
            }
          }
        }, err => {
          if (err.code === 'permission-denied') {
            this.lastStatus = 'permission-denied';
            this.lastErrorMsg = 'Reglas de Firestore bloqueadas.';
          } else {
            this.lastStatus = 'error';
            this.lastErrorMsg = err.message || '';
          }
        });

        this.unsubscribers.push(unsub);
      } catch (e) {
        console.warn(`No se pudo suscribir a ${colName}:`, e);
      }
    });
  },

  // Smart Bidirectional Sync for a single key
  async syncKey(localKey) {
    if (!this.db) this.init();
    if (!this.db) return null;

    const colName = this.collectionMap[localKey];
    if (!colName) return null;

    try {
      const docRef = this.db.collection('somac_data').doc(colName);
      const docSnap = await docRef.get();
      this.lastStatus = 'connected';
      this.lastErrorMsg = '';

      const localVal = db.get(localKey);
      let remoteVal = docSnap.exists ? docSnap.data()?.items : null;

      // If remote does not exist, upload local data to cloud
      if (!docSnap.exists || remoteVal === null || remoteVal === undefined) {
        if (localVal) {
          await docRef.set({
            items: localVal,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
        return localVal;
      }

      // If both are arrays, reconcile and update both sides
      if (Array.isArray(localVal) && Array.isArray(remoteVal)) {
        const keyProp = localKey === 'mtto_users' ? 'username' : 'id';
        const merged = this.mergeArrays(localVal, remoteVal, keyProp);

        if (JSON.stringify(localVal) !== JSON.stringify(merged)) {
          this.isSyncing = true;
          db.set(localKey, merged, true);
          this.isSyncing = false;
        }

        if (JSON.stringify(remoteVal) !== JSON.stringify(merged)) {
          await docRef.set({
            items: merged,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        return merged;
      } else {
        const merged = { ...(remoteVal || {}), ...(localVal || {}) };
        if (JSON.stringify(localVal) !== JSON.stringify(merged)) {
          this.isSyncing = true;
          db.set(localKey, merged, true);
          this.isSyncing = false;
        }
        return merged;
      }
    } catch (err) {
      if (err.code === 'permission-denied') {
        this.lastStatus = 'permission-denied';
        this.lastErrorMsg = 'Reglas de Firestore bloqueadas.';
      } else {
        this.lastStatus = 'error';
        this.lastErrorMsg = err.message || '';
      }
      console.warn(`Error al sincronizar ${colName}:`, err);
    }
    return null;
  },

  async syncAll() {
    if (!this.db) this.init();
    if (!this.db) return false;
    let ok = true;
    for (const localKey of Object.keys(this.collectionMap)) {
      const res = await this.syncKey(localKey);
      if (res === null && this.lastStatus !== 'connected') ok = false;
    }
    return ok;
  },

  // Save changes to Firestore
  async saveKey(localKey, val) {
    if (!this.db) this.init();
    if (!this.db || this.isSyncing) return;
    const colName = this.collectionMap[localKey];
    if (!colName) return;

    try {
      await this.db.collection('somac_data').doc(colName).set({
        items: val || (Array.isArray(val) ? [] : {}),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      this.lastStatus = 'connected';
      this.lastErrorMsg = '';
    } catch (err) {
      if (err.code === 'permission-denied') {
        this.lastStatus = 'permission-denied';
        this.lastErrorMsg = 'Reglas de Firestore bloqueadas.';
      } else {
        console.error(`Error guardando en Firestore (${colName}):`, err);
      }
    }
  },

  // Test read/write connection
  async testConnection() {
    if (!this.db) this.init();
    if (!this.db) return { success: false, message: 'No se pudo inicializar Firebase' };

    try {
      const testRef = this.db.collection('somac_data').doc('_test_ping');
      await testRef.set({ ping: true, time: new Date().toISOString() });
      this.lastStatus = 'connected';
      this.lastErrorMsg = '';
      return { success: true, message: 'Conexión a Firestore exitosa y reglas activas.' };
    } catch (err) {
      if (err.code === 'permission-denied') {
        this.lastStatus = 'permission-denied';
        return { success: false, message: 'Permiso denegado: debes activar "allow read, write: if true;" en las Reglas de Firebase Console.' };
      }
      return { success: false, message: err.message || 'Error al conectar con Firestore' };
    }
  }
};

window.FirebaseSync = FirebaseSync;

// Auto-initialize immediately
try {
  FirebaseSync.init();
} catch (e) {}

document.addEventListener('DOMContentLoaded', () => {
  FirebaseSync.init();
});

window.addEventListener('load', () => {
  FirebaseSync.init();
});
