// ============================================================
// MAIN APPLICATION ROUTER & LAYOUT MANAGER - SOMAC
// ============================================================

const App = {
  currentSection: 'admin-dashboard',

  // Live auto-refresh state (Optimized for Firebase Free Tier / Spark quota)
  liveRefreshState: {
    intervalSeconds: 300, // 5 min default = 288 queries/day (only ~0.5% of Firebase 50k limit)
    remainingSeconds: 300,
    timerId: null,
    autoCycle: false,
    autoCycleSeconds: 30,
    autoCycleRemaining: 30,
    cycleIndex: 0,
    views: ['admin-dashboard', 'admin-stats', 'admin-machines-avail']
  },

  init() {
    // 1. Restore active session from persistent storage
    Auth.init();

    // 2. Route to dashboard or login
    if (Auth.isLoggedIn()) {
      this.showDashboard();
    } else {
      this.showLogin();
    }
  },

  showLogin() {
    this.stopLiveRefresh();
    const root = document.getElementById('app');
    if (root) root.innerHTML = renderLogin();
    this.bindLoginEvents();
  },

  showDashboard(section) {
    const user = Auth.currentUser;
    const root = document.getElementById('app');

    const defaultSection = this.getDefaultSectionForRole(user.role);
    this.currentSection = section || defaultSection;

    if (root) root.innerHTML = renderAppLayout(user, this.currentSection);
    this.bindNavigation();
    this.renderSection(this.currentSection);

    // Start background live refresh
    this.startLiveRefresh();
  },

  getDefaultSectionForRole(role) {
    const defaults = {
      sup_op:       'new-report',
      tecnico:      'tech-reports',
      sup_mtto:     'admin-dashboard',
      planeador:    'requisitions',
      programador:  'pm-tickets',
      display:      'admin-dashboard',
      admin:        'admin-dashboard',
    };
    return defaults[role] || 'admin-dashboard';
  },

  navigate(section) {
    this.currentSection = section;
    document.querySelectorAll('[data-section]').forEach(el => {
      el.classList.toggle('active', el.dataset.section === section);
    });
    // Auto-close sidebar on mobile when navigating
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('open');
    this.renderSection(section);
  },

  renderSection(section) {
    const content = document.getElementById('section-content');
    if (!content) return;
    try {
      const html = this._getSectionHTML(section);
      content.innerHTML = html;
      this._initSectionLogic(section);
      this.updateSidebar();
    } catch(e) {
      console.error('Section render error:', e);
      content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-title">Error al cargar</div><div class="empty-state-desc">${e.message}</div></div>`;
    }
  },

  _getSectionHTML(section) {
    switch(section) {
      case 'new-report':        return renderNewReportView();
      case 'my-reports':        return renderMyReportsView();
      case 'tech-reports':      return renderTechnicianView();
      case 'sup-reports':       return renderSupervisorView();
      case 'pm-tickets':        return renderPMView();
      case 'requisitions':      return renderRequisitionsView();
      case 'knowledge-base':
        if (Auth.currentUser?.role === 'sup_op') return renderMyReportsView();
        return renderKnowledgeBaseView();
      case 'admin-dashboard':   return renderAdminDashboard();
      case 'admin-reports':     return renderAdminReportsTable();
      case 'admin-machines':    return renderAdminMachines();
      case 'admin-users':       return renderAdminUsers();
      case 'admin-stats':          return renderAdminStats();
      case 'admin-machines-avail': return renderMachineAvailView();
      case 'admin-config':         return renderAdminConfig();
      case 'admin-audit':          return renderAdminAudit();
      default: return '<div class="empty-state"><div class="empty-state-icon">🚧</div><div class="empty-state-title">Sección no encontrada</div></div>';
    }
  },

  _initSectionLogic(section) {
    if (section === 'admin-reports') initReportsTable();
  },

  // ---- LIVE AUTO-REFRESH & TV SYSTEM -------------------------
  startLiveRefresh() {
    this.stopLiveRefresh();
    this.liveRefreshState.remainingSeconds = this.liveRefreshState.intervalSeconds;

    this.liveRefreshState.timerId = setInterval(() => {
      // 1. Data Auto-Refresh Countdown
      if (this.liveRefreshState.intervalSeconds > 0) {
        this.liveRefreshState.remainingSeconds--;
        if (this.liveRefreshState.remainingSeconds <= 0) {
          this.triggerManualRefresh(true);
        }
      }

      // 2. TV Wall Auto-Cycle (Alternates between Dashboard & KPIs)
      if (this.liveRefreshState.autoCycle) {
        this.liveRefreshState.autoCycleRemaining--;
        if (this.liveRefreshState.autoCycleRemaining <= 0) {
          this.liveRefreshState.autoCycleRemaining = this.liveRefreshState.autoCycleSeconds;
          this.liveRefreshState.cycleIndex = (this.liveRefreshState.cycleIndex + 1) % this.liveRefreshState.views.length;
          const nextSec = this.liveRefreshState.views[this.liveRefreshState.cycleIndex];
          this.navigate(nextSec);
        }
      }

      this.updateLiveBadgeUI();
    }, 1000);
  },

  stopLiveRefresh() {
    if (this.liveRefreshState.timerId) {
      clearInterval(this.liveRefreshState.timerId);
      this.liveRefreshState.timerId = null;
    }
  },

  triggerManualRefresh(silent = false) {
    this.liveRefreshState.remainingSeconds = this.liveRefreshState.intervalSeconds;
    this.renderSection(this.currentSection);
    if (!silent && window.NotifSystem) {
      NotifSystem.toast('info', 'Datos actualizados', 'Tablero sincronizado.', 2000);
    }
    this.updateLiveBadgeUI();
  },

  setRefreshInterval(secs) {
    this.liveRefreshState.intervalSeconds = parseInt(secs) || 0;
    this.liveRefreshState.remainingSeconds = this.liveRefreshState.intervalSeconds;
    this.updateLiveBadgeUI();
    if (window.NotifSystem) {
      const msg = this.liveRefreshState.intervalSeconds > 0
        ? `Actualización cada ${Math.round(this.liveRefreshState.intervalSeconds / 60)} min`
        : 'Actualización automática pausada';
      NotifSystem.toast('info', 'Frecuencia de actualización', msg, 2500);
    }
  },

  toggleAutoCycle(enabled) {
    this.liveRefreshState.autoCycle = enabled;
    this.liveRefreshState.autoCycleRemaining = this.liveRefreshState.autoCycleSeconds;
    if (enabled && window.NotifSystem) {
      NotifSystem.toast('success', 'Modo TV Rotativo', 'Alternando Dashboard y KPIs cada 30s.', 3000);
    }
  },

  toggleFullscreen() {
    if (!document.fullscreenElement && !document.body.classList.contains('fullscreen-mode')) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(() => {
          document.body.classList.add('fullscreen-mode');
        }).catch(() => {
          document.body.classList.toggle('fullscreen-mode');
        });
      } else {
        document.body.classList.toggle('fullscreen-mode');
      }
    } else {
      if (document.exitFullscreen && document.fullscreenElement) {
        document.exitFullscreen().then(() => {
          document.body.classList.remove('fullscreen-mode');
        }).catch(() => {
          document.body.classList.remove('fullscreen-mode');
        });
      } else {
        document.body.classList.remove('fullscreen-mode');
      }
    }
  },

  updateLiveBadgeUI() {
    const textEl = document.getElementById('live-refresh-text');
    if (textEl) {
      if (this.liveRefreshState.intervalSeconds <= 0) {
        textEl.textContent = 'Pausado';
      } else {
        const mins = Math.floor(this.liveRefreshState.remainingSeconds / 60);
        const secs = this.liveRefreshState.remainingSeconds % 60;
        textEl.textContent = `En vivo · ${mins}:${String(secs).padStart(2, '0')}`;
      }
    }
    // Update Firebase connection status dot
    const fbDot = document.getElementById('firebase-status-dot');
    if (fbDot) {
      const status = window.FirebaseSync?.lastStatus || 'disconnected';
      if (status === 'connected') {
        fbDot.style.background = '#10b981';
        fbDot.style.boxShadow = '0 0 6px #10b981';
        fbDot.title = '🟢 Nube Firebase conectada y sincronizada';
      } else if (status === 'permission-denied') {
        fbDot.style.background = '#ef4444';
        fbDot.style.boxShadow = '0 0 6px #ef4444';
        fbDot.title = '🔴 Permiso denegado: activa las reglas en Firebase Console';
      } else if (status === 'connecting') {
        fbDot.style.background = '#f59e0b';
        fbDot.style.boxShadow = '0 0 6px #f59e0b';
        fbDot.title = '🟡 Conectando a Firebase...';
      } else {
        fbDot.style.background = '#64748b';
        fbDot.style.boxShadow = 'none';
        fbDot.title = '⚫ Sin conexión a Firebase (modo local)';
      }
    }
  },

  bindLoginEvents() {
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('login-user').value.trim();
      const p = document.getElementById('login-pass').value;
      const result = await Auth.login(u, p);
      if (result.success) {
        this.showDashboard();
      } else {
        const errEl = document.getElementById('login-error');
        if (errEl) {
          errEl.textContent = result.error || 'Credenciales no válidas';
          errEl.classList.remove('hidden');
        }
      }
    });
  },

  bindNavigation() {
    document.querySelectorAll('[data-section]').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.section));
    });

    document.getElementById('btn-logout')?.addEventListener('click', () => {
      Auth.logout();
      this.showLogin();
    });

    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
      document.getElementById('sidebar-overlay')?.classList.toggle('open');
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('open');
    });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) {
        document.body.classList.add('fullscreen-mode');
      } else {
        document.body.classList.remove('fullscreen-mode');
      }
    });
  },

  updateSidebar() {
    const navContainer = document.querySelector('.sidebar-nav');
    if (navContainer && Auth.currentUser) {
      navContainer.innerHTML = getNavItems(Auth.currentUser);
      document.querySelectorAll('[data-section]').forEach(el => {
        el.classList.toggle('active', el.dataset.section === this.currentSection);
        el.onclick = () => this.navigate(el.dataset.section);
      });
    }
  },
};

