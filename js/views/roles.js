// ============================================================
// ROLE VIEWS - Report Creation, Technician Queue, Supervisor Signoff
// ============================================================

let techState = {
  activeTab: 'unassigned',
};

// ---- NEW REPORT VIEW (Sup Operación / Técnico / Admin) ------
function renderNewReportView() {
  const user = Auth.currentUser;
  const userPlant = user.plantId;
  const plants = DB.Plants.getActive();

  let initialPlantId = userPlant !== 'ambas' ? userPlant : (plants[0]?.id || 'plant-1');
  const machines = DB.Machines.getByPlant(initialPlantId);

  return `
  <div class="fade-in" style="max-width:640px;margin:0 auto">
    <div class="card" style="padding:28px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
        <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,68,68,.12);color:var(--accent-red);display:flex;align-items:center;justify-content:center;font-size:20px">🚨</div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text-primary)">Reportar Falla de Equipo</div>
          <div style="font-size:12px;color:var(--text-secondary)">Notificación inmediata al equipo de mantenimiento</div>
        </div>
      </div>

      <form id="new-report-form">
        <!-- Plant Selector (Disabled for single-plant users, enabled for Ambas) -->
        <div class="form-group mb-16">
          <label class="form-label">Planta <span class="required">*</span></label>
          <select id="rpt-plant" class="form-select" onchange="onPlantChange(this.value)" ${userPlant !== 'ambas' ? 'disabled' : ''}>
            ${plants.map(p => `<option value="${p.id}" ${initialPlantId === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
        </div>

        <!-- Machine Selector -->
        <div class="form-group mb-16">
          <label class="form-label">Máquina / Equipo con Falla <span class="required">*</span></label>
          <select id="rpt-machine" class="form-select" required>
            <option value="">— Selecciona máquina —</option>
            ${machines.map(m => `<option value="${m.id}">${m.name} (${m.area})</option>`).join('')}
          </select>
        </div>

        <!-- Description -->
        <div class="form-group mb-16">
          <label class="form-label">Descripción de la Falla <span class="required">*</span></label>
          <textarea id="rpt-desc" class="form-textarea" rows="3"
            placeholder="Describe qué ocurrió, ruidos, fugas, códigos de error..." required></textarea>
        </div>

        <!-- Total Stop Switch -->
        <div class="switch-group mb-24">
          <div>
            <div class="switch-label">🛑 Paro Total de Producción</div>
            <div class="switch-sublabel">Marca si la máquina está 100% detenida y afecta el flujo</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="rpt-total-stop" checked>
            <span class="switch-slider"></span>
          </label>
        </div>

        <button type="submit" class="btn btn-primary btn-full btn-lg">
          🚨 Notificar Falla a Mantenimiento
        </button>
      </form>
    </div>
  </div>`;
}

function onPlantChange(plantId) {
  const machines = DB.Machines.getByPlant(plantId);
  const select = document.getElementById('rpt-machine');
  if (!select) return;
  select.innerHTML = '<option value="">— Selecciona máquina —</option>' +
    machines.map(m => `<option value="${m.id}">${m.name} (${m.area})</option>`).join('');
}

// Handle Form Submit with Instant Visual Feedback & Double-Click Prevention
document.addEventListener('submit', function(e) {
  if (e.target.id !== 'new-report-form') return;
  e.preventDefault();

  const user = Auth.currentUser;
  const plantId = document.getElementById('rpt-plant')?.value || user.plantId || 'plant-1';
  const machineId = document.getElementById('rpt-machine')?.value;
  const description = document.getElementById('rpt-desc')?.value.trim();
  const totalStop = document.getElementById('rpt-total-stop')?.checked || false;

  if (!machineId || !description) {
    NotifSystem.toast('error', 'Campos incompletos', 'Selecciona una máquina e ingresa la descripción.');
    return;
  }

  // Disable button immediately to prevent double submission
  const submitBtn = e.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.7';
    submitBtn.innerHTML = '⏳ Emitiendo reporte a mantenimiento...';
  }

  const report = DB.Reports.create({
    plantId,
    machineId,
    description,
    totalStop
  }, user);

  // Clear fields
  const descEl = document.getElementById('rpt-desc');
  if (descEl) descEl.value = '';
  const machEl = document.getElementById('rpt-machine');
  if (machEl) machEl.value = '';

  NotifSystem.toast('success', '¡Falla Reportada con Éxito!', `Folio ${report.id} emitido para ${report.machineName}.`, 5000);

  // Show immediate confirmation modal
  showReportSuccessModal(report);
});

function showReportSuccessModal(report) {
  const existing = document.getElementById('report-success-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'report-success-modal';
  modal.innerHTML = `
  <div class="modal" style="max-width:480px;text-align:center;padding:32px 24px">
    <div style="width:68px;height:68px;border-radius:50%;background:rgba(16,185,129,0.15);border:2px solid #10b981;display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto 16px;box-shadow:0 0 24px rgba(16,185,129,0.3)">
      ✅
    </div>

    <div style="font-size:20px;font-weight:900;color:var(--text-primary);margin-bottom:6px">
      ¡Reporte de Falla Emitido!
    </div>
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:20px">
      El equipo de mantenimiento ha recibido la alerta en tiempo real.
    </div>

    <div class="card" style="background:rgba(22,28,40,0.9);border:1px solid rgba(255,255,255,0.08);padding:16px;margin-bottom:24px;text-align:left">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:8px">
        <span style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Folio de Reporte:</span>
        <span style="font-size:15px;font-weight:900;color:var(--accent-blue);font-family:monospace">${report.id}</span>
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px">
        ⚙️ ${report.machineName}
      </div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">
        🏭 ${report.plantName} · 📍 ${report.area} · ⏱️ ${Utils.formatDateTime(report.t0)}
      </div>
      <div style="font-size:12px;color:var(--text-secondary);background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:6px;border-left:3px solid ${report.totalStop ? 'var(--accent-red)' : 'var(--accent-blue)'}">
        ${report.totalStop ? '<strong style="color:var(--accent-red)">🛑 Paro Total:</strong> ' : ''}${report.description}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <button class="btn btn-ghost" onclick="document.getElementById('report-success-modal').remove();App.renderSection('new-report')">
        ➕ Crear Otro
      </button>
      <button class="btn btn-primary" onclick="document.getElementById('report-success-modal').remove();App.navigate('my-reports')">
        📋 Ver Reportes
      </button>
    </div>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  App.updateSidebar();
}

// ---- MY REPORTS VIEW (Sup Operación) ------------------------
let opReportTab = 'plant'; // 'plant' | 'my'
let opSearchKw = '';

function renderMyReportsView() {
  const user = Auth.currentUser;
  const plantReports = DB.Reports.getByUserPlant(user);
  const myReports = plantReports.filter(r => r.createdBy === user.id || r.createdById === user.id || (r.createdByName && r.createdByName.toLowerCase() === user.name.toLowerCase()));

  const currentList = opReportTab === 'my' ? myReports : plantReports;
  const kw = (opSearchKw || '').toLowerCase().trim();
  const filtered = currentList.filter(r => {
    return !kw || [r.id, r.machineName, r.description, r.area, r.technicianName, r.createdByName]
      .some(f => (f || '').toLowerCase().includes(kw));
  }).sort((a, b) => new Date(b.t0) - new Date(a.t0));

  return `
  <div class="fade-in">
    <div class="mb-24" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div>
        <div class="page-title">📋 Reportes de Falla en Planta</div>
        <div class="page-sub">${Utils.getPlantDisplayName(user.plantId)} · ${plantReports.length} reporte(s) · ${myReports.length} creados por ti</div>
      </div>
      <button class="btn btn-primary" onclick="App.navigate('new-report')">➕ Reportar Nueva Falla</button>
    </div>

    <div class="tab-bar" style="margin-bottom:16px">
      <button class="tab-btn ${opReportTab === 'plant' ? 'active' : ''}" onclick="switchOpReportTab('plant')">
        🏭 Toda la Planta <span class="tab-count blue">${plantReports.length}</span>
      </button>
      <button class="tab-btn ${opReportTab === 'my' ? 'active' : ''}" onclick="switchOpReportTab('my')">
        👤 Creados por mí <span class="tab-count muted">${myReports.length}</span>
      </button>
    </div>

    <div class="filter-row mb-16">
      <div class="filter-search">
        <span class="filter-search-icon">🔍</span>
        <input type="text" class="form-input" id="op-search-kw"
          placeholder="Buscar reporte por máquina, falla, área, técnico..."
          value="${opSearchKw}"
          oninput="onOpSearch(this.value)">
      </div>
    </div>

    ${filtered.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">Sin reportes</div>
        <div class="empty-state-desc">${opSearchKw ? 'Ningún reporte coincide con la búsqueda.' : 'No hay fallas registradas en esta vista.'}</div>
      </div>` :
      `<div class="report-grid">
        ${filtered.map(r => renderReportCard(r)).join('')}
      </div>`
    }
  </div>`;
}

function switchOpReportTab(tab) {
  opReportTab = tab;
  App.renderSection('my-reports');
}

function onOpSearch(val) {
  opSearchKw = val;
  App.renderSection('my-reports');
}

window.switchOpReportTab = switchOpReportTab;
window.onOpSearch = onOpSearch;

// ---- TECHNICIAN VIEW (Open Queue & Active Repairs) ----------
function renderTechnicianView() {
  const user = Auth.currentUser;
  const allReports = DB.Reports.getByUserPlant(user);

  const unassignedReports = allReports.filter(r => r.status === 'open');
  const assignedReports   = user.role === 'tecnico'
    ? allReports.filter(r => r.status === 'working' && r.technicianId === user.id)
    : allReports.filter(r => r.status === 'working');

  // Ensure activeTab is valid (only 'unassigned' or 'assigned')
  if (!['unassigned', 'assigned'].includes(techState.activeTab)) {
    techState.activeTab = assignedReports.length > 0 ? 'assigned' : 'unassigned';
  }

  // Auto-switch to assigned tab if open queue is empty and active repairs exist
  if (unassignedReports.length === 0 && assignedReports.length > 0 && techState.activeTab === 'unassigned') {
    techState.activeTab = 'assigned';
  }

  function renderUnassigned() {
    if (unassignedReports.length === 0) {
      return `<div class="empty-state"><div class="empty-state-icon">✅</div>
        <div class="empty-state-title">Sin fallas pendientes en cola</div>
        <div class="empty-state-desc">No hay fallas sin asignar en tu planta. ${assignedReports.length > 0 ? `Hay <strong>${assignedReports.length}</strong> reparación(es) en proceso en la pestaña "En Proceso".` : ''}</div></div>`;
    }
    return unassignedReports.map(r => `
      <div class="report-card open" style="cursor:default;margin-bottom:12px">
        <div class="report-card-header">
          <div style="flex:1">
            <div class="report-id">${r.id} · ${Utils.formatDateTime(r.t0)}</div>
            <div class="report-title">${r.machineName}</div>
            <div class="report-desc">${r.description}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
            ${r.totalStop ? `<span class="total-stop">🛑 Paro Total</span>` : ''}
            <button class="btn btn-primary btn-sm" id="btn-claim-${r.id}" onclick="claimReport('${r.id}', event)">
              ▶ Tomar Reporte
            </button>
          </div>
        </div>
        <div class="report-meta">
          <div class="meta-item">🏭 <span>${r.plantName}</span></div>
          <div class="meta-item">📍 <span>${r.area}</span></div>
          <div class="meta-item">⏱️ <span>Sin atención hace ${Utils.timeSince(r.t0)}</span></div>
        </div>
      </div>
    `).join('');
  }

  function renderAssigned() {
    if (assignedReports.length === 0) {
      return `<div class="empty-state"><div class="empty-state-icon">📋</div>
        <div class="empty-state-title">Sin fallas en proceso</div>
        <div class="empty-state-desc">No hay mantenimientos activos en este momento. Selecciona una falla en "Sin Asignar" para comenzar.</div></div>`;
    }
    return assignedReports.map(r => renderReportCard(r, true)).join('');
  }

  let tabContent = techState.activeTab === 'assigned' ? renderAssigned() : renderUnassigned();

  const assignedTabTitle = user.role === 'tecnico' ? '🔧 Mis Reparaciones Activas' : '🔧 En Proceso';

  return `
  <div class="fade-in">
    <div class="config-header-wrap">
      <div class="config-icon-box">🔧</div>
      <div>
        <div class="config-title">Atención Técnica de Fallas</div>
        <div class="config-subtitle">${Utils.getPlantDisplayName(user.plantId)} · ${unassignedReports.length} falla(s) sin asignar · ${assignedReports.length} en reparación en proceso</div>
      </div>
    </div>

    <div class="tab-bar">
      <button class="tab-btn ${techState.activeTab === 'unassigned' ? 'active' : ''}" onclick="switchTechTab('unassigned')">
        📡 Sin Asignar
        ${unassignedReports.length > 0 ? `<span class="tab-count">${unassignedReports.length}</span>` : ''}
      </button>
      <button class="tab-btn ${techState.activeTab === 'assigned' ? 'active' : ''}" onclick="switchTechTab('assigned')">
        ${assignedTabTitle}
        ${assignedReports.length > 0 ? `<span class="tab-count blue">${assignedReports.length}</span>` : ''}
      </button>
    </div>

    <div id="tech-tab-content">
      ${tabContent}
    </div>
  </div>`;
}

function switchTechTab(tab) {
  techState.activeTab = tab;
  App.renderSection('tech-reports');
}

function claimReport(reportId, event) {
  if (event) {
    event.stopPropagation();
    const btn = event.currentTarget || event.target;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '⏳ Tomando...';
    }
  }

  const r = DB.Reports.getById(reportId);
  if (!r || r.status !== 'open') return;

  DB.Reports.claimReport(reportId, Auth.currentUser);
  techState.activeTab = 'assigned';
  techState.justClaimedId = reportId;

  NotifSystem.toast('success', '¡Reporte Asignado con Éxito!', `${r.machineName} (${r.id}) transferido a tus Reparaciones Activas.`, 3500);

  App.renderSection('tech-reports');
}

// ---- SUPERVISOR VIEW (Pending Sign-off) ---------------------
function renderSupervisorView() {
  const user = Auth.currentUser;
  const pendingSignReports = DB.Reports.getByUserPlant(user)
    .filter(r => r.status === 'pending')
    .sort((a, b) => new Date(b.t2 || b.t0) - new Date(a.t2 || a.t0));

  return `
  <div class="fade-in">
    <div class="config-header-wrap">
      <div class="config-icon-box">⏳</div>
      <div>
        <div class="config-title">Pendientes de Visto Bueno / Firma (T3)</div>
        <div class="config-subtitle">${Utils.getPlantDisplayName(user.plantId)} · ${pendingSignReports.length} reporte(s) en espera de visto bueno</div>
      </div>
    </div>

    ${pendingSignReports.length === 0 ? `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">Sin firmas pendientes</div>
        <div class="empty-state-desc">Todos los reportes técnicos han sido aprobados y liberados.</div>
      </div>` :
      `<div class="report-grid">
        ${pendingSignReports.map(r => renderReportCard(r, true)).join('')}
      </div>`
    }
  </div>`;
}

// ---- REPORT CARD HELPER -------------------------------------
function renderReportCard(r, showDetailBtn = true) {
  return `
  <div class="report-card ${Utils.getStatusClass(r.status)}" onclick="openReportDetail('${r.id}')">
    <div class="report-card-header">
      <div style="flex:1">
        <div class="report-id">${r.id} · ${Utils.formatDateTime(r.t0)}</div>
        <div class="report-title">${r.machineName}</div>
        <div class="report-desc">${r.description}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <span class="badge badge-${Utils.getStatusClass(r.status)}">${Utils.getStatusLabel(r.status)}</span>
        ${r.totalStop ? `<span class="total-stop">🛑 Paro Total</span>` : ''}
      </div>
    </div>

    <div class="report-meta">
      <div class="meta-item">🏭 <span>${r.plantName}</span></div>
      <div class="meta-item">📍 <span>${r.area}</span></div>
      ${r.technicianName ? `<div class="meta-item">🔧 <span>${r.technicianName}</span></div>` : ''}
      ${r.rootCause ? `<div class="meta-item" style="color:var(--accent-green)">🎯 <span>${r.rootCause}</span></div>` : ''}
    </div>
  </div>`;
}

// ---- REPORT DETAIL & MODAL (T0 - T3 Workflow) ----------------
function openReportDetail(reportId) {
  const r = DB.Reports.getById(reportId);
  if (!r) return;

  const user = Auth.currentUser;
  const canCloseIntervention = Auth.canCloseReport() && r.status === 'working' && (r.technicianId === user.id || user.role === 'admin' || user.role === 'sup_mtto');
  const canSign = Auth.canSignReport() && r.status === 'pending';

  const defaultT2Local = r.t2 ? new Date(r.t2).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16);

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'report-detail-modal';
  modal.innerHTML = `
  <div class="modal modal-lg">
    <div class="modal-header">
      <div style="display:flex;align-items:center;gap:10px">
        <span class="badge badge-${Utils.getStatusClass(r.status)}">${Utils.getStatusLabel(r.status)}</span>
        <div class="modal-title">${r.id} · ${r.machineName}</div>
      </div>
      <button class="modal-close" onclick="document.getElementById('report-detail-modal').remove()">✕</button>
    </div>

    <!-- Top Grid: Details (Left) + Timeline / Bitácora (Right) Side-by-Side -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:14px;margin-bottom:16px">
      <!-- Failure Info Card (Left) -->
      <div class="card" style="padding:16px;margin-bottom:0;display:flex;flex-direction:column;justify-content:space-between;background:var(--bg-card)">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <span style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">📋 Detalles de la Falla</span>
            ${r.totalStop ? `<span class="total-stop" style="font-size:11px;padding:2px 8px">🛑 Paro Total</span>` : ''}
          </div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);line-height:1.4">${r.description}</div>
        </div>
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border-color);display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--text-secondary)">
          <div>🏭 Planta: <strong style="color:var(--text-primary)">${r.plantName}</strong></div>
          <div>📍 Área: <strong style="color:var(--text-primary)">${r.area}</strong></div>
          <div>👤 Reportó: <strong style="color:var(--text-primary)">${r.createdByName}</strong></div>
          <div>⏱️ Hace: <strong style="color:var(--text-primary)">${Utils.timeSince(r.t0)}</strong></div>
        </div>
      </div>

      <!-- Timeline Progress Card (Right) -->
      <div class="card" style="padding:16px;background:var(--bg-secondary);margin-bottom:0">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:10px">
          ⏱️ Bitácora de Tiempos
        </div>
        <div class="timeline" style="margin-bottom:0">
          ${timelineItem('T0 · Falla Reportada', r.t0, r.createdByName, true, false)}
          ${timelineItem('T1 · Atención / Diagnóstico', r.t1, r.technicianName, !!r.t1, r.status === 'working')}
          ${timelineItem('T2 · Reparación Completada', r.t2, r.technicianName, !!r.t2, r.status === 'pending')}
          ${timelineItem('T3 · Liberación / Visto Bueno', r.t3, r.supervisorName, !!r.t3, false)}
        </div>
      </div>
    </div>

    <!-- Completed Intervention Info -->
    ${r.workDescription ? `
    <div class="card mb-16" style="padding:16px;background:rgba(47,129,247,.04);border-color:rgba(47,129,247,.2)">
      <div style="font-size:13px;font-weight:700;color:var(--accent-blue);margin-bottom:6px">🔧 Trabajo Realizado por Técnico:</div>
      <div style="font-size:14px;margin-bottom:8px">${r.workDescription}</div>
      ${r.rootCause ? `<div><strong style="color:var(--accent-green)">🎯 Causa Raíz:</strong> ${r.rootCause}</div>` : ''}
      ${r.materials ? `<div style="margin-top:4px"><strong style="color:var(--text-secondary)">📦 Materiales usados:</strong> ${r.materials}</div>` : ''}
    </div>` : ''}

    ${r.supervisorNotes ? `
    <div class="card mb-16" style="padding:16px;background:rgba(63,185,80,.04);border-color:rgba(63,185,80,.2)">
      <div style="font-size:13px;font-weight:700;color:var(--accent-green);margin-bottom:4px">✍️ Observaciones de Firma Supervisor (T3):</div>
      <div style="font-size:13px">${r.supervisorNotes}</div>
    </div>` : ''}

    <!-- FORM: Close Technician Intervention (T2 manual & 3-input Materials & Pending Activity) -->
    ${canCloseIntervention ? `
    <div class="divider"></div>
    <div class="card mb-16" style="padding:18px;border:1px solid var(--accent-blue)">
      <div style="font-size:15px;font-weight:800;color:var(--accent-blue);margin-bottom:12px">
        🛠️ Reporte de Intervención Técnica (T2)
      </div>

      <form id="tech-close-form">
        <div class="form-group">
          <label class="form-label">Descripción del Trabajo Realizado <span class="required">*</span></label>
          <textarea id="tc-work" class="form-textarea" rows="3" placeholder="Explica detalladamente qué acciones correctivas se ejecutaron..." required>${r.workDescription||''}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Análisis de Causa Raíz <span class="required">*</span></label>
          <textarea id="tc-rootcause" class="form-textarea" rows="2" placeholder="¿Por qué ocurrió la falla? Identifica el origen del problema..." required>${r.rootCause||''}</textarea>
        </div>

        <!-- Dynamic Multi-Item Materials Section -->
        <div class="form-group mb-16">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
            <label class="form-label" style="margin-bottom:0">📦 Materiales y Refacciones Utilizadas</label>
            <div style="display:flex;gap:8px">
              <button type="button" class="btn btn-secondary btn-sm" onclick="addInterventionMaterial('warehouse', '${r.plantId}')" style="font-size:11px;padding:5px 12px;border:1px solid rgba(59,130,246,0.35);background:rgba(59,130,246,0.08);color:#60a5fa;border-radius:8px">
                ➕ Agregar de Almacén
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="addInterventionMaterial('manual', '${r.plantId}')" style="font-size:11px;padding:5px 12px;border:1px solid rgba(245,158,11,0.35);background:rgba(245,158,11,0.08);color:#fbbf24;border-radius:8px">
                ➕ Agregar no Catalogado
              </button>
            </div>
          </div>

          <!-- Dynamic List Container -->
          <div id="intervention-materials-list" style="margin-bottom:10px"></div>

          <!-- Optional Notes -->
          <input type="text" id="tc-materials-notes" class="form-input" placeholder="Notas u observaciones adicionales sobre los materiales (opcional)..." value="${r.materials||''}">
        </div>

        <div class="form-group mb-16">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <label class="form-label" style="margin-bottom:0">⏱️ Hora Real de Entrega del Equipo (T2) <span class="required">*</span></label>
            <button type="button" class="btn btn-ghost btn-sm" onclick="setT2ToNow()" style="font-size:11px;padding:2px 8px;color:var(--accent-blue)">
              ⚡ Fijar Hora Actual
            </button>
          </div>
          <input type="text" id="tc-t2" class="form-input" placeholder="Seleccionar fecha y hora..." style="font-weight:700;font-size:14px;color:var(--text-primary);cursor:pointer" required>
          <div class="form-hint">Indica la fecha y hora exacta en que el equipo quedó reparado y entregado a producción.</div>
        </div>

        <!-- Checkbox Actividad Pendiente -->
        <div class="card mb-16" style="padding:14px;background:rgba(210,153,34,.08);border-color:rgba(210,153,34,.3)">
          <div class="switch-group mb-0">
            <div>
              <div class="switch-label">📌 Generar Actividad Pendiente</div>
              <div class="switch-sublabel">Marca si se hizo una reparación temporal y requiere una actividad de seguimiento o mantenimiento programado.</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="tc-has-pending" onchange="togglePendingActivityBox(this.checked)">
              <span class="switch-slider"></span>
            </label>
          </div>

          <div id="pending-activity-box" class="hidden mt-12">
            <div class="form-group">
              <label class="form-label">Descripción de la Actividad Pendiente <span class="required">*</span></label>
              <textarea id="tc-pending-desc" class="form-textarea" rows="2" placeholder="Ej: Reemplazar empaque definitivo y reajustar torque de cabezal"></textarea>
            </div>
            <div class="form-group mb-0">
              <label class="form-label">Prioridad Sugerida <span class="required">*</span></label>
              <select id="tc-pending-priority" class="form-select" style="font-weight:600">
                <option value="alta">🔴 Alta</option>
                <option value="media" selected>🟡 Media</option>
                <option value="baja">🔵 Baja</option>
              </select>
              <div class="form-hint">El Supervisor de Mantenimiento asignará la fecha programada y el técnico responsable.</div>
            </div>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-full btn-lg">
          ✅ Enviar a Visto Bueno del Supervisor
        </button>
      </form>
    </div>` : ''}

    <!-- FORM: Supervisor Signoff / Visto Bueno (T3) -->
    ${canSign ? `
    <div class="divider"></div>
    <div class="card" style="background:rgba(63,185,80,.06);border-color:rgba(63,185,80,.3);padding:20px">
      <div style="font-size:16px;font-weight:800;color:var(--accent-green);margin-bottom:8px">
        ✍️ Visto Bueno del Supervisor y Liberación (T3)
      </div>
      <div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
        Revisa la causa raíz y el trabajo realizado antes de otorgar el visto bueno para liberar la máquina <strong>${r.machineName}</strong> a producción.
      </div>
      <div class="form-group mb-16">
        <label class="form-label">Notas u Observaciones del Supervisor (opcional)</label>
        <textarea id="sup-sign-notes" class="form-textarea" rows="2" placeholder="Observaciones de visto bueno o seguimiento..."></textarea>
      </div>
      <button class="btn btn-success btn-full btn-lg" onclick="signReportForm('${r.id}')">
        ✅ Otorgar Visto Bueno y Liberar Máquina
      </button>
    </div>` : ''}
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  // Initialize Flatpickr for human-readable datetime
  if (typeof flatpickr !== 'undefined') {
    const t2El = modal.querySelector('#tc-t2');
    if (t2El) {
      flatpickr(t2El, {
        enableTime: true,
        dateFormat: 'Z',
        altInput: true,
        altInputClass: 'form-input',
        altFormat: 'd/m/Y   ·   h:i K',
        defaultDate: r.t2 ? new Date(r.t2) : new Date(),
        locale: (typeof flatpickr.l10ns !== 'undefined' && flatpickr.l10ns.es) ? flatpickr.l10ns.es : 'default',
        time_24hr: false
      });
    }
  }

  // Initialize materials list
  currentInterventionMaterials = [];
  renderInterventionMaterialsList(r.plantId);

  // Handle tech intervention submit
  modal.querySelector('#tech-close-form')?.addEventListener('submit', e => {
    e.preventDefault();

    try {
      let formattedMaterialsList = [];
      currentInterventionMaterials.forEach(m => {
        if (m.type === 'warehouse' && m.invItemId) {
          const inv = DB.Inventory.getById(m.invItemId);
          const qty = parseInt(m.quantity) || 1;
          if (inv) {
            formattedMaterialsList.push(`${qty} pza(s) · ${inv.name} (${inv.brand || 'N/A'} ${inv.model || ''}) [Almacén ${inv.id}]`);
            // Deduct from warehouse inventory
            DB.Inventory.adjustQuantity(m.invItemId, r.plantId, -qty, `Utilizado en reparación ${r.id} (${r.machineName})`, Auth.currentUser);
          }
        } else if (m.type === 'manual' && (m.name || m.model)) {
          const qty = parseInt(m.quantity) || 1;
          formattedMaterialsList.push(`${qty} pza(s) · ${m.name || 'Material'} ${m.model ? `(${m.model})` : ''}`);
        }
      });

      const freeText = document.getElementById('tc-materials-notes')?.value.trim() || '';
      if (freeText) {
        formattedMaterialsList.push(freeText);
      }
      const finalMaterials = formattedMaterialsList.join(' | ');

      const workVal = document.getElementById('tc-work')?.value.trim() || '';
      const rootVal = document.getElementById('tc-rootcause')?.value.trim() || '';
      const t2Val = document.getElementById('tc-t2')?.value || '';
      const hasPendingVal = document.getElementById('tc-has-pending')?.checked || false;
      const pendingDescVal = document.getElementById('tc-pending-desc')?.value.trim() || '';
      const pendingPrioVal = document.getElementById('tc-pending-priority')?.value || 'media';

      if (!workVal || !rootVal) {
        NotifSystem.toast('error', 'Campos requeridos', 'Ingresa la descripción del trabajo y la causa raíz.');
        return;
      }

      const data = {
        workDescription: workVal,
        rootCause: rootVal,
        materials: finalMaterials,
        t2: t2Val,
        hasPendingActivity: hasPendingVal,
        pendingDescription: pendingDescVal,
        pendingPriority: pendingPrioVal
      };

      DB.Reports.closeIntervention(reportId, data, Auth.currentUser);
      modal.remove();

      // Keep on active repairs tab
      techState.activeTab = 'assigned';

      NotifSystem.toast('success', 'Intervención Enviada', 'El reporte pasó a Visto Bueno del Supervisor.', 3500);

      // Force synchronous re-render of current section
      App.renderSection(App.currentSection || 'tech-reports');
      App.updateSidebar();
    } catch (err) {
      console.error('Error submitting intervention:', err);
      modal.remove();
      App.renderSection(App.currentSection || 'tech-reports');
      App.updateSidebar();
    }
  });
}

