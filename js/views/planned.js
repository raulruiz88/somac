// ============================================================
// PLANNED TASKS VIEW - Pendientes de Paro Programado
// ============================================================

let plannedState = {
  activeTab: 'pendiente', // 'pendiente' | 'en-proceso' | 'completado'
  filterKeyword: '',
  filterMachine: '',
};

function seedDefaultPlannedTasks() {
  const defaultTasks = [
    {
      id: 'PARO-0001',
      machineId: 'mach-1',
      machineName: 'Compresor Atlas C-01',
      description: 'Mantenimiento integral a válvulas de admisión y alineación de poleas en paro programado',
      materials: 'Rodamiento SKF 6205 x4, Empaque térmico v2',
      priority: 'Alta',
      type: 'Preventivo',
      assignedTechId: 'user-tec1',
      assignedTechName: 'Carlos Técnico',
      scheduledDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      status: 'pendiente',
      createdAt: new Date(Date.now() - 3600000 * 12).toISOString()
    },
    {
      id: 'PARO-0002',
      machineId: 'mach-2',
      machineName: 'Prensa Hidráulica PH-200',
      description: 'Sustitución de mangueras de alta presión y calibración de presostato',
      materials: 'Manguera hidráulica 1/2" 250bar x2',
      priority: 'Media',
      type: 'Correctivo',
      assignedTechId: 'user-tec1',
      assignedTechName: 'Carlos Técnico',
      scheduledDate: new Date(Date.now() + 86400000 * 1).toISOString().split('T')[0],
      status: 'en-proceso',
      createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
    },
    {
      id: 'PARO-0003',
      machineId: 'mach-4',
      machineName: 'Extrusora EX-3000',
      description: 'Limpieza profunda de garganta de alimentación y prueba de torque',
      materials: 'Solvente desengrasante, Empaque retén',
      priority: 'Baja',
      type: 'Preventivo',
      assignedTechId: 'user-tec1',
      assignedTechName: 'Carlos Técnico',
      scheduledDate: new Date(Date.now() - 86400000 * 3).toISOString().split('T')[0],
      status: 'completado',
      createdAt: new Date(Date.now() - 3600000 * 72).toISOString()
    }
  ];
  DB.db.set(DB.DB_KEYS.PLANNED_TASKS, defaultTasks);
}

function getMachineRecurrence(machineId, machineName) {
  const reports = DB.Reports.getAll();
  const count = reports.filter(r => 
    (machineId && r.machineId === machineId) || 
    (machineName && r.machineName === machineName)
  ).length;
  return count;
}