// ============================================================
// LAYOUT RENDERERS
// ============================================================

function renderLogin() {
  return `
  <div class="login-screen">
    <div class="login-card fade-in" style="max-width:540px">
      <div class="login-logo">
        <img src="assets/danfoss_logo.png" alt="Danfoss" style="height:56px;width:auto;object-fit:contain;border-radius:8px;margin-bottom:4px">
        <div class="login-title">SOMAC</div>
        <div class="login-sub">Sistema Operativo de Mantenimiento Correctivo</div>
      </div>
      <form id="login-form">
        <div class="form-group">
          <label class="form-label">Usuario <span class="required">*</span></label>
          <input type="text" id="login-user" class="form-input" placeholder="Ingresa tu usuario" autocomplete="username" required>
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña <span class="required">*</span></label>
          <input type="password" id="login-pass" class="form-input" placeholder="••••••••" autocomplete="current-password" required>
        </div>
        <div id="login-error" class="form-error hidden"></div>
        <button type="submit" class="btn btn-primary btn-full btn-lg" style="margin-top:12px">
          🔐 Iniciar Sesión
        </button>
      </form>
    </div>
  </div>`;
}

function renderAppLayout(user, activeSection) {
  const nav = getNavItems(user);
  const roleLabel = {
    sup_op: 'Supervisor de Operación',
    tecnico: 'Técnico de Mantenimiento',
    sup_mtto: 'Supervisor de Mantenimiento',
    planeador: 'Planeador de Mantenimiento',
    programador: 'Programador MP',
    display: 'Pantalla Informativa (TV)',
    admin: 'Administrador'
  };
  const initials = user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const plantBadge = user.plantId === 'ambas' ? 'Ambas Plantas' : (user.plantId === 'plant-2' ? 'Planta 2' : 'Planta 1');

  return `
  <div class="app-layout">
    <div id="sidebar-overlay" class="sidebar-overlay"></div>
    <aside id="sidebar" class="sidebar">
      <div class="sidebar-logo">
        <img src="assets/danfoss_logo.png" alt="Danfoss" style="width:38px;height:38px;min-width:38px;max-width:38px;max-height:38px;object-fit:contain;background:#e2000f;border-radius:8px;padding:2px 4px;flex-shrink:0;display:block;">
        <div>
          <div class="logo-text">SOMAC</div>
          <div class="logo-sub">${DB.Config.get().companyName || 'Danfoss'}</div>
        </div>
      </div>
      <div class="sidebar-user">
        <div class="user-info">
          <div class="user-avatar role-${user.role}">${initials}</div>
          <div>
            <div class="user-name">${user.name}</div>
            <div class="user-role">${roleLabel[user.role] || user.role}</div>
            <span style="font-size:10px;background:rgba(47,129,247,.15);color:var(--accent-blue);padding:1px 6px;border-radius:8px;font-weight:600;display:inline-block;margin-top:2px">
              🏭 ${plantBadge}
            </span>
          </div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${nav}
      </nav>
      <div class="sidebar-footer">
        <button id="btn-logout" class="btn btn-ghost btn-full btn-sm">
          🚪 Cerrar Sesión
        </button>
      </div>
    </aside>
    <div class="main-content">
      <header class="page-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button id="mobile-menu-btn" class="mobile-menu-btn">☰</button>
          <div id="page-title-area">
            <div class="page-title" id="current-page-title">SOMAC</div>
          </div>
        </div>
        <div class="header-right-actions" style="display:flex;align-items:center;gap:8px">
          <!-- Live Refresh Pill Indicator -->
          <div class="live-refresh-pill" id="live-refresh-widget" style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:20px;font-size:11px">
            <span id="live-dot" style="width:7px;height:7px;border-radius:50%;background:var(--accent-green);box-shadow:0 0 6px var(--accent-green);display:inline-block"></span>
            <span id="live-refresh-text" style="color:var(--text-secondary);font-weight:600">En vivo · 5:00</span>
            <span id="firebase-status-dot" title="Estado Firebase" style="width:7px;height:7px;border-radius:50%;background:#64748b;display:inline-block;margin-left:2px"></span>
            <button class="btn-icon" onclick="App.triggerManualRefresh()" title="Actualizar datos ahora" style="padding:1px;font-size:12px;color:var(--text-muted);cursor:pointer">🔄</button>
          </div>

          <!-- Refresh Rate Selector -->
          <div class="header-rate-selector">
            <select class="form-select" onchange="App.setRefreshInterval(this.value)" title="Frecuencia de actualización" style="padding:4px 8px;font-size:11px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;color:var(--text-secondary);cursor:pointer;width:auto">
              <option value="300" selected>⏱️ 5 min</option>
              <option value="120">⏱️ 2 min</option>
              <option value="600">⏱️ 10 min</option>
              <option value="0">⏸️ Pausar</option>
            </select>
          </div>

          <!-- Fullscreen button -->
          <div class="header-fullscreen-btn">
            <button class="btn btn-ghost btn-sm" onclick="App.toggleFullscreen()" title="Pantalla Completa (TV)" style="padding:4px 8px;font-size:13px">
              ⛶
            </button>
          </div>

          <div class="header-plant-badge" style="font-size:12px;color:var(--text-secondary);margin-left:4px">
            🏭 <strong style="color:var(--text-primary)">${plantBadge}</strong>
          </div>
        </div>
      </header>
      <main class="page-content">
        <div id="section-content"></div>
      </main>
    </div>
  </div>`;
}

