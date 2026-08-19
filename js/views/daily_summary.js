let dailyState = {
  selectedPlant: 'plant-2', // Default to Planta 2 as user specified
};

function renderDailySummaryView() {
  const plants = DB.Plants.getActive();
  const allMachines = DB.Machines.getActive();
  const allReports  = DB.Reports.getAll();
  const allTasks    = DB.PlannedTasks.getAll();
  const allReqs     = DB.Requisitions.getAll();

  // Filter entities by selected plant
  const machines = allMachines.filter(m => !dailyState.selectedPlant || m.plantId === dailyState.selectedPlant);

  // Calculate 6am - 6am window for "Today's Maintenance Shift"
  const now = new Date();
  const startShift = new Date(now);
  if (now.getHours() < 6) {
    startShift.setDate(startShift.getDate() - 1);
  }
  startShift.setHours(6, 0, 0, 0);

  const endShift = new Date(startShift);
  endShift.setDate(endShift.getDate() + 1);

  // Reports in this period
  const shiftReports = allReports.filter(r => {
    const d = new Date(r.faultTime || r.t0);
    const matchPeriod = d >= startShift && d < endShift;
    const matchPlant = !dailyState.selectedPlant || r.plantId === dailyState.selectedPlant;
    return matchPeriod && matchPlant;
  });

  const shiftClosed = shiftReports.filter(r => r.status === 'closed');
  const shiftOpen   = shiftReports.filter(r => ['open','read','working'].includes(r.status));
  const shiftTasks  = allTasks.filter(t => {
    const matchPeriod = new Date(t.createdAt) >= startShift && new Date(t.createdAt) < endShift;
    const matchPlant  = !dailyState.selectedPlant || t.plantId === dailyState.selectedPlant;
    return matchPeriod && matchPlant;
  });
  const shiftReqs   = allReqs.filter(r => {
    const matchPeriod = new Date(r.createdAt) >= startShift && new Date(r.createdAt) < endShift;
    const matchPlant  = !dailyState.selectedPlant || r.plantId === dailyState.selectedPlant;
    return matchPeriod && matchPlant;
  });

  // Calculate shift MTTR
  const mttrMs = shiftClosed.reduce((sum, r) => {
    if (r.t1 && r.t2) return sum + (new Date(r.t2) - new Date(r.t1));
    return sum;
  }, 0) / Math.max(shiftClosed.length, 1);

  const selectedPlantObj = plants.find(p => p.id === dailyState.selectedPlant);
  const plantLabel = selectedPlantObj ? selectedPlantObj.name : 'Todas las Plantas';

  return `
  <div class="fade-in">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:24px;flex-wrap:wrap">
      <div class="config-header-wrap" style="margin-bottom:0">
        <div class="config-icon-box">📊</div>
        <div>
          <div class="config-title">Resumen del Día de Mantenimiento · <span style="color:var(--accent-blue)">${plantLabel}</span></div>
          <div class="config-subtitle">Período: <strong>${Utils.formatDateTime(startShift.toISOString())}</strong> → <strong>${Utils.formatDateTime(endShift.toISOString())}</strong></div>
        </div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <select class="form-select" id="ds-plant" onchange="changeDailyPlant(this.value)" style="font-weight:600;min-width:160px">
          <option value="plant-2" ${dailyState.selectedPlant === 'plant-2' ? 'selected' : ''}>🏭 Planta 2 (Principal)</option>
          <option value="plant-1" ${dailyState.selectedPlant === 'plant-1' ? 'selected' : ''}>🏭 Planta 1</option>
          <option value="" ${!dailyState.selectedPlant ? 'selected' : ''}>🏭 Ambas Plantas</option>
        </select>
        <button class="btn btn-primary" onclick="window.print()">
          🖨️ Exportar PDF / Imprimir
        </button>
      </div>
    </div>

    <!-- SEMÁFORO BOARD -->
    <div class="mb-24">
      <div style="font-size:16px;font-weight:700;margin-bottom:12px">🚦 Tablero Semáforo de Máquinas — ${plantLabel}</div>
      <div class="semaforo-grid">
        ${machines.map(m => {
          const openReport = allReports.find(r => r.machineId === m.id && ['open','read','working'].includes(r.status));
          const pendingReport = allReports.find(r => r.machineId === m.id && r.status === 'pending');
          const hasTask = allTasks.some(t => t.machineId === m.id && t.status !== 'completado');
          const recurrence = DB.Reports.getRecurrence ? DB.Reports.getRecurrence(m.id, 30) : 0;

          let statusClass = 'status-ok';
          let statusDot = 'ok';
          let statusText = 'Operando Normal';

          if (openReport) {
            statusClass = 'status-repair';
            statusDot = 'repair';
            statusText = `🔴 En Reparación (${openReport.id})`;
          } else if (pendingReport) {
            statusClass = 'status-pending';
            statusDot = 'pending';
            statusText = `🟡 Pend. Firma (${pendingReport.id})`;
          } else if (hasTask) {
            statusClass = 'status-pending';
            statusDot = 'pending';
            statusText = '🟡 Con Paro Programado';
          }

          return `
          <div class="semaforo-card ${statusClass}">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div style="font-weight:700;font-size:14px">${m.name}</div>
              <span class="semaforo-status-dot ${statusDot}"></span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${m.area}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:6px;display:flex;align-items:center;justify-content:space-between">
              <span>${statusText}</span>
              ${recurrence >= 3 ? '<span style="color:var(--accent-red);font-weight:700">⚠️ Reincidente</span>' : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- SHIFT KPI SUMMARY -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px">
      <div class="card" style="padding:16px">
        <div class="form-label">Total Fallas del Día</div>
        <div style="font-size:28px;font-weight:800;color:var(--text-primary);margin:4px 0">${shiftReports.length}</div>
        <div style="font-size:11px;color:var(--text-muted)">${shiftOpen.length} abiertas · ${shiftClosed.length} cerradas</div>
      </div>

      <div class="card" style="padding:16px">
        <div class="form-label">MTTR Promedio (${plantLabel})</div>
        <div style="font-size:28px;font-weight:800;color:var(--accent-blue);margin:4px 0">${Utils.formatDuration(mttrMs)}</div>
        <div style="font-size:11px;color:var(--text-muted)">Tiempo medio de reparación</div>
      </div>

      <div class="card" style="padding:16px">
        <div class="form-label">Pendientes de Paro Generados</div>
        <div style="font-size:28px;font-weight:800;color:var(--accent-orange);margin:4px 0">${shiftTasks.length}</div>
        <div style="font-size:11px;color:var(--text-muted)">Para próximo mantenimiento</div>
      </div>

      <div class="card" style="padding:16px">
        <div class="form-label">Solicitudes de Compra</div>
        <div style="font-size:28px;font-weight:800;color:var(--accent-green);margin:4px 0">${shiftReqs.length}</div>
        <div style="font-size:11px;color:var(--text-muted)">Refacciones y herramienta</div>
      </div>
    </div>

    <!-- DETAIL REPORTS OF THE SHIFT -->
    <div class="card mb-24">
      <div class="card-header">
        <div class="card-title">📋 Fallas Ocurridas en este Día de Turno (${plantLabel})</div>
      </div>
      <div style="padding:16px">
        ${shiftReports.length === 0 ? `
          <div style="font-size:13px;color:var(--text-muted);text-align:center;padding:20px">
            🎉 No se registraron fallas durante este período en ${plantLabel}.
          </div>` :
          shiftReports.map(r => `
            <div class="report-card ${Utils.getStatusClass(r.status)}" style="margin-bottom:8px">
              <div class="report-card-header">
                <div>
                  <div class="report-id">${r.id} · ${Utils.formatDateTime(r.faultTime || r.t0)}</div>
                  <div class="report-title">${r.machineName} <span style="font-size:11px;font-weight:400;color:var(--text-muted)">(${r.faultType || 'Mecánica'})</span></div>
                  <div class="report-desc">${r.description}</div>
                </div>
                <span class="badge badge-${Utils.getStatusClass(r.status)}">${Utils.getStatusLabel(r.status)}</span>
              </div>
              ${r.workDescription ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:6px"><strong>Trabajo:</strong> ${r.workDescription}</div>` : ''}
              ${r.materials ? `<div style="font-size:12px;color:var(--accent-green);margin-top:2px"><strong>Materiales:</strong> ${r.materials}</div>` : ''}
            </div>
          `).join('')
        }
      </div>
    </div>
  </div>`;
}

function changeDailyPlant(plantId) {
  dailyState.selectedPlant = plantId;
  App.renderSection('daily-summary');
}

window.renderDailySummaryView = renderDailySummaryView;
window.changeDailyPlant = changeDailyPlant;

