// ============================================================
// SOMAC - Firebase Cloud Firestore Real-time Sync
// ============================================================

const FirebaseSync = {
  db: null,
  app: null,
  isSyncing: false,
  unsubscribers: [],

  // Mapping between local DB_KEYS and Firestore collection names
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

  // Get active configuration from storage or window
  getConfig() {
    try {
      const saved = localStorage.getItem('somac_firebase_config');
      if (saved) return JSON.parse(saved);
    } catch (e) {}

    // Fallback default config template
    return window.SOMAC_FIREBASE_CONFIG || null;
  },

  saveConfig(configObj) {
    localStorage.setItem('somac_firebase_config', JSON.stringify(configObj));
    this.init();
  },

  isConnected() {
    return !!this.db;
  },

  init() {
    const config = this.getConfig();
    if (!config || !config.projectId || config.projectId.includes('YOUR_PROJECT')) {
      console.log('ℹ️ Firebase: Configuración pendiente. Trabajando en modo local.');
      return false;
    }

    try {
      if (!window.firebase) {
        console.warn('⚠️ SDK de Firebase no encontrado.');
        return false;
      }

      // Initialize or reuse Firebase App
      if (!firebase.apps || firebase.apps.length === 0) {
        this.app = firebase.initializeApp(config);
      } else {
        this.app = firebase.apps[0];
      }

      this.db = firebase.firestore();
      console.log('🔥 Firebase Cloud Firestore conectado exitosamente:', config.projectId);

      // Start real-time cloud listeners
      this.startRealtimeListeners();
      return true;
    } catch (err) {
      console.error('❌ Error al inicializar Firebase:', err);
      return false;
    }
  },

  // Listen to remote changes in Firestore and update local storage & UI in real time
  startRealtimeListeners() {
    if (!this.db) return;

    // Clean up existing listeners if any
    this.unsubscribers.forEach(unsub => { try { unsub(); } catch(e){} });
    this.unsubscribers = [];

    Object.entries(this.collectionMap).forEach(([localKey, colName]) => {
      try {
        const unsub = this.db.collection('somac_data').doc(colName).onSnapshot(docSnap => {
          if (docSnap.exists) {
            const data = docSnap.data();
            if (data && data.items !== undefined) {
              const localVal = db.get(localKey);
              // Compare if remote data is different before updating
              if (JSON.stringify(localVal) !== JSON.stringify(data.items)) {
                this.isSyncing = true;
                db.set(localKey, data.items, true); // true = fromRemote
                this.isSyncing = false;
              }
            }
          }
        }, err => {
          console.warn(`Error en listener de Firestore (${colName}):`, err);
        });

        this.unsubscribers.push(unsub);
      } catch (e) {
        console.warn(`No se pudo suscribir a ${colName}:`, e);
      }
    });
  },

  // Save changes to Firestore
  async saveKey(localKey, val) {
    if (!this.db || this.isSyncing) return;
    const colName = this.collectionMap[localKey];
    if (!colName) return;

    try {
      await this.db.collection('somac_data').doc(colName).set({
        items: val || (Array.isArray(val) ? [] : {}),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error(`Error guardando en Firestore (${colName}):`, err);
    }
  },

  // Push all local database to Firebase (Initial Migration)
  async pushAllToCloud() {
    if (!this.db) return false;
    try {
      for (const [localKey, colName] of Object.entries(this.collectionMap)) {
        const val = db.get(localKey);
        await this.db.collection('somac_data').doc(colName).set({
          items: val || (Array.isArray(val) ? [] : {}),
          updatedAt: new Date().toISOString()
        });
      }
      return true;
    } catch (err) {
      console.error('Error al subir datos completos a Firebase:', err);
      return false;
    }
  }
};

window.FirebaseSync = FirebaseSync;

// Auto-initialize when script loads
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    FirebaseSync.init();
  }, 100);
});
