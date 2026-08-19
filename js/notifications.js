// ============================================================
// NOTIFICATIONS MODULE - Push + SLA Checker
// ============================================================

const NotifSystem = {
  toastContainer: null,
  slaInterval: null,

  init() {
    this.toastContainer = document.getElementById('toast-container');
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.id = 'toast-container';
      this.toastContainer.className = 'notification-center';
      document.body.appendChild(this.toastContainer);
    }
    this.requestPermission();
    this.startSLAChecker();
  },

  async requestPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  },

  sendBrowserNotif(title, body, tag = 'mtto') {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body, tag, icon: '' });
    }
  },

  toast(type, title, message, duration = 5000) {
    const icons = { info: 'ℹ️', warning: '⚠️', error: '🚨', success: '✅' };
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-msg">${message}</div>` : ''}
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
    `;
    this.toastContainer.appendChild(el);
    if (duration > 0) {
      setTimeout(() => el.remove(), duration);
    }
    return el;
  },

  notifyNewReport(report) {
    const config = DB.Config.get();
    const text = config.notificationText || '⚠️ Reporte de Falla Detectado. Entra a la app para ver los detalles.';

    // In-app toast
    this.toast('warning', `Nueva Falla: ${report.machineName}`, text, 8000);

    // Browser push
    this.sendBrowserNotif(`⚠️ ${report.machineName}`, text, `report-${report.id}`);

    // Store notification
    DB.Notifications.add({
      type: 'new_report',
      reportId: report.id,
      title: `Nueva Falla: ${report.machineName}`,
      message: text,
      plantId: report.plantId,
    });

    // Notify active shift users (in real app would be push; here we just store)
    console.log('[NOTIF] New report notification sent for:', report.id);
  },

  startSLAChecker() {
    if (this.slaInterval) clearInterval(this.slaInterval);
    this.slaInterval = setInterval(() => this._checkSLA(), 60000); // Every minute
    this._checkSLA(); // Immediate check
  },

  stopSLAChecker() {
    if (this.slaInterval) clearInterval(this.slaInterval);
  },

  _checkSLA() {
    const config = DB.Config.get();
    if (!config.slaEnabled) return;
    const slaMs = (config.slaMinutes || 60) * 60000;
    const now = Date.now();

    const openReports = DB.Reports.getByStatus('open');
    openReports.forEach(report => {
      const age = now - new Date(report.t0).getTime();
      if (age >= slaMs && !report.slaEscalationSent) {
        this._escalateSLA(report, config);
        DB.Reports._update(report.id, r => ({
          ...r, slaEscalated: true, slaEscalationSent: true
        }));
      }
    });
  },

  _escalateSLA(report, config) {
    const minutes = Math.floor((Date.now() - new Date(report.t0).getTime()) / 60000);
    const text = (config.escalationText || '🚨 ALERTA: Falla en {machine} sigue sin ser leída después de {minutes} minutos.')
      .replace('{machine}', report.machineName)
      .replace('{minutes}', minutes);

    // Show critical toast
    this.toast('error', '🚨 ESCALACIÓN SLA', text, 0); // 0 = don't auto-dismiss

    // Browser notification
    this.sendBrowserNotif('🚨 ESCALACIÓN SLA', text, `sla-${report.id}`);

    // Store as high-priority notification
    DB.Notifications.add({
      type: 'sla_escalation',
      reportId: report.id,
      title: '🚨 ESCALACIÓN SLA',
      message: text,
      plantId: report.plantId,
      priority: 'critical',
    });

    // Emit custom event for admin panel to react
    window.dispatchEvent(new CustomEvent('sla-escalation', { detail: { report, minutes } }));

    console.warn('[SLA] Escalation triggered for report:', report.id, 'after', minutes, 'minutes');
  },
};

window.NotifSystem = NotifSystem;