// ---- Dynamic Materials List State & Handlers ----
let currentInterventionMaterials = [];

function renderInterventionMaterialsList(plantId) {
  const container = document.getElementById('intervention-materials-list');
  if (!container) return;

  if (currentInterventionMaterials.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:14px;background:rgba(255,255,255,0.02);border:1px dashed var(--border-color);border-radius:8px;color:var(--text-muted);font-size:12px">
        ℹ️ No se han agregado refacciones (opcional si solo fue ajuste o calibración).
      </div>`;
    return;
  }

  const plantInventory = DB.Inventory.getByPlant(plantId) || [];
  const itemsToDisplay = (plantInventory && plantInventory.length > 0) ? plantInventory : DB.Inventory.getAll();

  container.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:8px">
    ${currentInterventionMaterials.map((mat, idx) => {
      if (mat.type === 'warehouse') {
        const selectedInv = DB.Inventory.getById(mat.invItemId);
        const stock = selectedInv ? DB.Inventory.getStockForPlant(selectedInv, plantId) : 0;
        const stockColor = stock > 0 ? 'var(--accent-green)' : 'var(--accent-red)';

        return `
        <div class="card" style="padding:10px 14px;background:rgba(22,28,40,0.9);border:1px solid rgba(255,255,255,0.08);border-left:3px solid var(--accent-blue);margin-bottom:0;border-radius:var(--radius-md)">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
            <span style="font-size:11px;font-weight:700;color:var(--accent-blue);display:flex;align-items:center;gap:4px">
              🏬 Refacción de Almacén #${idx + 1}
            </span>
            <button type="button" class="btn btn-ghost btn-sm" onclick="removeInterventionMaterial('${mat.id}', '${plantId}')" style="padding:1px 6px;color:var(--accent-red);font-size:11px" title="Eliminar este artículo">
              ✕ Quitar
            </button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 90px;gap:8px;align-items:center">
            <select class="form-select" style="font-size:12px;padding:8px 36px 8px 12px;border-radius:12px;background:var(--bg-tertiary);border:1px solid var(--border-color);color:var(--text-primary)" onchange="updateInterventionMaterial('${mat.id}', 'invItemId', this.value, '${plantId}')">
              <option value="">— Seleccionar artículo de almacén —</option>
              ${itemsToDisplay.map(item => {
                const itemStock = DB.Inventory.getStockForPlant(item, plantId);
                return `<option value="${item.id}" ${mat.invItemId === item.id ? 'selected' : ''}>
                  ${item.name} · ${item.brand || ''} ${item.model || ''} (Stock: ${itemStock} pzas)
                </option>`;
              }).join('')}
            </select>

            <input type="number" class="form-input" style="font-size:12px;padding:8px 12px;border-radius:12px;text-align:center" min="1" value="${mat.quantity || 1}"
              oninput="updateInterventionMaterial('${mat.id}', 'quantity', this.value, '${plantId}')"
              placeholder="Cant." title="Cantidad utilizada">
          </div>

          ${selectedInv ? `
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:6px;padding-top:4px;border-top:1px solid rgba(255,255,255,0.04)">
            <span>Marca: <strong>${selectedInv.brand || 'N/A'}</strong> · Modelo: <strong>${selectedInv.model || 'N/A'}</strong></span>
            <span>Stock disp: <strong style="color:${stockColor}">${stock} pzas</strong></span>
          </div>` : ''}
        </div>`;
      } else {
        // Manual entry
        return `
        <div class="card" style="padding:10px 14px;background:rgba(22,28,40,0.9);border:1px solid rgba(255,255,255,0.08);border-left:3px solid var(--accent-yellow);margin-bottom:0">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px">
            <span style="font-size:11px;font-weight:700;color:var(--accent-yellow);display:flex;align-items:center;gap:4px">
              ✏️ Material no Catalogado #${idx + 1}
            </span>
            <button type="button" class="btn btn-ghost btn-sm" onclick="removeInterventionMaterial('${mat.id}', '${plantId}')" style="padding:1px 6px;color:var(--accent-red);font-size:11px" title="Eliminar este artículo">
              ✕ Quitar
            </button>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr 90px;gap:8px;align-items:center">
            <input type="text" class="form-input" style="font-size:12px;padding:6px 10px" placeholder="Descripción / Nombre de la pieza" value="${mat.name || ''}"
              oninput="updateInterventionMaterial('${mat.id}', 'name', this.value, '${plantId}')">
            <input type="text" class="form-input" style="font-size:12px;padding:6px 10px" placeholder="Marca / N° Parte (opcional)" value="${mat.model || ''}"
              oninput="updateInterventionMaterial('${mat.id}', 'model', this.value, '${plantId}')">
            <input type="number" class="form-input" style="font-size:12px;padding:6px 10px" min="1" value="${mat.quantity || 1}"
              oninput="updateInterventionMaterial('${mat.id}', 'quantity', this.value, '${plantId}')"
              placeholder="Cant." title="Cantidad utilizada">
          </div>
        </div>`;
      }
    }).join('')}
  </div>`;
}

function addInterventionMaterial(type, plantId) {
  currentInterventionMaterials.push({
    id: 'mat-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    type: type,
    invItemId: '',
    name: '',
    brand: '',
    model: '',
    quantity: 1
  });
  renderInterventionMaterialsList(plantId);
}

function removeInterventionMaterial(id, plantId) {
  currentInterventionMaterials = currentInterventionMaterials.filter(m => m.id !== id);
  renderInterventionMaterialsList(plantId);
}

function updateInterventionMaterial(id, field, val, plantId) {
  const item = currentInterventionMaterials.find(m => m.id === id);
  if (item) {
    item[field] = val;
    if (field === 'invItemId') {
      const inv = DB.Inventory.getById(val);
      if (inv) {
        item.name = inv.name;
        item.brand = inv.brand;
        item.model = inv.model;
      }
      renderInterventionMaterialsList(plantId);
    }
  }
}

function togglePendingActivityBox(checked) {
  const box = document.getElementById('pending-activity-box');
  if (box) {
    if (checked) box.classList.remove('hidden');
    else box.classList.add('hidden');
  }
}

function signReportForm(reportId) {
  const notes = document.getElementById('sup-sign-notes')?.value.trim() || '';
  DB.Reports.signReport(reportId, notes, Auth.currentUser);
  document.getElementById('report-detail-modal')?.remove();
  NotifSystem.toast('success', 'Máquina Liberada', 'Visto Bueno registrado y equipo liberado.', 4000);
  const targetSection = App.currentSection || App.getDefaultSectionForRole(Auth.currentUser?.role);
  App.renderSection(targetSection);
  App.updateSidebar();
}

function timelineItem(label, timestamp, person, done, current) {
  const dotClass = done ? 'done' : current ? 'now' : 'pending';
  const icon = done ? '✓' : current ? '●' : '○';
  return `
  <div class="timeline-item">
    <div class="timeline-dot ${dotClass}">${icon}</div>
    <div class="timeline-title">${label}</div>
    ${timestamp ? `<div class="timeline-time">${Utils.formatDateTime(timestamp)}</div>` : ''}
    ${person ? `<div class="timeline-body">${person}</div>` : ''}
  </div>`;
}

function setT2ToNow() {
  const el = document.getElementById('tc-t2');
  if (el && el._flatpickr) {
    el._flatpickr.setDate(new Date(), true);
    NotifSystem.toast('info', 'Hora Actualizada', 'Se estableció la fecha y hora actual.', 2000);
  }
}

window.renderNewReportView = renderNewReportView;
window.renderMyReportsView = renderMyReportsView;
window.renderTechnicianView = renderTechnicianView;
window.renderSupervisorView = renderSupervisorView;
window.openReportDetail = openReportDetail;
window.switchTechTab = switchTechTab;
window.claimReport = claimReport;
window.togglePendingActivityBox = togglePendingActivityBox;
window.signReportForm = signReportForm;
window.onPlantChange = onPlantChange;
window.addInterventionMaterial = addInterventionMaterial;
window.removeInterventionMaterial = removeInterventionMaterial;
window.updateInterventionMaterial = updateInterventionMaterial;
window.renderInterventionMaterialsList = renderInterventionMaterialsList;
window.setT2ToNow = setT2ToNow;