function getNavItems(user) {
  const role = user.role;

  // Counts scoped by user plant
  const userReports = DB.Reports.getByUserPlant(user);
  const openCount = userReports.filter(r => r.status === 'open').length;
  const pendCount = userReports.filter(r => r.status === 'pending').length;
  const workCount = user.role === 'tecnico'
    ? userReports.filter(r => r.status === 'working' && r.technicianId === user.id).length
    : userReports.filter(r => r.status === 'working').length;

  const userPM = DB.PMTickets.getByUserPlant(user);
  const pmPendingCount = userPM.filter(t => t.status === 'pendiente' || t.status === 'en-revision').length;

  const reqCount = DB.Requisitions.getByUserPlant(user).filter(r => r.status === 'pendiente_aprobacion').length;

  // 1. Supervisor Operación
  if (role === 'sup_op') return `
    <span class="nav-section-title">Producción</span>
    <button class="nav-item ${App.currentSection==='new-report'?'active':''}" data-section="new-report">
      <span class="nav-icon">➕</span> Reportar Falla
    </button>
    <button class="nav-item ${App.currentSection==='my-reports'?'active':''}" data-section="my-reports">
      <span class="nav-icon">📋</span> Reportes de Planta
      ${openCount > 0 ? `<span class="nav-badge">${openCount}</span>` : ''}
    </button>`;

  // 2. Técnico Mantenimiento
  if (role === 'tecnico') return `
    <span class="nav-section-title">Mantenimiento</span>
    <button class="nav-item ${App.currentSection==='tech-reports'?'active':''}" data-section="tech-reports">
      <span class="nav-icon">🔧</span> Fallas Activas
      ${openCount + workCount > 0 ? `<span class="nav-badge">${openCount + workCount}</span>` : ''}
    </button>
    <button class="nav-item ${App.currentSection==='new-report'?'active':''}" data-section="new-report">
      <span class="nav-icon">➕</span> Nueva Falla
    </button>
    <button class="nav-item ${App.currentSection==='pm-tickets'?'active':''}" data-section="pm-tickets">
      <span class="nav-icon">⏳</span> Mis Pendientes (MP)
      ${pmPendingCount > 0 ? `<span class="nav-badge blue">${pmPendingCount}</span>` : ''}
    </button>
    <button class="nav-item ${App.currentSection==='requisitions'?'active':''}" data-section="requisitions">
      <span class="nav-icon">🛒</span> Materiales &amp; Almacén
    </button>
    <button class="nav-item ${App.currentSection==='knowledge-base'?'active':''}" data-section="knowledge-base">
      <span class="nav-icon">📚</span> Historial
    </button>`;

  // 3. Supervisor Mantenimiento
  if (role === 'sup_mtto') return `
    <span class="nav-section-title">Supervisión Mtto</span>
    <button class="nav-item ${App.currentSection==='admin-dashboard'?'active':''}" data-section="admin-dashboard">
      <span class="nav-icon">📊</span> Estado de Planta
    </button>
    <button class="nav-item ${App.currentSection==='tech-reports'?'active':''}" data-section="tech-reports">
      <span class="nav-icon">🔧</span> Fallas Activas
      ${openCount + workCount > 0 ? `<span class="nav-badge">${openCount + workCount}</span>` : ''}
    </button>
    <button class="nav-item ${App.currentSection==='sup-reports'?'active':''}" data-section="sup-reports">
      <span class="nav-icon">⏳</span> Pendientes de Visto Bueno
      ${pendCount > 0 ? `<span class="nav-badge yellow">${pendCount}</span>` : ''}
    </button>
    <button class="nav-item ${App.currentSection==='pm-tickets'?'active':''}" data-section="pm-tickets">
      <span class="nav-icon">📌</span> Actividades Pendientes (MP)
      ${pmPendingCount > 0 ? `<span class="nav-badge blue">${pmPendingCount}</span>` : ''}
    </button>
    <button class="nav-item ${App.currentSection==='requisitions'?'active':''}" data-section="requisitions">
      <span class="nav-icon">🛒</span> Materiales Solicitados
    </button>
    <button class="nav-item ${App.currentSection==='knowledge-base'?'active':''}" data-section="knowledge-base">
      <span class="nav-icon">📚</span> Historial
    </button>`;

  // 4. Planeador de Mantenimiento
  if (role === 'planeador') return `
    <span class="nav-section-title">Planificación &amp; Materiales</span>
    <button class="nav-item ${App.currentSection==='requisitions'?'active':''}" data-section="requisitions">
      <span class="nav-icon">🛒</span> Materiales Solicitados
      ${reqCount > 0 ? `<span class="nav-badge yellow">${reqCount}</span>` : ''}
    </button>
    <button class="nav-item ${App.currentSection==='pm-tickets'?'active':''}" data-section="pm-tickets">
      <span class="nav-icon">📌</span> Actividades Pendientes (MP)
      ${pmPendingCount > 0 ? `<span class="nav-badge blue">${pmPendingCount}</span>` : ''}
    </button>
    <button class="nav-item ${App.currentSection==='knowledge-base'?'active':''}" data-section="knowledge-base">
      <span class="nav-icon">📚</span> Historial
    </button>`;

  // 5. Programador MP
  if (role === 'programador') return `
    <span class="nav-section-title">Plan MP</span>
    <button class="nav-item ${App.currentSection==='pm-tickets'?'active':''}" data-section="pm-tickets">
      <span class="nav-icon">🛠️</span> Actividades Pendientes (MP)
      ${pmPendingCount > 0 ? `<span class="nav-badge blue">${pmPendingCount}</span>` : ''}
    </button>
    <button class="nav-item ${App.currentSection==='knowledge-base'?'active':''}" data-section="knowledge-base">
      <span class="nav-icon">📚</span> Historial
    </button>`;

  // 6. Pantalla Informativa / TV
  if (role === 'display') return `
    <span class="nav-section-title">Pantalla Informativa (TV)</span>
    <button class="nav-item ${App.currentSection==='admin-dashboard'?'active':''}" data-section="admin-dashboard">
      <span class="nav-icon">📊</span> 1. Dashboard Global
    </button>
    <button class="nav-item ${App.currentSection==='admin-stats'?'active':''}" data-section="admin-stats">
      <span class="nav-icon">📈</span> 2. KPIs &amp; Tendencias
    </button>
    <button class="nav-item ${App.currentSection==='admin-machines-avail'?'active':''}" data-section="admin-machines-avail">
      <span class="nav-icon">🏭</span> 3. Disp. por Máquina
    </button>

    <div style="margin-top:20px;padding:12px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md)">
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px">📺 Control de TV</div>
      <button class="btn btn-primary btn-sm btn-full mb-8" onclick="App.toggleFullscreen()">
        ⛶ Pantalla Completa (Ocultar Barra)
      </button>
      <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);cursor:pointer;margin-top:8px">
        <input type="checkbox" id="tv-auto-cycle" onchange="App.toggleAutoCycle(this.checked)" style="accent-color:var(--accent-blue)">
        Rotar 3 Vistas (30s)
      </label>
    </div>`;

  // 7. Administrador
  return `
    <span class="nav-section-title">Principal</span>
    <button class="nav-item ${App.currentSection==='admin-dashboard'?'active':''}" data-section="admin-dashboard">
      <span class="nav-icon">📊</span> Dashboard Global
    </button>
    <button class="nav-item ${App.currentSection==='admin-stats'?'active':''}" data-section="admin-stats">
      <span class="nav-icon">📈</span> KPIs
    </button>
    <button class="nav-item ${App.currentSection==='admin-machines-avail'?'active':''}" data-section="admin-machines-avail">
      <span class="nav-icon">🏭</span> Disp. por Máquina
    </button>

    <span class="nav-section-title">Operación</span>
    <button class="nav-item ${App.currentSection==='admin-reports'?'active':''}" data-section="admin-reports">
      <span class="nav-icon">📋</span> Todos los Reportes
      ${openCount > 0 ? `<span class="nav-badge">${openCount}</span>` : ''}
    </button>
    <button class="nav-item ${App.currentSection==='pm-tickets'?'active':''}" data-section="pm-tickets">
      <span class="nav-icon">📌</span> Actividades Pendientes (MP)
    </button>
    <button class="nav-item ${App.currentSection==='requisitions'?'active':''}" data-section="requisitions">
      <span class="nav-icon">🛒</span> Requisiciones
    </button>
    <button class="nav-item ${App.currentSection==='knowledge-base'?'active':''}" data-section="knowledge-base">
      <span class="nav-icon">📚</span> Historial
    </button>

    <span class="nav-section-title">Ajustes</span>
    <button class="nav-item ${['admin-config','admin-machines','admin-users','admin-audit'].includes(App.currentSection)?'active':''}" data-section="admin-config">
      <span class="nav-icon">⚙️</span> Configuración
    </button>`;
}

// Boot
function bootApp() {
  try {
    App.init();
  } catch(err) {
    console.error('App init error, falling back to login:', err);
    App.showLogin();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

// Real-time synchronization listeners (Reactive Data Bus)
window.addEventListener('somac:data-changed', () => {
  if (Auth && Auth.isLoggedIn()) {
    const hasModal = document.querySelector('.modal-overlay:not(#report-success-modal)');
    if (!hasModal) {
      App.renderSection(App.currentSection);
    }
    App.updateSidebar();
  }
});

window.addEventListener('storage', () => {
  if (Auth && Auth.isLoggedIn()) {
    const hasModal = document.querySelector('.modal-overlay:not(#report-success-modal)');
    if (!hasModal) {
      App.renderSection(App.currentSection);
    }
    App.updateSidebar();
  }
});

window.App = App;

