// ============================================================
// ACTIVIDADES PENDIENTES (MP) VIEW - SOMAC
// ============================================================

let pmState = {
  activeTab: 'pending',   // 'pending' | 'done' | 'all'
  filterMachine: '',
  filterKeyword: '',
};

function renderPMView() {
  const user = Auth.currentUser;
  const allTickets = DB.PMTickets.getByUserPlant(user);

  const pendingTickets = allTickets.filter(t => ['pendiente', 'en-revision'].includes(t.status));
  const doneTickets    = allTickets.filter(t => ['incorporado', 'cancelado'].includes(t.status));

  const machines = DB.Machines.getByPlant(user.plantId);
  const canCreate = ['planeador', 'sup_mtto', 'admin'].includes(user.role);

  function applyFilters(list) {
    return list.filter(item => {
      const kw = pmState.filterKeyword.toLowerCase();
      const matchMachine = !pmState.filterMachine || item.machineId === pmState.filterMachine;
      const matchKw = !kw || [
        item.id, item.machineName, item.activity, item.assignedTechNames?.join(' ')
      ].some(f => (f || '').toLowerCase().includes(kw));
      return matchKw && matchMachine;
    });
  }

  function renderFilters() {
    return `
    <div class="card mb-16" style="padding:12px;background:var(--bg-secondary);border:1px solid var(--border-color)">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:200px">
          <input type="text" class="form-input" id="pm-keyword"
            placeholder="🔍 Buscar actividad, máquina, técnico..."
            value="${pmState.filterKeyword}"
            oninput="applyPMFilters()">
        </div>
        <select class="form-select" id="pm-machine" onchange="applyPMFilters()" style="width:auto;min-width:180px">
          <option value="">— Todas las máquinas —</option>
          ${machines.map(m => `<option value="${m.id}" ${pmState.filterMachine === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>
      </div>
    </div>`;
  }

  function renderPendingTickets() {
    const filtered = applyFilters(pendingTickets).sort((a,b) => new Date(a.scheduledDate || a.createdAt) - new Date(b.scheduledDate || b.createdAt));
    if (filtered.length === 0) {
      return `<div class="empty-state"><div class="empty-state-icon">📝</div>
        <div class="empty-state-title">Sin actividades pendientes</div>
        <div class="empty-state-desc">No hay trabajos pendientes de mantenimiento preventivo.</div></div>`;
    }
    return `<div style="display:flex;flex-direction:column;gap:14px">` +
      filtered.map(t => renderPMTicketCard(t, false)).join('') +
      `</div>`;
  }

  function renderDoneTickets() {
    const filtered = applyFilters(doneTickets).sort((a,b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    if (filtered.length === 0) {
      return `<div class="empty-state"><div class="empty-state-icon">✅</div>
        <div class="empty-state-title">Sin historial completado</div>
        <div class="empty-state-desc">Aún no hay actividades cerradas.</div></div>`;
    }
    return `<div style="display:flex;flex-direction:column;gap:14px">` +
      filtered.map(t => renderPMTicketCard(t, true)).join('') +
      `</div>`;
  }

  let tabContent = pmState.activeTab === 'done' ? renderDoneTickets() : renderPendingTickets();

  return `
  <div class="fade-in">
    <div class="mb-24" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
      <div class="config-header-wrap" style="margin-bottom:0">
        <div class="config-icon-box">📌</div>
        <div>
          <div class="config-title">Actividades Pendientes (MP)</div>
          <div class="config-subtitle">${pendingTickets.length} actividad(es) pendiente(s) de atención</div>
        </div>
      </div>

      ${canCreate ? `
      <button class="btn btn-primary" onclick="openCreatePMTicketModal()">
        ➕ Nueva Actividad Pendiente
      </button>` : ''}
    </div>

    <div class="tab-bar">
      <button class="tab-btn ${pmState.activeTab === 'pending' ? 'active' : ''}" onclick="switchPMTab('pending')">
        ⏳ Por Atender
        ${pendingTickets.length > 0 ? `<span class="tab-count">${pendingTickets.length}</span>` : ''}
      </button>
      <button class="tab-btn ${pmState.activeTab === 'done' ? 'active' : ''}" onclick="switchPMTab('done')">
        ✅ Completadas
        ${doneTickets.length > 0 ? `<span class="tab-count muted">${doneTickets.length}</span>` : ''}
      </button>
    </div>

    ${renderFilters()}

    <div id="pm-tab-content">
      ${tabContent}
    </div>
  </div>`;
}

function renderPMTicketCard(t, isDone) {
  const user = Auth.currentUser;
  const canAssign = ['planeador', 'sup_mtto', 'admin'].includes(user.role);
  const statusLabels = {
    pendiente: 'Por Programar / Asignar 🟡',
    'en-revision': 'Programado / Asignado 🔵',
    incorporado: 'Completado ✅',
    cancelado: 'Cancelado 🔴'
  };

  const assignedTechStr = (t.assignedTechNames && t.assignedTechNames.length > 0)
    ? t.assignedTechNames.join(', ')
    : 'Sin técnicos asignados';

  const prio = t.priority || 'media';
  const prioLabels = { alta: '🔴 ALTA', media: '🟡 MEDIA', baja: '🔵 BAJA' };

  return `
  <div class="card" style="padding:18px 20px;border-left:4px solid ${t.status === 'incorporado' ? 'var(--accent-green)' : 'var(--accent-blue)'};margin-bottom:0">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div style="flex:1">
        <div style="font-size:11px;color:var(--text-muted);font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
          <span>${t.id}</span>
          <span>·</span>
          <span>🏭 ${t.plantName || 'Planta'}</span>
          <span>·</span>
          <span class="priority-badge ${prio}">${prioLabels[prio] || prio.toUpperCase()}</span>
          <span>·</span>
          <span>📅 Programado: <strong style="color:var(--text-primary)">${t.scheduledDate ? Utils.formatDate(t.scheduledDate) : 'Por definir por Supervisor'}</strong></span>
        </div>
        <div style="font-size:16px;font-weight:800;color:var(--text-primary);margin:4px 0">
          ⚙️ ${t.machineName}
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">
          <strong>Actividad:</strong> ${t.activity}
        </div>
        <div style="font-size:12px;color:var(--text-muted)">
          👥 <strong>Técnicos Asignados:</strong> <span style="color:var(--accent-blue);font-weight:600">${assignedTechStr}</span>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
        <span class="badge badge-${t.status === 'incorporado' ? 'closed' : 'working'}">
          ${statusLabels[t.status] || t.status}
        </span>

        ${canAssign && !isDone ? `
        <button class="btn btn-ghost btn-sm" onclick="openAssignTechModal('${t.id}')">
          📅 Programar y Asignar
        </button>` : ''}

        ${!isDone ? `
        <div style="display:flex;gap:6px;margin-top:4px">
          <button class="btn btn-success btn-sm" onclick="pmChangeStatus('${t.id}', 'incorporado')">
            ✅ Marcar Completada
          </button>
        </div>` : ''}
      </div>
    </div>
  </div>`;
}

function openCreatePMTicketModal() {
  const user = Auth.currentUser;
  const userPlant = user.plantId === 'ambas' ? null : user.plantId;
  const machines = userPlant ? DB.Machines.getByPlant(userPlant) : DB.Machines.getActive();
  const plantTechs = userPlant ? DB.Users.getByPlant(userPlant).filter(u => u.role === 'tecnico') : DB.Users.getAll().filter(u => u.role === 'tecnico');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'create-pm-modal';
  modal.innerHTML = `
  <div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">➕ Nueva Actividad de Mantenimiento Preventivo</div>
      <button class="modal-close" onclick="document.getElementById('create-pm-modal').remove()">✕</button>
    </div>

    <form id="create-pm-form">
      <div class="form-group mb-16">
        <label class="form-label">Equipo / Máquina <span class="required">*</span></label>
        <select id="pm-mch-sel" class="form-select" required>
          ${machines.map(m => `<option value="${m.id}">${m.name} (${m.plantName} · ${m.area})</option>`).join('')}
        </select>
      </div>

      <div class="form-group mb-16">
        <label class="form-label">Descripción de la Actividad <span class="required">*</span></label>
        <textarea id="pm-act-text" class="form-textarea" rows="3" placeholder="Describe la tarea de mantenimiento pendiente a ejecutar..." required></textarea>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group mb-16">
          <label class="form-label">Prioridad</label>
          <select id="pm-prio-sel" class="form-select">
            <option value="alta">🔴 Alta</option>
            <option value="media" selected>🟡 Media</option>
            <option value="baja">🔵 Baja</option>
          </select>
        </div>
        <div class="form-group mb-16">
          <label class="form-label">Fecha Programada</label>
          <input type="date" id="pm-date-sel" class="form-input" value="${Utils.getNextSunday()}">
        </div>
      </div>

      <div class="form-group mb-16">
        <label class="form-label">Asignar Técnico(s) de Mantenimiento</label>
        <div style="display:flex;flex-direction:column;gap:6px;max-height:140px;overflow-y:auto">
          ${plantTechs.length === 0 ? `<div style="font-size:12px;color:var(--text-muted)">Sin técnicos activos en la planta</div>` :
            plantTechs.map(tech => `
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;padding:6px;background:var(--bg-tertiary);border-radius:4px">
              <input type="checkbox" name="pm-tech-chk" value="${tech.id}">
              <span>${tech.name}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" onclick="document.getElementById('create-pm-modal').remove()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Crear Actividad</button>
      </div>
    </form>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#create-pm-form').addEventListener('submit', e => {
    e.preventDefault();
    const machineId = document.getElementById('pm-mch-sel').value;
    const m = DB.Machines.getById(machineId);

    const techChks = modal.querySelectorAll('input[name="pm-tech-chk"]:checked');
    const assignedTechIds = Array.from(techChks).map(c => c.value);
    const assignedTechNames = assignedTechIds.map(id => DB.Users.getById(id)?.name).filter(Boolean);

    const data = {
      machineId,
      machineName: m ? m.name : 'Equipo General',
      plantId: m ? m.plantId : user.plantId,
      plantName: m ? m.plantName : (user.plantId === 'plant-2' ? 'Planta 2' : 'Planta 1'),
      activity: document.getElementById('pm-act-text').value.trim(),
      priority: document.getElementById('pm-prio-sel').value,
      scheduledDate: document.getElementById('pm-date-sel').value,
      assignedTechIds,
      assignedTechNames,
      status: assignedTechIds.length > 0 ? 'en-revision' : 'pendiente'
    };

    DB.PMTickets.create(data, user);
    modal.remove();
    NotifSystem.toast('success', 'Actividad Creada', 'La actividad pendiente ha sido registrada.', 3000);
    App.renderSection('pm-tickets');
  });
}

function openAssignTechModal(ticketId) {
  const t = DB.PMTickets.getById(ticketId);
  if (!t) return;

  const plantTechs = DB.Users.getByPlant(t.plantId).filter(u => u.role === 'tecnico');
  const currentAssigned = t.assignedTechIds || [];

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'assign-tech-modal';
  modal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">👥 Programar y Asignar Actividad</div>
      <button class="modal-close" onclick="document.getElementById('assign-tech-modal').remove()">✕</button>
    </div>
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">
      Equipo: <strong>${t.machineName}</strong> (${t.plantName || 'la planta'})
    </div>

    <form id="assign-tech-form">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="form-group mb-0">
          <label class="form-label">Fecha Programada <span class="required">*</span></label>
          <input type="date" id="assign-pm-date" class="form-input" value="${t.scheduledDate || Utils.getNextSunday()}" required>
        </div>
        <div class="form-group mb-0">
          <label class="form-label">Nivel de Prioridad</label>
          <select id="assign-pm-prio" class="form-select">
            <option value="alta" ${t.priority === 'alta' ? 'selected' : ''}>🔴 Alta</option>
            <option value="media" ${t.priority === 'media' || !t.priority ? 'selected' : ''}>🟡 Media</option>
            <option value="baja" ${t.priority === 'baja' ? 'selected' : ''}>🔵 Baja</option>
          </select>
        </div>
      </div>

      <div class="form-group mb-16">
        <label class="form-label">Técnicos Disponibles</label>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${plantTechs.length === 0 ? `<div style="font-size:12px;color:var(--text-muted)">Sin técnicos activos en esta planta</div>` :
            plantTechs.map(tech => `
            <label class="switch-group" style="cursor:pointer;padding:8px 12px;background:var(--bg-tertiary);border-radius:6px">
              <div>
                <div style="font-size:13px;font-weight:600">${tech.name}</div>
                <div style="font-size:11px;color:var(--text-muted)">${tech.email || tech.username}</div>
              </div>
              <input type="checkbox" name="assign-tech-chk" value="${tech.id}" ${currentAssigned.includes(tech.id) ? 'checked' : ''}>
            </label>
          `).join('')}
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-full">
        💾 Guardar Programación y Asignación
      </button>
    </form>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#assign-tech-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const chks = modal.querySelectorAll('input[name="assign-tech-chk"]:checked');
    const selectedIds = Array.from(chks).map(c => c.value);
    const scheduledDate = document.getElementById('assign-pm-date')?.value || '';
    const priority = document.getElementById('assign-pm-prio')?.value || 'media';

    DB.PMTickets.assignTechnicians(ticketId, selectedIds, Auth.currentUser);
    db.update(DB_KEYS.PM_TICKETS, ts => (ts || []).map(t => t.id === ticketId ? { ...t, scheduledDate, priority } : t));

    modal.remove();
    NotifSystem.toast('success', 'Actividad Programada', 'Se guardó la fecha y la asignación técnica.', 3000);
    App.renderSection('pm-tickets');
  });
}

function switchPMTab(tab) {
  pmState.activeTab = tab;
  App.renderSection('pm-tickets');
}

function applyPMFilters() {
  pmState.filterKeyword = document.getElementById('pm-keyword')?.value || '';
  pmState.filterMachine = document.getElementById('pm-machine')?.value || '';
  App.renderSection('pm-tickets');
}

function pmChangeStatus(ticketId, newStatus) {
  DB.PMTickets.updateStatus(ticketId, newStatus, Auth.currentUser);
  NotifSystem.toast('success', 'Actividad Actualizada', `Estado: ${newStatus}`, 3000);
  App.renderSection('pm-tickets');
}

window.renderPMView = renderPMView;
window.switchPMTab = switchPMTab;
window.applyPMFilters = applyPMFilters;
window.pmChangeStatus = pmChangeStatus;
window.openAssignTechModal = openAssignTechModal;
window.openCreatePMTicketModal = openCreatePMTicketModal;
