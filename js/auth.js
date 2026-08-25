// ============================================================
// AUTH MODULE - Session Management & Role Helpers
// ============================================================

const SESSION_KEY = 'mtto_session';

const Auth = {
  currentUser: null,

  init() {
    const saved = localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const fresh = DB.Users.getById(parsed.id);
        if (fresh && fresh.active !== false) {
          this.currentUser = fresh;
          localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
        } else {
          this.logout();
        }
      } catch {
        this.logout();
      }
    }
  },

  async login(username, password) {
    let user = DB.Users.login(username, password);
    // If not found in local storage, query Firestore in the cloud
    if (!user && window.FirebaseSync) {
      await window.FirebaseSync.pullKey('mtto_users');
      user = DB.Users.login(username, password);
    }
    if (!user) return { success: false, error: 'Usuario o contraseña incorrectos' };
    this.currentUser = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return { success: true, user };
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  },

  isLoggedIn() { return !!this.currentUser; },

  hasRole(...roles) {
    return this.currentUser && roles.includes(this.currentUser.role);
  },

  isAdmin() { return this.hasRole('admin'); },
  isTechnician() { return this.hasRole('tecnico'); },
  isMaintenanceSupervisor() { return this.hasRole('sup_mtto', 'admin'); },
  isOperationSupervisor() { return this.hasRole('sup_op'); },
  isPlanner() { return this.hasRole('planeador'); },
  isProgrammer() { return this.hasRole('programador'); },
  isDisplay() { return this.hasRole('display'); },

  canCreateReport() { return this.hasRole('sup_op', 'tecnico', 'sup_mtto', 'admin'); },
  canCloseReport() { return this.hasRole('tecnico', 'sup_mtto', 'admin'); },
  canSignReport() { return this.hasRole('sup_mtto', 'admin'); },

  getUserPlant() {
    return this.currentUser ? (this.currentUser.plantId || 'plant-1') : 'plant-1';
  }
};

window.Auth = Auth;