function renderPlannedTasksView() {
  if (DB.PlannedTasks.getAll().length === 0) {
    seedDefaultPlannedTasks();
  }

  const allTasks = DB.PlannedTasks.getAll();

  const pendingTasks   = allTasks.filter(t => t.status === 'pendiente');
  const inProcessTasks = allTasks.filter(t => t.status === 'en-proceso');
  const completedTasks = allTasks.filter(t => t.status === 'completado');

  const filterList = (list) => {
    const kw = (plannedState.filterKeyword || '').toLowerCase().trim();
    const mach = plannedState.filterMachine;
    return list.filter(t => {
      const matchKw = !kw || [
        t.id, t.machineName, t.description, t.materials, t.assignedTechName, t.priority, t.type
      ].some(f => (f || '').toLowerCase().includes(kw));
      const matchMach = !mach || t.machineId === mach;
      return matchKw && matchMach;
    });
  };

  let activeList = [];
  if (plannedState.activeTab === 'en-proceso') activeList = filterList(inProcessTasks);
  else if (plannedState.activeTab === 'completado') activeList = filterList(completedTasks);
  else activeList = filterList(pendingTasks);

  const machines = DB.Machines.getActive();

  return `
  <div class="fade-in">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px;flex-wrap:wrap">
      <div class="config-header-wrap" style="margin-bottom:0">
        <div class="config-icon-box">📅</div>
        <div>
          <div class="config-title">Pendientes de Paro Programado</div>
          <div class="config-subtitle">Programación y seguimiento de mantenimiento en paros de planta</div>
        </div>
      </div>
      <button class="btn btn-primary" onclick="openNewPlannedTaskModal()">
        ➕ Crear Pendiente de Paro
      </button>
    </div>

    <div class="tab-bar">
      <button class="tab-btn ${plannedState.activeTab === 'pendiente' ? 'active' : ''}" onclick="switchPlannedTab('pendiente')">
        Pendientes <span class="tab-count yellow">${pendingTasks.length}</span>
      </button>
      <button class="tab-btn ${plannedState.activeTab === 'en-proceso' ? 'active' : ''}" onclick="switchPlannedTab('en-proceso')">
        En Proceso <span class="tab-count blue">${inProcessTasks.length}</span>
      </button>
      <button class="tab-btn ${plannedState.activeTab === 'completado' ? 'active' : ''}" onclick="switchPlannedTab('completado')">
        Completados <span class="tab-count green">${completedTasks.length}</span>
      </button>
    </div>

    <div class="filter-row" style="margin-bottom:20px">
      <div class="filter-search">
        <span class="filter-search-icon">🔍</span>
        <input type="text" class="form-input" id="pt-filter-kw"
          placeholder="Buscar máquina, descripción, refacción, técnico..."
          value="${plannedState.filterKeyword}"
          oninput="applyPlannedFilters()">
      </div>
      <select class="form-select" id="pt-filter-mach" onchange="applyPlannedFilters()" style="min-width:180px">
        <option value="">— Todas las máquinas —</option>
        ${machines.map(m => `<option value="${m.id}" ${plannedState.filterMachine === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
      </select>
    </div>

    <div id="planned-cards-container">
      ${activeList.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-title">Sin tareas registradas</div>
          <div class="empty-state-desc">No se encontraron pendientes de paro en esta sección.</div>
        </div>
      ` : activeList.map(t => renderPlannedTaskCard(t)).join('')}
    </div>
  </div>`;
}

function renderPlannedTaskCard(t) {
  const recurrenceCount = getMachineRecurrence(t.machineId, t.machineName);
  const isRecurrent = recurrenceCount >= 3;

  const prioMap = {
    alta:  { bg: 'rgba(255,68,68,.15)',  color: 'var(--accent-red)',    label: 'Alta' },
    media: { bg: 'rgba(210,153,34,.15)', color: 'var(--accent-yellow)', label: 'Media' },
    baja:  { bg: 'rgba(47,129,247,.15)', color: 'var(--accent-blue)',   label: 'Baja' }
  };
  const prioKey = (t.priority || 'media').toLowerCase();
  const pBadge = prioMap[prioKey] || prioMap.media;

  const typeMap = {
    correctivo: { bg: 'rgba(247,129,102,.15)', color: 'var(--accent-orange)', label: 'Correctivo' },
    preventivo: { bg: 'rgba(139,92,246,.15)',  color: 'var(--accent-purple)', label: 'Preventivo MP' }
  };
  const typeKey = (t.type || 'preventivo').toLowerCase();
  const tBadge = typeMap[typeKey] || typeMap.preventivo;

  let actionButtonsHTML = '';
  if (t.status === 'pendiente') {
    actionButtonsHTML = `
      <button class="btn btn-primary btn-sm" onclick="changeTaskStatus('${t.id}', 'en-proceso')">
        ▶ Iniciar Paro
      </button>
    `;
  } else if (t.status === 'en-proceso') {
    actionButtonsHTML = `
      <button class="btn btn-success btn-sm" onclick="changeTaskStatus('${t.id}', 'completado')">
        ✅ Completar
      </button>
    `;
  }

  return `
  <div class="card mb-16" style="padding:18px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="font-family:monospace;font-weight:700;font-size:13px;color:var(--accent-blue)">${t.id}</span>
          
          <!-- Priority Badge -->
          <span style="background:${pBadge.bg};color:${pBadge.color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px">
            Prioridad: ${pBadge.label}
          </span>
          
          <!-- Type Badge -->
          <span style="background:${tBadge.bg};color:${tBadge.color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px">
            ${tBadge.label}
          </span>

          <!-- Recurrence Warning Badge -->
          ${isRecurrent ? `
            <span style="background:rgba(247,129,102,.18);color:#f59e0b;border:1px solid rgba(245,158,11,.4);padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">
              ⚠️ Máquina Reincidente (${recurrenceCount} fallas)
            </span>
          ` : ''}
        </div>

        <div style="font-size:17px;font-weight:700;color:var(--text-primary)">
          ${t.machineName}
        </div>
        <div style="font-size:14px;color:var(--text-secondary);margin-top:6px;line-height:1.4">
          ${t.description}
        </div>

        ${t.materials ? `
          <div style="font-size:12px;color:var(--text-primary);margin-top:8px;background:rgba(255,255,255,.03);padding:8px 12px;border-radius:6px;border:1px solid var(--border-color)">
            🔧 <strong>Refacciones Necesarias:</strong> ${t.materials}
          </div>
        ` : ''}

        <div style="display:flex;align-items:center;gap:16px;margin-top:10px;font-size:12px;color:var(--text-muted);flex-wrap:wrap">
          <div>👤 <strong>Técnico:</strong> ${t.assignedTechName || t.assignedToName || 'Sin asignar'}</div>
          <div>📅 <strong>Fecha Programada:</strong> ${Utils.formatDate(t.scheduledDate || t.createdAt)}</div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px;flex-shrink:0">
        ${actionButtonsHTML}
      </div>
    </div>
  </div>`;
}

function switchPlannedTab(tab) {
  plannedState.activeTab = tab;
  App.renderSection('planned-tasks');
}

function applyPlannedFilters() {
  plannedState.filterKeyword = document.getElementById('pt-filter-kw')?.value || '';
  plannedState.filterMachine = document.getElementById('pt-filter-mach')?.value || '';
  App.renderSection('planned-tasks');
}

function openNewPlannedTaskModal() {
  const machines = DB.Machines.getActive();
  const techUsers = DB.Users.getByRole('tecnico');
  const todayStr = new Date().toISOString().split('T')[0];

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'new-planned-task-modal';
  modal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">➕ Crear Pendiente de Paro</div>
      <button class="modal-close" onclick="document.getElementById('new-planned-task-modal').remove()">✕</button>
    </div>

    <form id="new-planned-task-form">
      <div class="form-group">
        <label class="form-label">Máquina <span class="required">*</span></label>
        <select id="pt-machine" class="form-select" required>
          <option value="">— Seleccionar máquina —</option>
          ${machines.map(m => `<option value="${m.id}" data-name="${m.name}">${m.name} (${m.area})</option>`).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Descripción de la Tarea <span class="required">*</span></label>
        <textarea id="pt-desc" class="form-textarea" rows="3" placeholder="Detalla el trabajo a realizar durante el paro..." required></textarea>
      </div>

      <div class="form-group">
        <label class="form-label">Refacciones Necesarias</label>
        <input type="text" id="pt-materials" class="form-input" placeholder="Ej: Rodamiento SKF 6205, Aceite ISO VG68">
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Prioridad</label>
          <select id="pt-priority" class="form-select">
            <option value="Media">Media</option>
            <option value="Alta">Alta</option>
            <option value="Baja">Baja</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Tipo</label>
          <select id="pt-type" class="form-select">
            <option value="Preventivo">Preventivo MP</option>
            <option value="Correctivo">Correctivo</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Técnico Asignado</label>
          <select id="pt-tech" class="form-select">
            <option value="">— Asignar después —</option>
            ${techUsers.map(t => `<option value="${t.id}" data-name="${t.name}">${t.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Fecha Programada <span class="required">*</span></label>
          <input type="date" id="pt-date" class="form-input" value="${todayStr}" required>
        </div>
      </div>

      <button type="submit" class="btn btn-primary btn-full btn-lg" style="margin-top:8px">
        📌 Registrar Pendiente de Paro
      </button>
    </form>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#new-planned-task-form').addEventListener('submit', e => {
    e.preventDefault();
    const machSel = document.getElementById('pt-machine');
    const machineId = machSel.value;
    const machineOpt = machSel.options[machSel.selectedIndex];
    const machineName = machineOpt.dataset.name || machineOpt.text;
    const description = document.getElementById('pt-desc').value.trim();
    const materials = document.getElementById('pt-materials').value.trim();
    const priority = document.getElementById('pt-priority').value;
    const type = document.getElementById('pt-type').value;

    const techSel = document.getElementById('pt-tech');
    const assignedTechId = techSel.value;
    const techOpt = techSel.options[techSel.selectedIndex];
    const assignedTechName = assignedTechId ? (techOpt.dataset.name || techOpt.text) : 'Sin asignar';
    const scheduledDate = document.getElementById('pt-date').value;

    const user = Auth.currentUser || { id: 'user-admin', name: 'Administrador' };

    DB.PlannedTasks.create({
      machineId,
      machineName,
      description,
      materials,
      priority,
      type,
      assignedTechId,
      assignedTechName,
      assignedTo: assignedTechId,
      assignedToName: assignedTechName,
      scheduledDate
    }, user);

    modal.remove();
    NotifSystem.toast('success', 'Tarea Creada', `Pendiente de paro registrado para ${machineName}`, 3000);
    App.renderSection(App.currentSection || 'planned-tasks');
  });
}

function changeTaskStatus(id, newStatus) {
  const user = Auth.currentUser || { name: 'Usuario' };
  DB.PlannedTasks.updateStatus(id, newStatus, user);
  const statusLabels = {
    'pendiente': 'Pendiente',
    'en-proceso': 'En Proceso',
    'completado': 'Completado'
  };
  NotifSystem.toast('success', 'Estado Actualizado', `La tarea ${id} se movió a "${statusLabels[newStatus] || newStatus}".`, 3000);
  App.renderSection(App.currentSection || 'planned-tasks');
}

// Expose on window
window.renderPlannedTasksView = renderPlannedTasksView;
window.openNewPlannedTaskModal = openNewPlannedTaskModal;
window.changeTaskStatus = changeTaskStatus;
window.switchPlannedTab = switchPlannedTab;
window.applyPlannedFilters = applyPlannedFilters;
