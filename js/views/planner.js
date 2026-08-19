// ============================================================
// PLANNER DASHBOARD VIEW - Panel de Planeación y Refacciones
// ============================================================

let plannerState = {
  filterKeyword: '',
  filterMachine: '',
  filterPlant: 'plant-2', // Default to Planta 2 as user specified
};

function renderPlannerDashboard() {
  // Ensure seed data if empty
  if (DB.Requisitions.getAll().length === 0 && typeof seedDefaultRequisitions === 'function') {
    seedDefaultRequisitions();
  }

  const allReqs = DB.Requisitions.getAll();
  const now = new Date();

  // Plant filter helper
  const isMatchPlant = (r) => {
    if (!plannerState.filterPlant) return true;
    return r.plantId === plannerState.filterPlant || (DB.Machines.getById(r.machineId)?.plantId === plannerState.filterPlant);
  };

  const plantFilteredReqs = allReqs.filter(isMatchPlant);

  // Metrics
  const toProcessCount = plantFilteredReqs.filter(r => r.status === 'aprobada').length;
  const autoRestockCount = plantFilteredReqs.filter(r => r.isAutoRestock).length;
  const receivedThisMonthCount = plantFilteredReqs.filter(r => {
    if (r.status !== 'recibida') return false;
    const d = new Date(r.updatedAt || r.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Filter actionable items (requisitions needing Planeador attention or recently active)
  const actionableList = plantFilteredReqs.filter(r => {
    const kw = (plannerState.filterKeyword || '').toLowerCase().trim();
    const mach = plannerState.filterMachine;

    const matchKw = !kw || [
      r.id, r.item, r.machineName, r.reason, r.requestedByName, r.createdByName
    ].some(f => (f || '').toLowerCase().includes(kw));

    const matchMach = !mach || r.machineId === mach;

    return matchKw && matchMach;
  }).sort((a, b) => {
    // Sort priority: 'aprobada' first, then 'en_proceso', then rest
    const prio = { aprobada: 0, en_proceso: 1, pendiente_aprobacion: 2, recibida: 3, rechazada: 4 };
    const pA = prio[a.status] !== undefined ? prio[a.status] : 5;
    const pB = prio[b.status] !== undefined ? prio[b.status] : 5;
    if (pA !== pB) return pA - pB;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const machines = DB.Machines.getActive();
  const plants   = DB.Plants.getActive();

  return `
  <div class="fade-in">
    <div class="config-header-wrap">
      <div class="config-icon-box">📊</div>
      <div>
        <div class="config-title">Dashboard de Planeación y Refacciones</div>
        <div class="config-subtitle">Monitoreo de suministros, compras y abastecimiento de refacciones por planta</div>
      </div>
    </div>

    <!-- Metrics Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:16px;margin-bottom:28px">
      <!-- Metric 1: Por Procesar -->
      <div class="card" style="padding:20px;border-left:4px solid var(--accent-blue)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">
            Solicitudes por Procesar
          </span>
          <span style="font-size:20px">⏳</span>
        </div>
        <div style="font-size:32px;font-weight:800;color:var(--accent-blue)">${toProcessCount}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
          Aprobadas por supervisor esperando compra
        </div>
      </div>

      <!-- Metric 2: Restocks Automáticos -->
      <div class="card" style="padding:20px;border-left:4px solid var(--accent-purple)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">
            Restocks Automáticos
          </span>
          <span style="font-size:20px">🔄</span>
        </div>
        <div style="font-size:32px;font-weight:800;color:var(--accent-purple)">${autoRestockCount}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
          Solicitudes automáticas de reposición
        </div>
      </div>

      <!-- Metric 3: Recibidas este Mes -->
      <div class="card" style="padding:20px;border-left:4px solid var(--accent-green)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:12px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.05em">
            Recibidas este Mes
          </span>
          <span style="font-size:20px">📦</span>
        </div>
        <div style="font-size:32px;font-weight:800;color:var(--accent-green)">${receivedThisMonthCount}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
          Refacciones ingresadas al almacén este mes
        </div>
      </div>
    </div>

    <!-- Actionable List Section -->
    <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap">
      <div style="font-size:18px;font-weight:700;color:var(--text-primary)">
        📋 Solicitudes Requeridas para Planeación
      </div>
      <button class="btn btn-ghost btn-sm" onclick="App.navigate('requisitions')">
        Ver Todas en Solicitudes →
      </button>
    </div>

    <!-- Filters -->
    <div class="filter-row" style="margin-bottom:20px;gap:8px">
      <div class="filter-search">
        <span class="filter-search-icon">🔍</span>
        <input type="text" class="form-input" id="planner-filter-kw"
          placeholder="Filtrar por refacción, código, solicitante..."
          value="${plannerState.filterKeyword}"
          oninput="applyPlannerFilters()">
      </div>
      <select class="form-select" id="planner-filter-plant" onchange="applyPlannerFilters()" style="min-width:150px">
        <option value="plant-2" ${plannerState.filterPlant === 'plant-2' ? 'selected' : ''}>🏭 Planta 2 (Principal)</option>
        <option value="plant-1" ${plannerState.filterPlant === 'plant-1' ? 'selected' : ''}>🏭 Planta 1</option>
        <option value="" ${!plannerState.filterPlant ? 'selected' : ''}>🏭 Ambas Plantas</option>
      </select>
      <select class="form-select" id="planner-filter-mach" onchange="applyPlannerFilters()" style="min-width:180px">
        <option value="">— Todas las máquinas —</option>
        ${machines.map(m => `<option value="${m.id}" ${plannerState.filterMachine === m.id ? 'selected' : ''}>${m.name}</option>`).join('')}
      </select>
    </div>

    <!-- List -->
    <div id="planner-list-container">
      ${actionableList.length === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <div class="empty-state-title">Sin solicitudes pendientes</div>
          <div class="empty-state-desc">No hay solicitudes que requieran atención inmediata del planeador.</div>
        </div>
      ` : actionableList.map(r => renderPlannerCard(r)).join('')}
    </div>
  </div>`;
}

function renderPlannerCard(r) {
  const badgeMap = {
    pendiente_aprobacion: { bg: 'rgba(210,153,34,.15)', color: 'var(--accent-yellow)', label: 'Pendiente Aprobación' },
    aprobada:             { bg: 'rgba(47,129,247,.15)', color: 'var(--accent-blue)', label: 'Aprobada (Por Procesar)' },
    en_proceso:           { bg: 'rgba(247,129,102,.15)', color: 'var(--accent-orange)', label: 'En Proceso' },
    recibida:             { bg: 'rgba(63,185,80,.15)', color: 'var(--accent-green)', label: 'Recibida' },
    rechazada:            { bg: 'rgba(255,68,68,.15)', color: 'var(--accent-red)', label: 'Rechazada' }
  };
  const b = badgeMap[r.status] || badgeMap.pendiente_aprobacion;

  return `
  <div class="card mb-16" style="padding:16px;border-left:4px solid ${b.color}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">
          <span style="font-family:monospace;font-weight:700;font-size:13px;color:var(--accent-blue)">${r.id}</span>
          <span style="background:${b.bg};color:${b.color};font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px">
            ${b.label}
          </span>
          ${r.isAutoRestock ? `
            <span style="background:rgba(139,92,246,.15);color:var(--accent-purple);font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px">
              🔄 AUTO — Restock
            </span>
          ` : ''}
        </div>

        <div style="font-size:16px;font-weight:700;color:var(--text-primary)">
          ${r.item} <span style="color:var(--text-secondary);font-weight:400;font-size:14px">(x${r.quantity || 1})</span>
        </div>

        <div style="font-size:13px;color:var(--text-secondary);margin-top:4px">
          ⚙️ <strong>Máquina:</strong> ${r.machineName || 'General / Almacén'}
        </div>

        ${r.reason ? `
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
            💬 <em>Motivo:</em> ${r.reason}
          </div>
        ` : ''}

        <div style="font-size:11px;color:var(--text-muted);margin-top:8px">
          Solicitado por: <strong>${r.requestedByName || r.createdByName || 'Sistema'}</strong> · ${Utils.formatDateTime(r.createdAt)}
        </div>
      </div>

      <!-- Action Quick Buttons -->
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;flex-shrink:0">
        <div style="display:flex;gap:6px;margin-top:4px">
          ${r.status === 'aprobada' ? `
            <button class="btn btn-primary btn-sm" onclick="changeReqStatus('${r.id}', 'en_proceso')">
              ⚙️ En Proceso
            </button>
          ` : ''}

          ${['aprobada', 'en_proceso'].includes(r.status) ? `
            <button class="btn btn-success btn-sm" onclick="changeReqStatus('${r.id}', 'recibida')">
              📦 Recibido
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function applyPlannerFilters() {
  plannerState.filterKeyword = document.getElementById('planner-filter-kw')?.value || '';
  plannerState.filterMachine = document.getElementById('planner-filter-mach')?.value || '';
  plannerState.filterPlant   = document.getElementById('planner-filter-plant')?.value || '';
  App.renderSection(App.currentSection || 'planner-dashboard');
}

// Expose on window
window.renderPlannerDashboard = renderPlannerDashboard;
window.applyPlannerFilters = applyPlannerFilters;
