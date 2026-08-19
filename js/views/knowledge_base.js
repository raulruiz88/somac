// ============================================================
// HISTORIAL & BASE DE CONOCIMIENTO (KNOWLEDGE BASE)
// ============================================================

let kbState = {
  search: '',
  plantFilter: '',
  machineFilter: '',
  statusFilter: '',
};

function renderKnowledgeBaseView() {
  const user = Auth.currentUser;
  const allReports = DB.Reports.getAll();

  // Plant scoping based on role
  let visibleReports = allReports;
  if (!['admin', 'planeador', 'programador', 'display'].includes(user.role) && user.plantId !== 'ambas') {
    visibleReports = allReports.filter(r => r.plantId === user.plantId);
  }

  const plants = DB.Plants.getActive();
  const machines = DB.Machines.getActive();

  // Apply search and dropdown filters
  const filtered = visibleReports.filter(r => {
    const kw = kbState.search.toLowerCase().trim();
    const matchKw = !kw || [
      r.id, r.machineName, r.description, r.workDescription,
      r.rootCause, r.materials, r.technicianName, r.supervisorName, r.area, r.plantName
    ].some(f => (f || '').toLowerCase().includes(kw));

    const matchPlant = !kbState.plantFilter || r.plantId === kbState.plantFilter;
    const matchMachine = !kbState.machineFilter || r.machineId === kbState.machineFilter;
    const matchStatus = !kbState.statusFilter || r.status === kbState.statusFilter;

    return matchKw && matchPlant && matchMachine && matchStatus;
  }).sort((a, b) => new Date(b.t0 || 0) - new Date(a.t0 || 0));

  return `
  <div class="fade-in">
    <div class="mb-24">
      <div class="config-header-wrap">
        <div class="config-icon-box">📚</div>
        <div>
          <div class="config-title">Historial de Fallas &amp; Base de Conocimiento</div>
          <div class="config-subtitle">Consulta fallas registradas, seguimiento en curso, causas raíz y trabajos realizados</div>
        </div>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="card mb-20" style="padding:16px;background:var(--bg-secondary);border:1px solid var(--border-color)">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
        <div style="flex:1;min-width:220px;position:relative">
          <input type="text" class="form-input" id="kb-search-input"
            placeholder="🔍 Buscar por palabra clave (falla, máquina, causa raíz, refacción)..."
            value="${kbState.search}"
            oninput="onKBSearch(this.value)">
        </div>

        <select class="form-select" id="kb-status-filter" style="width:auto;min-width:150px" onchange="onKBStatusChange(this.value)">
          <option value="">— Todos los Estados —</option>
          <option value="open" ${kbState.statusFilter === 'open' ? 'selected' : ''}>🔴 Abiertas</option>
          <option value="working" ${kbState.statusFilter === 'working' ? 'selected' : ''}>🔧 En Reparación</option>
          <option value="pending" ${kbState.statusFilter === 'pending' ? 'selected' : ''}>⏳ Pend. Firma</option>
          <option value="closed" ${kbState.statusFilter === 'closed' ? 'selected' : ''}>✅ Cerradas</option>
        </select>

        ${['admin', 'planeador', 'programador', 'display'].includes(user.role) || user.plantId === 'ambas' ? `
        <select class="form-select" id="kb-plant-filter" style="width:auto;min-width:140px" onchange="onKBPlantChange(this.value)">
          <option value="">— Todas las Plantas —</option>
          ${plants.map(p => `<option value="${p.id}" ${kbState.plantFilter === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
        </select>` : ''}

        <select class="form-select" id="kb-machine-filter" style="width:auto;min-width:170px" onchange="onKBMachineChange(this.value)">
          <option value="">— Todas las Máquinas —</option>
          ${machines.map(m => `<option value="${m.id}" ${kbState.machineFilter === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
        </select>
      </div>
    </div>

    <!-- Results Info -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font-size:13px;color:var(--text-secondary)">
      <div>Mostrando <strong>${filtered.length}</strong> registro(s) encontrado(s)</div>
    </div>

    <!-- Cards List -->
    <div style="display:flex;flex-direction:column;gap:12px">
      ${filtered.length === 0 ? `
        <div class="card" style="text-align:center;padding:40px 20px">
          <div style="font-size:36px;margin-bottom:8px">📖</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary)">No se encontraron registros</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Intenta con otro término de búsqueda o cambia los filtros</div>
        </div>` :
        filtered.map(r => {
          const mttrStr = (r.t1 && r.t2) ? Utils.formatDuration(new Date(r.t2) - new Date(r.t1)) : '—';
          const borderColors = {
            open: 'var(--accent-red)',
            working: 'var(--accent-yellow)',
            pending: 'var(--accent-blue)',
            closed: 'var(--accent-green)'
          };
          const borderC = borderColors[r.status] || 'var(--accent-blue)';

          return `
          <div class="card" style="padding:18px;border-left:4px solid ${borderC};cursor:pointer;transition:transform .1s, border-color .2s"
            onclick="openReportDetail('${r.id}')">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
              <div>
                <div style="font-size:11px;color:var(--text-muted);font-weight:700;letter-spacing:.05em">
                  ${r.id} · 🏭 ${r.plantName || r.plantId} · 📍 ${r.area || 'General'}
                </div>
                <div style="font-size:16px;font-weight:800;color:var(--text-primary);margin:2px 0">
                  ⚙️ ${r.machineName}
                </div>
              </div>
              <div style="text-align:right">
                <span class="badge badge-${Utils.getStatusClass(r.status)}" style="font-size:11px">
                  ${Utils.getStatusLabel(r.status)}
                </span>
                <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
                  📅 ${Utils.formatDateTime(r.t0)}
                </div>
              </div>
            </div>

            <!-- Failure Description -->
            <div style="background:var(--bg-tertiary);padding:10px 14px;border-radius:6px;margin-bottom:10px;font-size:13px;color:var(--text-secondary)">
              <strong style="color:var(--text-primary)">Falla Reportada:</strong> ${r.description}
            </div>

            <!-- Action & Root Cause (if working/pending/closed) -->
            ${r.workDescription || r.rootCause ? `
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:12px;margin-bottom:10px">
              <div style="background:rgba(47,129,247,.06);border:1px solid rgba(47,129,247,.2);padding:10px;border-radius:6px">
                <div style="font-weight:700;color:var(--accent-blue);margin-bottom:3px">🔧 Trabajo Realizado:</div>
                <div style="color:var(--text-primary)">${r.workDescription || 'En proceso de atención'}</div>
              </div>
              <div style="background:rgba(63,185,80,.06);border:1px solid rgba(63,185,80,.2);padding:10px;border-radius:6px">
                <div style="font-weight:700;color:var(--accent-green);margin-bottom:3px">🎯 Causa Raíz:</div>
                <div style="color:var(--text-primary)">${r.rootCause || 'En diagnóstico'}</div>
              </div>
            </div>` : ''}

            <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-muted);padding-top:8px;border-top:1px solid var(--border-color);flex-wrap:wrap;gap:8px">
              <div>
                ${r.technicianName ? `🔧 <strong>Técnico:</strong> ${r.technicianName}` : `👤 <strong>Reportó:</strong> ${r.createdByName || 'Operador'}`}
                ${r.materials ? ` · 📦 <strong>Refacciones:</strong> ${r.materials}` : ''}
              </div>
              <div>
                ${r.t1 && r.t2 ? `⚡ <strong>MTTR:</strong> <span style="color:var(--accent-blue);font-weight:700">${mttrStr}</span>` : `⏱️ <strong>Tiempo activo:</strong> ${Utils.timeSince(r.t0)}`}
              </div>
            </div>
          </div>`;
        }).join('')
      }
    </div>
  </div>`;
}

function onKBSearch(val) {
  kbState.search = val;
  App.renderSection('knowledge-base');
}

function onKBStatusChange(val) {
  kbState.statusFilter = val;
  App.renderSection('knowledge-base');
}

function onKBPlantChange(val) {
  kbState.plantFilter = val;
  App.renderSection('knowledge-base');
}

function onKBMachineChange(val) {
  kbState.machineFilter = val;
  App.renderSection('knowledge-base');
}

window.renderKnowledgeBaseView = renderKnowledgeBaseView;
window.onKBSearch = onKBSearch;
window.onKBStatusChange = onKBStatusChange;
window.onKBPlantChange = onKBPlantChange;
window.onKBMachineChange = onKBMachineChange;
