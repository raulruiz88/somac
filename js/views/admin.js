// ============================================================
// ADMIN VIEWS - Dashboard, KPIs, Machine/Plant/User CRUD
// ============================================================

let adminDashState = {
  plantFilter: 'ambas', // 'plant-1' | 'plant-2' | 'ambas'
  period: 'semanal',    // 'diario' | 'semanal' | 'mensual'
  selectedWeeks: [29, 30, 31, 32, 33], // default 5 weeks
  selectedMonths: [0, 1, 2, 3, 4, 5, 6, 7], // default Jan-Aug
  weekDropdownOpen: false,
  monthDropdownOpen: false
};

function getEffectivePlantFilter(user = Auth.currentUser) {
  if (user && user.plantId && user.plantId !== 'ambas') {
    return user.plantId;
  }
  return adminDashState.plantFilter || 'ambas';
}

function getPlantDisplayName(plantId) {
  if (!plantId || plantId === 'ambas') return 'Ambas Plantas';
  if (plantId === 'plant-1') return 'Planta 1';
  if (plantId === 'plant-2') return 'Planta 2';
  const p = DB.Plants.getById(plantId);
  return p ? p.name : plantId;
}

function renderPlantSelector(user, currentFilter, extraStyle = '') {
  const plants = DB.Plants.getActive();
  if (user && user.plantId && user.plantId !== 'ambas') {
    const pName = getPlantDisplayName(user.plantId);
    return `
    <div style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:10px;font-size:12px;font-weight:700;color:var(--accent-blue)">
      🏭 ${pName}
    </div>`;
  }
  return `
  <select class="form-select" id="dash-plant-sel" onchange="onDashPlantChange(this.value)" style="width:auto;min-width:160px;${extraStyle}">
    <option value="ambas" ${currentFilter === 'ambas' ? 'selected' : ''}>🏭 Ambas Plantas</option>
    ${plants.map(p => `<option value="${p.id}" ${currentFilter === p.id ? 'selected' : ''}>🏭 ${p.name}</option>`).join('')}
  </select>`;
}

function toggleWeekDropdown(e) {
  if (e) e.stopPropagation();
  adminDashState.weekDropdownOpen = !adminDashState.weekDropdownOpen;
  adminDashState.monthDropdownOpen = false;
  const menu = document.getElementById('week-dropdown-menu');
  if (menu) {
    menu.style.display = adminDashState.weekDropdownOpen ? 'block' : 'none';
  }
}

function selectAllWeeks(selectAll = true) {
  const currentWeek = DB.Analytics._currentISOWeek();
  if (selectAll) {
    adminDashState.selectedWeeks = Array.from({length: currentWeek}, (_, i) => i + 1);
  } else {
    adminDashState.selectedWeeks = [currentWeek];
  }
  App.renderSection('admin-stats');
}

function onWeekCheckboxChange(wNum, isChecked) {
  wNum = parseInt(wNum, 10);
  if (isChecked) {
    if (!adminDashState.selectedWeeks.includes(wNum)) {
      adminDashState.selectedWeeks.push(wNum);
    }
  } else {
    if (adminDashState.selectedWeeks.length > 1) {
      adminDashState.selectedWeeks = adminDashState.selectedWeeks.filter(w => w !== wNum);
    }
  }
  App.renderSection('admin-stats');
}

function toggleMonthDropdown(e) {
  if (e) e.stopPropagation();
  adminDashState.monthDropdownOpen = !adminDashState.monthDropdownOpen;
  adminDashState.weekDropdownOpen = false;
  const menu = document.getElementById('month-dropdown-menu');
  if (menu) {
    menu.style.display = adminDashState.monthDropdownOpen ? 'block' : 'none';
  }
}

function selectAllMonths(selectAll = true) {
  const currentMonth = new Date().getMonth();
  if (selectAll) {
    adminDashState.selectedMonths = Array.from({length: currentMonth + 1}, (_, i) => i);
  } else {
    adminDashState.selectedMonths = [currentMonth];
  }
  App.renderSection('admin-stats');
}

function onMonthCheckboxChange(mIdx, isChecked) {
  mIdx = parseInt(mIdx, 10);
  if (isChecked) {
    if (!adminDashState.selectedMonths.includes(mIdx)) {
      adminDashState.selectedMonths.push(mIdx);
    }
  } else {
    if (adminDashState.selectedMonths.length > 1) {
      adminDashState.selectedMonths = adminDashState.selectedMonths.filter(m => m !== mIdx);
    }
  }
  App.renderSection('admin-stats');
}

// Global click handler to close dropdowns when clicking outside
if (!window._multiselectClickListenerAdded) {
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.multiselect-dropdown-wrap')) {
      const wMenu = document.getElementById('week-dropdown-menu');
      const mMenu = document.getElementById('month-dropdown-menu');
      if (wMenu) wMenu.style.display = 'none';
      if (mMenu) mMenu.style.display = 'none';
      if (typeof adminDashState !== 'undefined') {
        adminDashState.weekDropdownOpen = false;
        adminDashState.monthDropdownOpen = false;
      }
    }
  });
  window._multiselectClickListenerAdded = true;
}

window.toggleWeekDropdown = toggleWeekDropdown;
window.selectAllWeeks = selectAllWeeks;
window.onWeekCheckboxChange = onWeekCheckboxChange;
window.toggleMonthDropdown = toggleMonthDropdown;
window.selectAllMonths = selectAllMonths;
window.onMonthCheckboxChange = onMonthCheckboxChange;

// ---- SVG Line Chart Helper ----------------------------------
function renderSVGLineChart(options) {
  const { title, sub, dataPoints, color = '#3b82f6', height = 200, unit = 'm', annualAvg = null } = options;
  if (!dataPoints || dataPoints.length === 0) return '';

  const padding = { top: 36, bottom: 36, left: 10, right: 10 };
  const svgW = 520;
  const svgH = height;
  const chartW = svgW - padding.left - padding.right;
  const chartH = svgH - padding.top - padding.bottom;

  const rawValues = dataPoints.map(d => d.value);
  const allValues = annualAvg !== null ? [...rawValues, annualAvg] : rawValues;
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range  = Math.max(maxVal - minVal, 1);

  const toX = i  => padding.left + (i / Math.max(dataPoints.length - 1, 1)) * chartW;
  const toY = v  => padding.top  + chartH - ((v - minVal) / range) * chartH;

  const points = dataPoints.map((d, i) => ({ x: toX(i), y: toY(d.value), label: d.label, value: d.value }));
  const polylineStr = points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath    = `M ${points[0].x},${toY(minVal)} L ` +
    points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ') +
    ` L ${points[points.length - 1].x},${toY(minVal)} Z`;

  const gradId = 'grad-' + Math.random().toString(36).substr(2, 9);
  const avgY   = annualAvg !== null ? toY(annualAvg) : null;

  return `
  <div class="card chart-line-card" style="padding:18px 20px;background:rgba(22,28,40,0.75);border:1px solid rgba(255,255,255,0.08);border-top:1px solid rgba(255,255,255,0.14);display:flex;flex-direction:column;overflow:hidden">
    <div class="chart-header-row" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px">
      <div style="font-size:13px;font-weight:800;color:var(--text-primary);flex:1;min-width:0;line-height:1.3">${title}</div>
      ${annualAvg !== null ? `<span style="font-size:10px;font-weight:700;color:#f59e0b;background:rgba(245,158,11,0.12);padding:2px 8px;border-radius:10px;border:1px solid rgba(245,158,11,0.25);white-space:nowrap;flex-shrink:0">${annualAvg}${unit} prom.</span>` : ''}
    </div>
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">${sub}</div>

    <div style="position:relative;width:100%;overflow:hidden">
      <svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;height:auto;display:block" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>

        <!-- Grid Lines -->
        <line x1="${padding.left}" y1="${padding.top}" x2="${svgW - padding.right}" y2="${padding.top}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
        <line x1="${padding.left}" y1="${padding.top + chartH/2}" x2="${svgW - padding.right}" y2="${padding.top + chartH/2}" stroke="rgba(255,255,255,0.06)" stroke-dasharray="3,3" />
        <line x1="${padding.left}" y1="${toY(minVal)}" x2="${svgW - padding.right}" y2="${toY(minVal)}" stroke="rgba(255,255,255,0.1)" />

        <!-- Annual Average Dashed Line -->
        ${avgY !== null ? `<line x1="${padding.left}" y1="${avgY.toFixed(1)}" x2="${svgW - padding.right}" y2="${avgY.toFixed(1)}" stroke="#f59e0b" stroke-width="2" stroke-dasharray="6,4" opacity="0.85" />` : ''}

        <!-- Area Fill -->
        <path d="${areaPath}" fill="url(#${gradId})" />

        <!-- Main Trend Line -->
        <polyline fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${polylineStr}" />

        <!-- Data Dots & Labels -->
        ${points.map(p => `
          <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="${color}" stroke="#121721" stroke-width="2" />
          <text x="${p.x.toFixed(1)}" y="${Math.max(padding.top - 6, p.y - 10).toFixed(1)}" text-anchor="middle" fill="#e2e8f0" font-size="11" font-weight="700">${p.value}${unit}</text>
          <text x="${p.x.toFixed(1)}" y="${(svgH - 6).toFixed(1)}" text-anchor="middle" fill="#64748b" font-size="10" font-weight="600">${p.label}</text>
        `).join('')}
      </svg>
    </div>

    <!-- Chart Legend (inside card, below chart) -->
    <div class="chart-legend" style="margin-top:10px">
      <div class="legend-item"><div class="legend-line solid" style="background:${color}"></div> Periodo Seleccionado</div>
      ${annualAvg !== null ? `<div class="legend-item"><div class="legend-line dashed"></div> Promedio Anual Acumulado (${annualAvg}${unit})</div>` : ''}
    </div>
  </div>`;
}

// ---- Admin Dashboard ----------------------------------------
function renderAdminDashboard() {
  const user = Auth.currentUser;
  const plantFilter = getEffectivePlantFilter(user);
  const period = adminDashState.period;

  const plants = DB.Plants.getActive();
  const plantReports = DB.Reports.getByPlant(plantFilter);
  const periodReports = DB.Analytics.filterReportsByPeriod(plantReports, period);

  const mttr = DB.Analytics.getMTTR(periodReports);
  const mtbf = DB.Analytics.getMTBF(periodReports);

  const plantAvail = DB.Analytics.getAvailabilityByPlant(plantFilter, period);
  const availPct = plantAvail.availabilityPct;
  const availColor = availPct >= 95 ? 'var(--accent-green)' : availPct >= 85 ? 'var(--accent-yellow)' : 'var(--accent-red)';

  const topMachines = DB.Analytics.getTopDowntimeMachines(plantFilter, 3, period);
  const topRepetitive = DB.Analytics.getTopRepetitiveFailures(plantFilter, 3, period);
  const plantLabel = getPlantDisplayName(plantFilter);

  return `
  <div class="fade-in">

    <!-- Header & Plant Controls -->
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
      <div class="config-header-wrap" style="margin-bottom:0">
        <div class="config-icon-box">📊</div>
        <div>
          <div class="config-title">Dashboard Global Operacional</div>
          <div class="config-subtitle">Planta: ${plantLabel} · ${DB.Config.get().companyName || 'SOMAC'}</div>
        </div>
      </div>

      <!-- Controls: Plant Selector -->
      ${renderPlantSelector(user, plantFilter)}
    </div>

    <!-- THE BIG 3 HERO KPIS: MTTR, MTBF, DISPONIBILIDAD DE MÁQUINA -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:16px;margin-bottom:24px">

      <!-- Hero KPI 1: MTTR -->
      <div class="card" style="padding:20px;background:var(--bg-secondary);border:1px solid var(--border-color);border-top:4px solid var(--accent-blue)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">⚡ MTTR (T. Promedio Reparación)</span>
          <span style="font-size:18px">⏱️</span>
        </div>
        <div style="font-size:34px;font-weight:900;color:var(--accent-blue);line-height:1;margin-bottom:4px">
          ${Utils.formatDuration(mttr)}
        </div>
        <div style="font-size:11px;color:var(--text-secondary)">
          Tiempo promedio de respuesta e intervención
        </div>
      </div>

      <!-- Hero KPI 2: MTBF -->
      <div class="card" style="padding:20px;background:var(--bg-secondary);border:1px solid var(--border-color);border-top:4px solid var(--accent-purple)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">🔁 MTBF (T. Entre Fallas)</span>
          <span style="font-size:18px">🔄</span>
        </div>
        <div style="font-size:34px;font-weight:900;color:var(--accent-purple);line-height:1;margin-bottom:4px">
          ${mtbf ? Utils.formatDuration(mtbf) : '—'}
        </div>
        <div style="font-size:11px;color:var(--text-secondary)">
          Tiempo continuo de operación sin fallas
        </div>
      </div>

      <!-- Hero KPI 3: DISPONIBILIDAD -->
      <div class="card" style="padding:20px;background:var(--bg-secondary);border:1px solid var(--border-color);border-top:4px solid ${availColor}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:12px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">🏭 Disponibilidad de Máquina</span>
          <span style="font-size:18px">📊</span>
        </div>
        <div style="font-size:34px;font-weight:900;color:${availColor};line-height:1;margin-bottom:4px">
          ${availPct}%
        </div>
        <div style="font-size:11px;color:var(--text-secondary)">
          ${plantAvail.downtimeHours}h parado / ${plantAvail.availableHours}h programadas
        </div>
        <div style="width:100%;height:6px;background:var(--bg-tertiary);border-radius:3px;margin-top:8px;overflow:hidden">
          <div style="width:${availPct}%;height:100%;background:${availColor}"></div>
        </div>
      </div>

    </div>

    <!-- Main Content Grid: Failure Reports Table + Top Downtime Machines -->
    <div class="dashboard-main-grid">

      <!-- Active / Recent Failure Reports Table -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-color);display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:15px;font-weight:700">📋 Reporte de Fallas Activas y Recientes</div>
          <button class="btn btn-ghost btn-sm" onclick="App.navigate('admin-reports')">Ver todos →</button>
        </div>

        <div class="table-container" style="border:none">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Máquina</th>
                <th>Descripción Falla</th>
                <th>Estado</th>
                <th>Fecha T0</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              ${plantReports.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:30px">Sin fallas registradas</td></tr>` :
                plantReports.slice(0, 8).map(r => `
                <tr style="cursor:pointer" onclick="openReportDetail('${r.id}')">
                  <td style="font-family:monospace;font-weight:700">${r.id}</td>
                  <td style="font-weight:700">${r.machineName}</td>
                  <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.description}</td>
                  <td><span class="badge badge-${Utils.getStatusClass(r.status)}">${Utils.getStatusLabel(r.status)}</span></td>
                  <td style="font-size:11px">${Utils.formatDateTime(r.t0)}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openReportDetail('${r.id}')">Ver detalle</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Top 3 cards stacked -->
      <div style="display:flex;flex-direction:column;gap:12px">

        <!-- Top 3 Downtime Machines -->
        <div class="card" style="padding:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:6px">
            <span style="font-size:15px">⏱️</span> Top 3 · Mayor Tiempo de Paro
          </div>
          ${topMachines.length === 0 ? `
          <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px">Sin paros registrados</div>` :
          topMachines.map((m, idx) => `
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border-color)">
              <div style="width:22px;height:22px;border-radius:50%;background:${idx===0?'var(--accent-red)':idx===1?'var(--accent-orange)':'var(--bg-tertiary)'};color:${idx<2?'#fff':'var(--text-secondary)'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">
                ${idx + 1}
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name}</div>
                <div style="font-size:10px;color:var(--text-muted)">${m.failuresCount} falla(s) · ${m.availabilityPct}% disp.</div>
              </div>
              <div style="font-size:13px;font-weight:800;color:var(--accent-red);flex-shrink:0">${m.downtimeHours}h</div>
            </div>
          `).join('')}
        </div>

        <!-- Top 3 Repetitive Failures -->
        <div class="card" style="padding:16px">
          <div style="font-size:12px;font-weight:700;color:var(--text-primary);margin-bottom:12px;display:flex;align-items:center;gap:6px">
            <span style="font-size:15px">🔁</span> Top 3 · Falla Más Repetitiva
          </div>
          ${topRepetitive.length === 0 ? `
          <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:12px">Sin fallas registradas</div>` :
          topRepetitive.map((m, idx) => `
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border-color)">
              <div style="width:22px;height:22px;border-radius:50%;background:${idx===0?'#9b59b6':idx===1?'var(--accent-blue)':'var(--bg-tertiary)'};color:${idx<2?'#fff':'var(--text-secondary)'};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0">
                ${idx + 1}
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name}</div>
                <div style="font-size:10px;color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${m.lastDesc}">${m.lastDesc || '—'}</div>
              </div>
              <div style="font-size:13px;font-weight:800;color:#9b59b6;flex-shrink:0">${m.count}×</div>
            </div>
          `).join('')}
        </div>

      </div>

    </div>
  </div>`;
}

// ---- Admin KPIs View (renderAdminStats with Line Charts & Range Selector) ----
function renderAdminStats() {
  const user = Auth.currentUser;
  const plantFilter = getEffectivePlantFilter(user);
  const period = adminDashState.period;

  const plants = DB.Plants.getActive();
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthAbbrs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  const selectedWeeks = adminDashState.selectedWeeks || [33];
  const selectedMonths = adminDashState.selectedMonths || [0, 1, 2, 3, 4, 5, 6, 7];

  // Calculate Data Points dynamically for Line Charts based on period, plant & selection
  const mttrDataPoints = DB.Analytics.getTrendDataPoints('mttr', period, plantFilter, selectedWeeks, selectedMonths);
  const availDataPoints = DB.Analytics.getTrendDataPoints('avail', period, plantFilter, selectedWeeks, selectedMonths);

  // Annual Averages (YTD) for comparison line
  const mttrAnnualAvg = DB.Analytics.getAnnualAverage('mttr', plantFilter);
  const availAnnualAvg = DB.Analytics.getAnnualAverage('avail', plantFilter);
  const ytd = DB.Analytics.getYTD(plantFilter);

  const plantReports = DB.Reports.getByPlant(plantFilter);
  const periodReports = DB.Analytics.filterReportsByPeriod(plantReports, period);

  const mttr = DB.Analytics.getMTTR(periodReports);
  const mtbf = DB.Analytics.getMTBF(periodReports);

  const plantAvail = DB.Analytics.getAvailabilityByPlant(plantFilter, period);
  const availPct = plantAvail.availabilityPct;
  const availColor = availPct >= 95 ? 'var(--accent-green)' : availPct >= 85 ? 'var(--accent-yellow)' : 'var(--accent-red)';
  const machinesAvail = DB.Analytics.getAvailabilityByMachine(plantFilter, period);

  const currentISOWeek = DB.Analytics._currentISOWeek();
  const currentMonthIdx = new Date().getMonth();
  const plantLabel = getPlantDisplayName(plantFilter);

  return `
  <div class="fade-in kpi-stats-wrap" style="display:flex;flex-direction:column;min-height:100%">

    <!-- Header & Period Controls (Compact Layout) -->
    <div class="kpi-controls-row" style="margin-bottom:14px">
      <div class="config-header-wrap" style="margin-bottom:0">
        <div class="config-icon-box" style="width:36px;height:36px;font-size:18px">📈</div>
        <div>
          <div class="config-title" style="font-size:18px">KPIs Operacionales &amp; Tendencias</div>
          <div class="config-subtitle" style="font-size:11px">Planta: ${plantLabel} · Evolución de MTTR, MTBF y Disponibilidad</div>
        </div>
      </div>

      <!-- Controls: Plant Selector & Period Tabs -->
      <div class="kpi-controls-right" style="gap:10px">
        ${renderPlantSelector(user, plantFilter, 'padding:6px 10px;font-size:12px')}

        <div class="subtab-pill-bar" style="margin-bottom:0;padding:3px">
          <button class="subtab-pill ${period === 'diario' ? 'active' : ''}" onclick="onDashPeriodChange('diario')" style="padding:5px 12px;font-size:12px">Diario</button>
          <button class="subtab-pill ${period === 'semanal' ? 'active' : ''}" onclick="onDashPeriodChange('semanal')" style="padding:5px 12px;font-size:12px">Semanal</button>
          <button class="subtab-pill ${period === 'mensual' ? 'active' : ''}" onclick="onDashPeriodChange('mensual')" style="padding:5px 12px;font-size:12px">Mensual</button>
        </div>
      </div>
    </div>

    <!-- MULTI-SELECT DROPDOWN BAR (Compact Inline Bar) -->
    ${period === 'semanal' ? `
    <div style="position:relative;z-index:50;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding:8px 14px;background:rgba(17,24,39,0.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:700;color:var(--text-muted)">📅 Semanas a Graficar:</span>
        <div class="multiselect-dropdown-wrap" style="position:relative;z-index:60;display:inline-block">
          <button type="button" class="form-select" onclick="toggleWeekDropdown(event)" style="width:auto;min-width:220px;padding:4px 10px;font-size:12px;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(22,28,40,0.95);cursor:pointer;border-color:rgba(59,130,246,0.3)">
            <span style="font-weight:700;color:var(--text-primary)">
              ${selectedWeeks.length === currentISOWeek ? '✓ Todas las semanas (52)' : `📅 ${selectedWeeks.length} semana(s)`}
            </span>
            <span style="font-size:10px;opacity:0.7">▼</span>
          </button>
          <div id="week-dropdown-menu" style="display:${adminDashState.weekDropdownOpen ? 'block' : 'none'};position:absolute;top:calc(100% + 4px);left:0;z-index:99999 !important;min-width:260px;max-height:300px;overflow-y:auto;background:#161b28;border:1px solid rgba(255,255,255,0.18);border-radius:12px;padding:10px;box-shadow:0 20px 50px rgba(0,0,0,0.95);backdrop-filter:blur(32px)">
            <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08)">
              <button type="button" class="btn btn-primary btn-sm" onclick="selectAllWeeks(true)" style="font-size:10px;padding:3px 10px;background:linear-gradient(135deg, #2563eb, #6366f1);color:#fff;border:none">✓ Elegir todos</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="selectAllWeeks(false)" style="font-size:10px;padding:3px 8px;color:var(--text-muted)">Desmarcar</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:2px">
              ${Array.from({length: currentISOWeek}, (_, i) => currentISOWeek - i).map(wNum => {
                const isChecked = selectedWeeks.includes(wNum);
                return `
                <label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;user-select:none;font-size:12px;color:var(--text-primary)" onmouseover="this.style.background='rgba(59,130,246,0.12)'" onmouseout="this.style.background='transparent'">
                  <input type="checkbox" value="${wNum}" ${isChecked ? 'checked' : ''} onchange="onWeekCheckboxChange(this.value, this.checked)" style="width:14px;height:14px;accent-color:#3b82f6;cursor:pointer">
                  <span style="font-weight:${isChecked ? '700' : '400'}">Semana ${wNum}</span>
                  ${wNum === currentISOWeek ? '<span style="font-size:9px;color:var(--accent-green);font-weight:700;margin-left:auto">(Actual)</span>' : ''}
                </label>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted)">
        Graficando <strong style="color:var(--accent-blue)">${selectedWeeks.length}</strong> de ${currentISOWeek} semanas
      </div>
    </div>` : ''}

    <!-- MULTI-SELECT DROPDOWN BAR (Mensual) -->
    ${period === 'mensual' ? `
    <div style="position:relative;z-index:50;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding:8px 14px;background:rgba(17,24,39,0.85);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.08);border-radius:10px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:700;color:var(--text-muted)">🗓️ Meses a Graficar:</span>
        <div class="multiselect-dropdown-wrap" style="position:relative;z-index:60;display:inline-block">
          <button type="button" class="form-select" onclick="toggleMonthDropdown(event)" style="width:auto;min-width:220px;padding:4px 10px;font-size:12px;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px;background:rgba(22,28,40,0.95);cursor:pointer;border-color:rgba(59,130,246,0.3)">
            <span style="font-weight:700;color:var(--text-primary)">
              ${selectedMonths.length === (currentMonthIdx + 1) ? '✓ Todos los meses (YTD)' : `🗓️ ${selectedMonths.length} mes(es)`}
            </span>
            <span style="font-size:10px;opacity:0.7">▼</span>
          </button>
          <div id="month-dropdown-menu" style="display:${adminDashState.monthDropdownOpen ? 'block' : 'none'};position:absolute;top:calc(100% + 4px);left:0;z-index:99999 !important;min-width:260px;max-height:300px;overflow-y:auto;background:#161b28;border:1px solid rgba(255,255,255,0.18);border-radius:12px;padding:10px;box-shadow:0 20px 50px rgba(0,0,0,0.95);backdrop-filter:blur(32px)">
            <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.08)">
              <button type="button" class="btn btn-primary btn-sm" onclick="selectAllMonths(true)" style="font-size:10px;padding:3px 10px;background:linear-gradient(135deg, #2563eb, #6366f1);color:#fff;border:none">✓ Elegir todos</button>
              <button type="button" class="btn btn-ghost btn-sm" onclick="selectAllMonths(false)" style="font-size:10px;padding:3px 8px;color:var(--text-muted)">Desmarcar</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:2px">
              ${months.map((mName, idx) => {
                const isFuture = idx > currentMonthIdx;
                const isChecked = selectedMonths.includes(idx);
                if (isFuture) {
                  return `
                  <label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;opacity:0.3;cursor:not-allowed;font-size:12px;color:var(--text-muted)">
                    <input type="checkbox" disabled style="width:14px;height:14px">
                    <span>${mName} (Futuro)</span>
                  </label>`;
                }
                return `
                <label style="display:flex;align-items:center;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;user-select:none;font-size:12px;color:var(--text-primary)" onmouseover="this.style.background='rgba(59,130,246,0.12)'" onmouseout="this.style.background='transparent'">
                  <input type="checkbox" value="${idx}" ${isChecked ? 'checked' : ''} onchange="onMonthCheckboxChange(this.value, this.checked)" style="width:14px;height:14px;accent-color:#3b82f6;cursor:pointer">
                  <span style="font-weight:${isChecked ? '700' : '400'}">${mName}</span>
                  ${idx === currentMonthIdx ? '<span style="font-size:9px;color:var(--accent-green);font-weight:700;margin-left:auto">(Actual)</span>' : ''}
                </label>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>
      <div style="font-size:11px;color:var(--text-muted)">
        Graficando <strong style="color:var(--accent-blue)">${selectedMonths.length}</strong> de ${currentMonthIdx + 1} meses
      </div>
    </div>` : ''}

    <!-- UNIFIED SLEEK METRIC STRIP (4 Compact Cards) -->
    <div class="kpi-metric-strip" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px;margin-bottom:16px">

      <!-- Metric 1: MTTR -->
      <div class="card kpi-metric-card" style="padding:14px 18px;background:rgba(22, 28, 40, 0.85);border:1px solid rgba(255,255,255,0.08);border-top:3px solid var(--accent-blue)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">⚡ MTTR (Reparación)</span>
          <span style="font-size:14px">⏱️</span>
        </div>
        <div class="kpi-val-number" style="font-size:28px;font-weight:900;color:var(--accent-blue);line-height:1;margin:4px 0">
          ${Utils.formatDuration(mttr)}
        </div>
        <div style="font-size:11px;color:var(--text-muted)">
          Prom. Anual: <strong style="color:#f59e0b">${ytd.mttrMin}m</strong>
        </div>
      </div>

      <!-- Metric 2: MTBF -->
      <div class="card kpi-metric-card" style="padding:14px 18px;background:rgba(22, 28, 40, 0.85);border:1px solid rgba(255,255,255,0.08);border-top:3px solid var(--accent-purple)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">🔁 MTBF (Entre Fallas)</span>
          <span style="font-size:14px">🔄</span>
        </div>
        <div class="kpi-val-number" style="font-size:28px;font-weight:900;color:var(--accent-purple);line-height:1;margin:4px 0">
          ${mtbf ? Utils.formatDuration(mtbf) : '—'}
        </div>
        <div style="font-size:11px;color:var(--text-muted)">
          Operación continua sin fallas
        </div>
      </div>

      <!-- Metric 3: DISPONIBILIDAD -->
      <div class="card kpi-metric-card" style="padding:14px 18px;background:rgba(22, 28, 40, 0.85);border:1px solid rgba(255,255,255,0.08);border-top:3px solid ${availColor}">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">🏭 Disponibilidad Planta</span>
          <span style="font-size:14px">📊</span>
        </div>
        <div class="kpi-val-number" style="font-size:28px;font-weight:900;color:${availColor};line-height:1;margin:4px 0">
          ${availPct}%
        </div>
        <div style="font-size:11px;color:var(--text-muted)">
          ${plantAvail.downtimeHours}h paro / ${plantAvail.availableHours}h prog.
        </div>
      </div>

      <!-- Metric 4: ACUMULADO YTD -->
      <div class="card kpi-metric-card" style="padding:14px 18px;background:rgba(22, 28, 40, 0.85);border:1px solid rgba(255,255,255,0.08);border-top:3px solid #10b981">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">📅 Fallas YTD (2026)</span>
          <span style="font-size:14px">📋</span>
        </div>
        <div class="kpi-val-number" style="font-size:28px;font-weight:900;color:#10b981;line-height:1;margin:4px 0">
          ${ytd.totalFailures}
        </div>
        <div style="font-size:11px;color:var(--text-muted)">
          Disp. Anual Acum.: <strong style="color:var(--accent-green)">${ytd.availAvgPct}%</strong>
        </div>
      </div>

    </div>

    <!-- LINE CHARTS GRID (Front & Center Responsive) -->
    <div class="charts-grid-row kpi-charts-expand">
      ${renderSVGLineChart({
        title: '📈 Tendencia de MTTR (Tiempo de Reparación en Minutos)',
        sub: 'Evolución de intervención técnica vs promedio anual',
        dataPoints: mttrDataPoints,
        color: '#3b82f6',
        unit: 'm',
        annualAvg: mttrAnnualAvg
      })}

      ${renderSVGLineChart({
        title: '📉 Tendencia de Disponibilidad Operativa de Planta (%)',
        sub: 'Porcentaje de horas disponibles vs promedio anual',
        dataPoints: availDataPoints,
        color: '#10b981',
        unit: '%',
        annualAvg: availAnnualAvg
      })}
    </div>

  </div>`;
}

// ---- Render Machine Availability Bars Component (Spacious, Clear & Full Name) ----
function renderMachineAvailabilityBars(machinesAvail, period) {
  if (!machinesAvail || machinesAvail.length === 0) {
    return `<div style="text-align:center;padding:36px;color:var(--text-muted);font-size:13px;background:var(--bg-secondary);border-radius:12px">Sin máquinas registradas para este período o planta.</div>`;
  }

  return `
  <div class="machines-grid-3col" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(340px, 1fr));gap:18px;margin-top:16px">
    ${machinesAvail.map(m => {
      const pct = (typeof m.availabilityPct === 'number' && !isNaN(m.availabilityPct)) ? m.availabilityPct : 100;
      const downtimeH = (typeof m.downtimeHours === 'number' && !isNaN(m.downtimeHours)) ? m.downtimeHours : 0;
      const failures = (typeof m.failuresCount === 'number') ? m.failuresCount : 0;

      const color = pct >= 95 ? '#10b981' : pct >= 85 ? '#f59e0b' : '#ef4444';
      const gradient = pct >= 95
        ? 'linear-gradient(90deg, #10b981, #34d399)'
        : pct >= 85
        ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
        : 'linear-gradient(90deg, #ef4444, #f87171)';

      const statusLabel = pct >= 95 ? '🟢 Operativa' : pct >= 85 ? '🟡 Alerta' : '🔴 Crítica';
      const statusBg = pct >= 95 ? 'rgba(16,185,129,0.12)' : pct >= 85 ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';

      const safeName = (m.name || 'Máquina').replace(/'/g, "\\'");

      return `
      <div class="machine-bar-card" onclick="openMachineFailuresModal('${m.id}', '${safeName}', '${period}')"
        style="background:rgba(22, 28, 40, 0.9);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:18px 22px;cursor:pointer;transition:transform .15s, border-color .2s, box-shadow .2s;display:flex;flex-direction:column;gap:12px;position:relative"
        onmouseover="this.style.borderColor='rgba(59,130,246,0.6)';this.style.transform='translateY(-2px)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.4)'"
        onmouseout="this.style.borderColor='rgba(255,255,255,0.08)';this.style.transform='none';this.style.boxShadow='none'">
        
        <!-- Header: Full Machine Name & Large Percentage -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px">
          <div style="min-width:0;flex:1">
            <div class="machine-title-text" style="font-size:15px;font-weight:800;color:var(--text-primary);line-height:1.3;display:flex;align-items:center;gap:8px">
              <span>⚙️</span>
              <span>${m.name}</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:3px">
              🏭 ${m.plantName || 'Planta'} · 📍 ${m.area || 'General'}
            </div>
          </div>

          <div style="text-align:right;flex-shrink:0">
            <div class="machine-pct-text" style="font-size:22px;font-weight:900;color:${color};line-height:1">
              ${pct}%
            </div>
            <div style="font-size:10px;font-weight:700;color:${color};background:${statusBg};padding:2px 8px;border-radius:10px;margin-top:4px;display:inline-block">
              ${statusLabel}
            </div>
          </div>
        </div>

        <!-- High-Contrast Progress Bar -->
        <div class="machine-bar-track" style="width:100%;height:10px;background:rgba(255,255,255,0.08);border-radius:5px;overflow:hidden;position:relative">
          <div style="width:${pct}%;height:100%;background:${gradient};border-radius:5px;transition:width .6s cubic-bezier(0.4, 0, 0.2, 1)"></div>
        </div>

        <!-- Footer Stats: Downtime, Failures & Drill-down Hint -->
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--text-muted);padding-top:6px;border-top:1px solid rgba(255,255,255,0.06)">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="color:${downtimeH > 0 ? 'var(--accent-red)' : 'var(--text-muted)'};font-weight:${downtimeH > 0 ? '700' : '400'}">
              ⏱️ ${downtimeH}h paro (${period})
            </span>
            <span>·</span>
            <span style="color:${failures > 0 ? 'var(--accent-blue)' : 'var(--text-muted)'};font-weight:${failures > 0 ? '700' : '400'}">
              ⚠️ ${failures} falla(s)
            </span>
          </div>
          <span style="color:var(--accent-blue);font-weight:700;font-size:11px">
            Ver historial →
          </span>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ---- Dedicated View for Machine Availability (TV Tab 3 & Drilldown) ----
function renderMachineAvailView() {
  const user = Auth.currentUser;
  const plantFilter = getEffectivePlantFilter(user);
  const period = adminDashState.period;
  const plants = DB.Plants.getActive();
  const machinesAvail = DB.Analytics.getAvailabilityByMachine(plantFilter, period);
  const plantAvail = DB.Analytics.getAvailabilityByPlant(plantFilter, period);
  const availPct = plantAvail.availabilityPct;
  const availColor = availPct >= 95 ? '#10b981' : availPct >= 85 ? '#f59e0b' : '#ef4444';
  const plantLabel = getPlantDisplayName(plantFilter);

  return `
  <div class="fade-in machine-avail-view-wrap">
    <!-- Header & Controls -->
    <div class="kpi-controls-row" style="margin-bottom:16px">
      <div class="config-header-wrap" style="margin-bottom:0">
        <div class="config-icon-box" style="width:36px;height:36px;font-size:18px">🏭</div>
        <div>
          <div class="config-title" style="font-size:18px">Disponibilidad por Máquina Individual</div>
          <div class="config-subtitle" style="font-size:11px">Planta: ${plantLabel} · Monitoreo de horas efectivas y estado operativo</div>
        </div>
      </div>

      <div class="kpi-controls-right" style="gap:10px">
        ${renderPlantSelector(user, plantFilter, 'padding:6px 10px;font-size:12px')}

        <div class="subtab-pill-bar" style="margin-bottom:0;padding:3px">
          <button class="subtab-pill ${period === 'diario' ? 'active' : ''}" onclick="onDashPeriodChange('diario')" style="padding:5px 12px;font-size:12px">Diario</button>
          <button class="subtab-pill ${period === 'semanal' ? 'active' : ''}" onclick="onDashPeriodChange('semanal')" style="padding:5px 12px;font-size:12px">Semanal</button>
          <button class="subtab-pill ${period === 'mensual' ? 'active' : ''}" onclick="onDashPeriodChange('mensual')" style="padding:5px 12px;font-size:12px">Mensual</button>
        </div>
      </div>
    </div>

    <!-- Summary Banner -->
    <div class="card" style="padding:16px 20px;background:rgba(22, 28, 40, 0.85);border:1px solid rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;margin-bottom:18px">
      <div style="display:flex;align-items:center;gap:20px">
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Disponibilidad Global</div>
          <div style="font-size:26px;font-weight:900;color:${availColor};line-height:1;margin-top:3px">${availPct}%</div>
        </div>
        <div style="height:32px;width:1px;background:rgba(255,255,255,0.1)"></div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Tiempo Parado Total</div>
          <div style="font-size:22px;font-weight:800;color:var(--accent-red);line-height:1;margin-top:3px">${plantAvail.downtimeHours}h</div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-muted);background:rgba(255,255,255,0.03);padding:6px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.06)">
        💡 Haz clic en una máquina para ver su historial cronológico de fallas
      </div>
    </div>

    <!-- Bars Container -->
    ${renderMachineAvailabilityBars(machinesAvail, period)}
  </div>`;
}

// ---- Modal: Machine Failures History (Period Aware & Full History) ----
function openMachineFailuresModal(machineId, machineName, period = 'semanal') {
  const allReports = DB.Reports.getAll();
  const periodReports = DB.Analytics.filterReportsByPeriod(allReports, period);

  const machineAllReports = allReports
    .filter(r => r.machineId === machineId || r.machineName === machineName)
    .sort((a, b) => new Date(b.t0 || 0) - new Date(a.t0 || 0));

  const machinePeriodReports = periodReports
    .filter(r => r.machineId === machineId || r.machineName === machineName)
    .sort((a, b) => new Date(b.t0 || 0) - new Date(a.t0 || 0));

  const periodLabels = {
    diario: 'Hoy (Diario)',
    semanal: 'Esta Semana',
    mensual: 'Este Mes'
  };
  const activePeriodLabel = periodLabels[period] || period;

  const existing = document.getElementById('machine-failures-modal');
  if (existing) existing.remove();

  let modalTab = 'period'; // 'period' | 'all'

  function renderList(list) {
    if (list.length === 0) {
      return `
      <div class="empty-state" style="padding:32px 16px">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">Sin fallas en este período</div>
        <div class="empty-state-desc">No se registraron paros ni intervenciones para ${machineName} en el período seleccionado.</div>
      </div>`;
    }

    return `
    <div style="display:flex;flex-direction:column;gap:12px">
      ${list.map(r => {
        const mttrStr = (r.t1 && r.t2) ? Utils.formatDuration(new Date(r.t2) - new Date(r.t1)) : '—';
        const borderColors = {
          open: 'var(--accent-red)',
          working: 'var(--accent-yellow)',
          pending: 'var(--accent-blue)',
          closed: 'var(--accent-green)'
        };
        const borderC = borderColors[r.status] || 'var(--accent-blue)';
        const agoStr = r.t0 ? `Hace ${Utils.timeSince(r.t0)}` : '';

        return `
        <div class="card" style="padding:16px;border-left:4px solid ${borderC};background:rgba(22,28,40,0.85);margin-bottom:0;border-radius:10px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:8px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;font-size:11px;font-family:monospace;font-weight:700;color:var(--text-muted)">
                <span>${r.id}</span>
                <span>·</span>
                <span>📅 ${Utils.formatDateTime(r.t0)}</span>
                ${agoStr ? `<span style="color:var(--accent-blue);font-family:var(--font-family);font-weight:600">(${agoStr})</span>` : ''}
              </div>
              <div style="font-size:14px;font-weight:800;color:var(--text-primary);margin:4px 0">
                ${r.description}
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
              <span class="badge badge-${Utils.getStatusClass(r.status)}">${Utils.getStatusLabel(r.status)}</span>
              ${r.totalStop ? `<span class="total-stop" style="font-size:10px">🛑 Paro Total</span>` : ''}
            </div>
          </div>

          ${r.workDescription || r.rootCause ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px;margin:8px 0">
            <div style="background:var(--bg-tertiary);padding:8px 10px;border-radius:6px">
              <div style="font-weight:700;color:var(--accent-blue);margin-bottom:2px">🔧 Trabajo Realizado:</div>
              <div style="color:var(--text-primary)">${r.workDescription || 'En proceso'}</div>
            </div>
            <div style="background:var(--bg-tertiary);padding:8px 10px;border-radius:6px">
              <div style="font-weight:700;color:var(--accent-green);margin-bottom:2px">🎯 Causa Raíz:</div>
              <div style="color:var(--text-primary)">${r.rootCause || 'No especificada'}</div>
            </div>
          </div>` : ''}

          <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;color:var(--text-muted);padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;gap:6px">
            <div>
              👤 <strong>Técnico:</strong> ${r.technicianName || r.createdByName || '—'}
              ${r.materials ? ` · 📦 <strong>Refacciones:</strong> ${r.materials}` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:12px">
              <div>⚡ <strong>MTTR:</strong> <span style="color:var(--accent-blue);font-weight:700">${mttrStr}</span></div>
              <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();openReportDetail('${r.id}')" style="font-size:11px;padding:2px 8px">Ver Detalle Completo →</button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'machine-failures-modal';

  function updateModalBody() {
    const listToRender = modalTab === 'period' ? machinePeriodReports : machineAllReports;
    modal.querySelector('#modal-failures-content').innerHTML = renderList(listToRender);

    const btnPeriod = modal.querySelector('#tab-period-btn');
    const btnAll = modal.querySelector('#tab-all-btn');
    if (btnPeriod && btnAll) {
      if (modalTab === 'period') {
        btnPeriod.className = 'subtab-pill active';
        btnAll.className = 'subtab-pill';
      } else {
        btnPeriod.className = 'subtab-pill';
        btnAll.className = 'subtab-pill active';
      }
    }
  }

  modal.innerHTML = `
  <div class="modal modal-lg" style="max-width:760px">
    <div class="modal-header" style="flex-wrap:wrap;gap:10px">
      <div>
        <div class="modal-title">⚙️ Historial de Fallas: ${machineName}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">
          ${machinePeriodReports.length} falla(s) en ${activePeriodLabel} · ${machineAllReports.length} fallas históricas totales
        </div>
      </div>
      <button class="modal-close" onclick="document.getElementById('machine-failures-modal').remove()">✕</button>
    </div>

    <!-- Period Filter Switch inside modal -->
    <div style="padding:12px 20px 0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06);padding-bottom:12px">
      <div class="subtab-pill-bar" style="margin-bottom:0;padding:3px">
        <button id="tab-period-btn" class="subtab-pill active" style="padding:4px 12px;font-size:12px">
          📅 ${activePeriodLabel} (${machinePeriodReports.length})
        </button>
        <button id="tab-all-btn" class="subtab-pill" style="padding:4px 12px;font-size:12px">
          📚 Todo el Historial (${machineAllReports.length})
        </button>
      </div>
      <div style="font-size:11px;color:var(--text-muted)">
        Ordenado de más reciente a más antigua
      </div>
    </div>

    <div id="modal-failures-content" style="padding:16px 20px;max-height:60vh;overflow-y:auto">
      ${renderList(machinePeriodReports)}
    </div>

    <div class="modal-footer">
      <button class="btn btn-primary" onclick="document.getElementById('machine-failures-modal').remove()">Cerrar</button>
    </div>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#tab-period-btn').addEventListener('click', () => {
    modalTab = 'period';
    updateModalBody();
  });
  modal.querySelector('#tab-all-btn').addEventListener('click', () => {
    modalTab = 'all';
    updateModalBody();
  });
}

function onDashPlantChange(val) {
  adminDashState.plantFilter = val;
  App.renderSection(App.currentSection);
}

function onDashPeriodChange(val) {
  adminDashState.period = val;
  App.renderSection(App.currentSection);
}

// Modal drill-down Machine Availability breakdown
function openAvailabilityDrillDownModal(plantId, period) {
  const machinesAvail = DB.Analytics.getAvailabilityByMachine(plantId, period);
  const plantObj = DB.Plants.getById(plantId);
  const plantName = plantObj ? plantObj.name : 'Todas las Plantas';

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'avail-modal';
  modal.innerHTML = `
  <div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">🏭 Disponibilidad por Máquina — ${plantName} (${period.toUpperCase()})</div>
      <button class="modal-close" onclick="document.getElementById('avail-modal').remove()">✕</button>
    </div>

    <div class="table-container mb-16">
      <table>
        <thead>
          <tr>
            <th>Máquina</th>
            <th>Planta</th>
            <th>Área</th>
            <th>Horas Programadas</th>
            <th>Tiempo Parado</th>
            <th>% Disponibilidad</th>
            <th>Fallas</th>
          </tr>
        </thead>
        <tbody>
          ${machinesAvail.map(m => {
            const color = m.availabilityPct >= 95 ? 'var(--accent-green)' : m.availabilityPct >= 85 ? 'var(--accent-yellow)' : 'var(--accent-red)';
            return `
            <tr>
              <td style="font-weight:700">${m.name}</td>
              <td style="font-size:12px">${m.plantName}</td>
              <td style="font-size:12px">${m.area}</td>
              <td style="font-size:12px">${m.availableHours}h (${m.hoursPerDay}h/día)</td>
              <td style="font-size:12px;font-weight:700;color:var(--accent-red)">${m.downtimeHours}h</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <strong style="color:${color}">${m.availabilityPct}%</strong>
                  <div style="flex:1;max-width:80px;height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden">
                    <div style="width:${m.availabilityPct}%;height:100%;background:${color}"></div>
                  </div>
                </div>
              </td>
              <td style="font-size:12px;font-weight:700">${m.failuresCount}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ---- Export Master Database (ONLY 1 PROFESSIONAL BUTTON IN CONFIG) ----
function exportAllReports() {
  const reports = DB.Reports.getAll();
  if (!reports || reports.length === 0) {
    NotifSystem.toast('warning', 'Sin reportes', 'Aún no hay reportes registrados para exportar.');
    return;
  }
  Exporter.exportCSV(reports, 'somac_base_de_datos');
  NotifSystem.toast('success', 'Exportación Exitosa', `Respaldo descargado (${reports.length} registros).`, 4000);
}

// ---- Admin Reports Table ------------------------------------
let reportsTableState = { search: '', status: '', plant: '', sort: 'newest' };

function renderAdminReportsTable() {
  const user = Auth.currentUser;
  const plants = DB.Plants.getActive();
  const isMultiPlant = !user || !user.plantId || user.plantId === 'ambas';
  const effectivePlant = getEffectivePlantFilter(user);

  return `
  <div class="fade-in">
    <div class="mb-24">
      <div class="config-header-wrap">
        <div class="config-icon-box">📋</div>
        <div>
          <div class="config-title">Todos los Reportes de Falla</div>
          <div class="config-subtitle">Planta: ${getPlantDisplayName(effectivePlant)} · Gestión global y consulta de reportes</div>
        </div>
      </div>
    </div>

    <div class="card mb-16" style="padding:12px;background:var(--bg-secondary)">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <input type="text" id="rpt-search" class="form-input" placeholder="🔍 Buscar por ID, máquina, técnico..."
          value="${reportsTableState.search}" oninput="filterReportsTable()" style="flex:1;min-width:200px">

        <select class="form-select" id="rpt-status-filter" style="width:auto" onchange="filterReportsTable()">
          <option value="">Todos los estados</option>
          <option value="open">Abierto 🔴</option>
          <option value="working">En Reparación 🔧</option>
          <option value="pending">Pend. Visto Bueno ⏳</option>
          <option value="closed">Cerrado ✅</option>
        </select>

        ${isMultiPlant ? `
        <select class="form-select" id="rpt-plant-filter" style="width:auto" onchange="filterReportsTable()">
          <option value="">Todas las plantas</option>
          ${plants.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
        </select>` : `
        <div style="font-size:12px;font-weight:700;color:var(--accent-blue);padding:8px 12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:10px">
          🏭 ${getPlantDisplayName(user.plantId)}
        </div>`}
      </div>
    </div>

    <div id="admin-reports-table-container"></div>
  </div>`;
}

function initReportsTable() {
  filterReportsTable();
}

function filterReportsTable() {
  const user = Auth.currentUser;
  const search = document.getElementById('rpt-search')?.value.toLowerCase() || '';
  const status = document.getElementById('rpt-status-filter')?.value || '';
  const plantEl = document.getElementById('rpt-plant-filter');
  const plant  = (user && user.plantId && user.plantId !== 'ambas') ? user.plantId : (plantEl ? plantEl.value : '');

  const reports = DB.Reports.getAll().filter(r => {
    const matchKw = !search || [r.id, r.machineName, r.technicianName, r.description, r.workDescription, r.rootCause]
      .some(f => (f || '').toLowerCase().includes(search));
    const matchStatus = !status || r.status === status;
    const matchPlant  = !plant  || r.plantId === plant;
    return matchKw && matchStatus && matchPlant;
  });

  const container = document.getElementById('admin-reports-table-container');
  if (!container) return;

  container.innerHTML = `
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>Máquina</th>
          <th>Planta</th>
          <th>Reportó</th>
          <th>Técnico</th>
          <th>Estado</th>
          <th>T0 Reporte</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${reports.length === 0 ? `<tr><td colspan="8" style="text-align:center;padding:30px">Sin reportes</td></tr>` :
          reports.map(r => `
          <tr>
            <td style="font-family:monospace;font-weight:700">${r.id}</td>
            <td style="font-weight:700">${r.machineName}</td>
            <td style="font-size:12px">${r.plantName}</td>
            <td style="font-size:12px">${r.createdByName}</td>
            <td style="font-size:12px">${r.technicianName || '—'}</td>
            <td><span class="badge badge-${Utils.getStatusClass(r.status)}">${Utils.getStatusLabel(r.status)}</span></td>
            <td style="font-size:11px">${Utils.formatDateTime(r.t0)}</td>
            <td>
              <div class="table-actions">
                <button class="btn btn-ghost btn-sm" onclick="openReportDetail('${r.id}')">Ver detalle</button>
                <button class="btn-icon" onclick="deleteReportAdmin('${r.id}')" title="Eliminar" style="color:var(--accent-red)">🗑️</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>`;
}

function deleteReportAdmin(reportId) {
  if (!confirm(`¿Estás seguro de eliminar el reporte ${reportId}? Esta acción no se puede deshacer.`)) return;
  DB.Reports.delete(reportId, Auth.currentUser);
  NotifSystem.toast('info', 'Reporte Eliminado', `Reporte ${reportId} borrado.`);
  filterReportsTable();
}

// ---- Admin Config Hub ---------------------------------------
let configSubTab = 'general';

function renderAdminConfig() {
  const config   = DB.Config.get();
  const machines = DB.Machines.getActive();
  const plants   = DB.Plants.getActive();
  const users    = DB.Users.getActive();

  let subTabHTML = '';
  if (configSubTab === 'general') {
    subTabHTML = `
    <div style="max-width:680px">
      <!-- ONLY MASTER EXPORT BUTTON IN THE ENTIRE APP -->
      <div class="card mb-20" style="background:rgba(47,129,247,.06);border-color:rgba(47,129,247,.3);padding:20px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;color:var(--accent-green);font-weight:700">
          <span style="font-size:20px">📊</span> Respaldo Completo de la Base de Datos
        </div>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:14px">
          Descarga en formato Excel (.csv) todos los registros de reportes, equipos, usuarios, requisiciones y auditoría.
        </div>
        <button type="button" class="btn btn-success" onclick="exportAllReports()">
          📊 Exportar Base de Datos (Excel)
        </button>
      </div>

      <form id="config-form">
        <div class="card mb-16">
          <div class="card-title mb-16">🏢 Información General</div>
          <div class="form-group">
            <label class="form-label">Nombre de la Empresa / Sistema <span class="required">*</span></label>
            <input type="text" id="cfg-company" class="form-input" required value="${config.companyName || 'SOMAC · Danfoss'}">
          </div>
        </div>

        <div class="card mb-16">
          <div class="card-title mb-16">🚨 Alertas SLA</div>
          <div class="switch-group mb-16">
            <div>
              <div class="switch-label">Habilitar Alertas de Escalación SLA</div>
              <div class="switch-sublabel">Alerta si un reporte sobrepasa el tiempo límite sin ser atendido</div>
            </div>
            <label class="switch">
              <input type="checkbox" id="cfg-sla-enabled" ${config.slaEnabled !== false ? 'checked' : ''}>
              <span class="switch-slider"></span>
            </label>
          </div>

          <div class="form-group">
            <label class="form-label">Minutos Límite para Escalación SLA</label>
            <input type="number" id="cfg-sla-min" class="form-input" value="${config.slaMinutes || 60}" min="5" max="480">
          </div>

          <div class="form-group">
            <label class="form-label">Texto Personalizado de Alerta SLA</label>
            <textarea id="cfg-esc-text" class="form-textarea" rows="2" placeholder="Texto que aparecerá en el aviso de escalación">${config.escalationText || ''}</textarea>
          </div>
        </div>

        <button type="submit" class="btn btn-primary btn-lg">💾 Guardar Configuración</button>
      </form>
    </div>`;
  } else if (configSubTab === 'machines') {
    subTabHTML = renderAdminMachines();
  } else if (configSubTab === 'plants') {
    subTabHTML = renderAdminPlants();
  } else if (configSubTab === 'users') {
    subTabHTML = renderAdminUsers();
  } else if (configSubTab === 'audit') {
    subTabHTML = renderAdminAudit();
  } else if (configSubTab === 'firebase') {
    subTabHTML = renderFirebaseConfigSubTab();
  }

  return `
  <div class="fade-in">
    <div class="config-header-wrap">
      <div class="config-icon-box">⚙️</div>
      <div>
        <div class="config-title">Configuración del Sistema</div>
        <div class="config-subtitle">Administración de Máquinas, Plantas, Usuarios, Base de Datos y Ajustes</div>
      </div>
    </div>

    <div class="subtab-pill-bar">
      <button class="subtab-pill ${configSubTab==='general'?'active':''}" onclick="switchConfigSubTab('general')">
        General
      </button>
      <button class="subtab-pill ${configSubTab==='machines'?'active':''}" onclick="switchConfigSubTab('machines')">
        ⚙️ Máquinas / Equipos (${machines.length})
      </button>
      <button class="subtab-pill ${configSubTab==='plants'?'active':''}" onclick="switchConfigSubTab('plants')">
        🏭 Plantas (${plants.length})
      </button>
      <button class="subtab-pill ${configSubTab==='users'?'active':''}" onclick="switchConfigSubTab('users')">
        👥 Usuarios &amp; Roles (${users.length})
      </button>
      <button class="subtab-pill ${configSubTab==='firebase'?'active':''}" onclick="switchConfigSubTab('firebase')">
        🔥 Nube Firebase
      </button>
      <button class="subtab-pill ${configSubTab==='audit'?'active':''}" onclick="switchConfigSubTab('audit')">
        🔍 Bitácora Auditoría
      </button>
    </div>

    <div id="config-subtab-container">
      ${subTabHTML}
    </div>
  </div>`;
}

function switchConfigSubTab(tab) {
  configSubTab = tab;
  App.renderSection('admin-config');
}

// Config form submit listener (Global delegation)
document.addEventListener('submit', function(e) {
  if (e.target.id !== 'config-form') return;
  e.preventDefault();

  const companyName = document.getElementById('cfg-company')?.value.trim() || 'SOMAC · Danfoss';
  const slaMinutes  = parseInt(document.getElementById('cfg-sla-min')?.value) || 60;
  const slaEnabled  = document.getElementById('cfg-sla-enabled')?.checked !== false;
  const escalationText = document.getElementById('cfg-esc-text')?.value.trim() || '';

  DB.Config.set({
    companyName,
    slaMinutes,
    slaEnabled,
    escalationText
  });

  DB.Audit.log('CONFIG_UPDATED', Auth.currentUser ? Auth.currentUser.name : 'Admin', `Configuración general actualizada: ${companyName}`);

  NotifSystem.toast('success', 'Configuración Guardada', `Los cambios para "${companyName}" fueron guardados correctamente.`, 4000);

  // Immediately refresh dashboard layout to reflect new company name
  if (Auth.isLoggedIn()) {
    App.showDashboard(App.currentSection);
  }
});

// ---- Admin Machines CRUD ------------------------------------
function renderAdminMachines() {
  const user = Auth.currentUser;
  const allMachines = DB.Machines.getAll();
  const machines = (user && user.plantId && user.plantId !== 'ambas')
    ? allMachines.filter(m => m.plantId === user.plantId)
    : allMachines;
  const plantLabel = (user && user.plantId && user.plantId !== 'ambas')
    ? ` · ${getPlantDisplayName(user.plantId)}`
    : '';

  return `
  <div class="fade-in">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700">⚙️ Catálogo de Máquinas y Equipos${plantLabel}</div>
      <button class="btn btn-primary" onclick="openMachineModal(null)">➕ Agregar Máquina</button>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Nombre Máquina</th>
            <th>Planta</th>
            <th>Área</th>
            <th>Horas Disp. (Día)</th>
            <th>Horas Disp. (Semana)</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${machines.map(m => `
          <tr style="${!m.active?'opacity:.5':''}">
            <td style="font-weight:700">${m.name}</td>
            <td style="font-size:12px">${m.plantName || m.plantId}</td>
            <td style="font-size:12px">${m.area}</td>
            <td style="font-size:12px;font-weight:600">${m.hoursPerDay || 24} hrs/día</td>
            <td style="font-size:12px;font-weight:600">${m.hoursPerWeek || 168} hrs/semana</td>
            <td><span class="badge ${m.active !== false ? 'badge-closed' : 'badge-open'}">${m.active !== false ? 'Activo' : 'Inactivo'}</span></td>
            <td>
              <div class="table-actions">
                <button class="btn-icon" onclick="openMachineModal('${m.id}')" title="Editar">✏️</button>
                <button class="btn-icon" onclick="deleteMachine('${m.id}')" title="Eliminar" style="color:var(--accent-red)">🗑️</button>
              </div>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function openMachineModal(editId) {
  const machine = editId ? DB.Machines.getById(editId) : null;
  const plants = DB.Plants.getActive();

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">${machine ? '✏️ Editar Máquina' : '➕ Nueva Máquina'}</div>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
    <form id="machine-form">
      <div class="form-group">
        <label class="form-label">Nombre de la Máquina / Equipo <span class="required">*</span></label>
        <input type="text" id="mch-name" class="form-input" required placeholder="Ej: Prensa Hidráulica PH-200" value="${machine?.name||''}">
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Planta <span class="required">*</span></label>
          <select id="mch-plant" class="form-select" required>
            ${plants.map(p => `<option value="${p.id}" ${machine?.plantId===p.id?'selected':''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Área / Línea <span class="required">*</span></label>
          <input type="text" id="mch-area" class="form-input" required placeholder="Ej: Línea 1" value="${machine?.area||''}">
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Horas Disponibles por Día <span class="required">*</span></label>
          <input type="number" id="mch-hday" class="form-input" required min="1" max="24" value="${machine?.hoursPerDay||24}">
          <div class="form-hint">Para cálculo de % Disponibilidad</div>
        </div>
        <div class="form-group">
          <label class="form-label">Horas Disponibles por Semana <span class="required">*</span></label>
          <input type="number" id="mch-hweek" class="form-input" required min="1" max="168" value="${machine?.hoursPerWeek||168}">
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Guardar Máquina</button>
      </div>
    </form>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#machine-form').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      name: document.getElementById('mch-name').value.trim(),
      plantId: document.getElementById('mch-plant').value,
      area: document.getElementById('mch-area').value.trim(),
      hoursPerDay: parseInt(document.getElementById('mch-hday').value) || 24,
      hoursPerWeek: parseInt(document.getElementById('mch-hweek').value) || 168,
    };

    if (editId) DB.Machines.update(editId, data, Auth.currentUser);
    else DB.Machines.create(data, Auth.currentUser);

    modal.remove();
    NotifSystem.toast('success', 'Máquina Guardada', `${data.name} configurada.`);
    App.renderSection('admin-config');
  });
}

function deleteMachine(id) {
  if (!confirm('¿Estás seguro de eliminar esta máquina del catálogo?')) return;
  DB.Machines.delete(id, Auth.currentUser);
  NotifSystem.toast('info', 'Máquina Eliminada', '');
  App.renderSection('admin-config');
}

// ---- Admin Plants CRUD --------------------------------------
function renderAdminPlants() {
  const plants = DB.Plants.getAll();
  return `
  <div class="fade-in">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700">🏭 Catálogo de Plantas</div>
      <button class="btn btn-primary" onclick="openPlantModal(null)">➕ Agregar Planta</button>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Nombre de la Planta</th>
            <th style="width:120px;text-align:right">Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${plants.map(p => `
          <tr>
            <td style="font-weight:700;font-size:14px">🏭 ${p.name}</td>
            <td style="text-align:right">
              <div class="table-actions" style="justify-content:flex-end">
                <button class="btn-icon" onclick="openPlantModal('${p.id}')" title="Editar">✏️</button>
              </div>
            </td>
          </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function openPlantModal(editId) {
  const plant = editId ? DB.Plants.getById(editId) : null;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal" style="max-width:440px">
    <div class="modal-header">
      <div class="modal-title">${plant ? '✏️ Editar Planta' : '➕ Nueva Planta'}</div>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
    <form id="plant-form">
      <div class="form-group">
        <label class="form-label">Nombre de la Planta <span class="required">*</span></label>
        <input type="text" id="plt-name" class="form-input" required value="${plant?.name||''}" placeholder="Ej: Planta 1">
      </div>
      <div class="modal-footer" style="padding-top:12px;margin-top:16px;border-top:1px solid var(--border-color)">
        <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Guardar</button>
      </div>
    </form>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#plant-form').addEventListener('submit', e => {
    e.preventDefault();
    const data = {
      name: document.getElementById('plt-name').value.trim()
    };
    if (editId) DB.Plants.update(editId, data, Auth.currentUser);
    else DB.Plants.create(data, Auth.currentUser);
    modal.remove();
    NotifSystem.toast('success', 'Planta Guardada', '');
    App.renderSection('admin-config');
  });
}

// ---- Admin Users CRUD ---------------------------------------
function renderAdminUsers() {
  const users = DB.Users.getAll();
  const roleLabels = {
    sup_op: 'Supervisor Operación',
    tecnico: 'Técnico Mantenimiento',
    sup_mtto: 'Supervisor Mantenimiento',
    planeador: 'Planeador Mantenimiento',
    programador: 'Programador MP',
    admin: 'Administrador'
  };

  const isConnected = window.FirebaseSync && window.FirebaseSync.isConnected();

  return `
  <div class="fade-in">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px">
      <div style="font-size:15px;font-weight:700">👥 Usuarios & Permisos del Sistema</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="syncUsersToCloud(this)" style="font-size:12px">
          ${isConnected ? '☁️ Sincronizar con Nube' : '☁️ Subir a Firebase'}
        </button>
        <button class="btn btn-primary" onclick="openUserModal(null)">➕ Agregar Usuario</button>
      </div>
    </div>

    <div style="overflow-x:auto;-webkit-overflow-scrolling:touch;width:100%">
      <table style="min-width:560px">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Usuario</th>
            <th>Rol</th>
            <th>Planta</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const plantLabel = u.plantId === 'ambas' ? 'Ambas' : (u.plantId === 'plant-2' ? 'Planta 2' : 'Planta 1');
            return `
            <tr style="${!u.active?'opacity:.5':''}">
              <td style="font-weight:700">${u.name}</td>
              <td style="font-family:monospace;font-size:12px">${u.username}</td>
              <td><span class="badge badge-closed">${roleLabels[u.role] || u.role}</span></td>
              <td style="font-size:12px;font-weight:600">🏭 ${plantLabel}</td>
              <td><span class="badge ${u.active !== false ? 'badge-closed' : 'badge-open'}">${u.active !== false ? 'Activo' : 'Inactivo'}</span></td>
              <td>
                <div class="table-actions">
                  <button class="btn-icon" onclick="openUserModal('${u.id}')" title="Editar">✏️</button>
                  <button class="btn-icon" onclick="deleteUserAdmin('${u.id}')" title="Eliminar" style="color:var(--accent-red)">🗑️</button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

async function syncUsersToCloud(btn) {
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sincronizando...'; }
  try {
    if (window.FirebaseSync) {
      await window.FirebaseSync.init();
      const users = DB.Users.getAll();
      await window.FirebaseSync.saveKey('mtto_users', users);
      NotifSystem.toast('success', '☁️ Usuarios sincronizados', `${users.length} usuario(s) guardados en Firebase.`);
    } else {
      NotifSystem.toast('error', 'Sin conexión', 'Firebase no está configurado.');
    }
  } catch (e) {
    NotifSystem.toast('error', 'Error', 'No se pudo sincronizar. Verifica la conexión a internet.');
  }
  if (btn) { btn.disabled = false; btn.textContent = '☁️ Sincronizar con Nube'; }
}
window.syncUsersToCloud = syncUsersToCloud;

function openUserModal(editId) {
  const user = editId ? DB.Users.getById(editId) : null;
  const roleLabels = {
    sup_op: 'Supervisor Operación (Crear Reportes)',
    tecnico: 'Técnico Mantenimiento (Atender y Cerrar)',
    sup_mtto: 'Supervisor Mantenimiento (Visto Bueno y Gestión)',
    planeador: 'Planeador Mantenimiento (Materiales y Paros)',
    programador: 'Programador MP (Plan MP y Actividades)',
    admin: 'Administrador (Acceso Total)'
  };

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
  <div class="modal">
    <div class="modal-header">
      <div class="modal-title">${user ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}</div>
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
    </div>
    <form id="user-form">
      <div class="form-group">
        <label class="form-label">Nombre Completo <span class="required">*</span></label>
        <input type="text" id="usr-name" class="form-input" required value="${user?.name||''}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label class="form-label">Usuario <span class="required">*</span></label>
          <input type="text" id="usr-username" class="form-input" required value="${user?.username||''}">
        </div>
        <div class="form-group">
          <label class="form-label">${user?'Nueva Contraseña':'Contraseña'}</label>
          <input type="password" id="usr-pass" class="form-input" placeholder="${user?'Sin cambios':'••••••••'}" ${user?'':'required'}>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Rol del Sistema <span class="required">*</span></label>
        <select id="usr-role" class="form-select" required>
          ${Object.entries(roleLabels).map(([r, label]) => `<option value="${r}" ${user?.role===r?'selected':''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Planta Asignada <span class="required">*</span></label>
        <select id="usr-plant" class="form-select" required>
          <option value="plant-1" ${user?.plantId==='plant-1'?'selected':''}>Planta 1</option>
          <option value="plant-2" ${user?.plantId==='plant-2'?'selected':''}>Planta 2</option>
          <option value="ambas" ${user?.plantId==='ambas'?'selected':''}>Ambas Plantas (Global)</option>
        </select>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-ghost" onclick="this.closest('.modal-overlay').remove()">Cancelar</button>
        <button type="submit" class="btn btn-primary">💾 Guardar Usuario</button>
      </div>
    </form>
  </div>`;

  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#user-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pass = document.getElementById('usr-pass').value;
    const data = {
      name:     document.getElementById('usr-name').value.trim(),
      username: document.getElementById('usr-username').value.trim(),
      role:     document.getElementById('usr-role').value,
      plantId:  document.getElementById('usr-plant').value,
    };
    if (pass) data.password = pass;

    try {
      if (editId) await DB.Users.update(editId, data, Auth.currentUser);
      else await DB.Users.create(data, Auth.currentUser);
      modal.remove();
      NotifSystem.toast('success', '☁️ Usuario Guardado', `${data.name} sincronizado con la nube.`);
      App.renderSection('admin-config');
    } catch (err) {
      NotifSystem.toast('error', 'Error', err.message || 'No se pudo guardar el usuario.');
    }
  });
}

async function deleteUserAdmin(userId) {
  if (userId === Auth.currentUser.id) {
    NotifSystem.toast('error', 'Acción no permitida', 'No puedes eliminar tu propia cuenta.');
    return;
  }
  if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
  await DB.Users.delete(userId, Auth.currentUser);
  NotifSystem.toast('info', 'Usuario Eliminado', '');
  App.renderSection('admin-config');
}

// ---- Admin Audit Log ----------------------------------------
function renderAdminAudit() {
  const auditLog = DB.Audit.getAll();
  return `
  <div class="fade-in">
    <div style="font-size:15px;font-weight:700;margin-bottom:16px">🔍 Bitácora de Auditoría del Sistema</div>
    ${auditLog.length === 0 ? `<div class="empty-state">Sin eventos registrados</div>` :
      `<div class="card" style="padding:16px">
        ${auditLog.map(a => `
          <div class="audit-entry" style="padding:8px 0;border-bottom:1px solid var(--border-color)">
            <div style="font-size:12px;font-weight:700;color:var(--accent-blue)">${a.action}</div>
            <div style="font-size:13px;color:var(--text-primary)">${a.details}</div>
            <div style="font-size:11px;color:var(--text-muted)">Por: ${a.username} · ${Utils.formatDateTime(a.timestamp)}</div>
          </div>
        `).join('')}
      </div>`
    }
  </div>`;
}

// ---- Firebase Cloud DB Subtab -------------------------------
function renderFirebaseConfigSubTab() {
  const isConnected = window.FirebaseSync && window.FirebaseSync.isConnected();
  const currentConfig = window.FirebaseSync ? window.FirebaseSync.getConfig() : null;
  const configJSON = currentConfig ? JSON.stringify(currentConfig, null, 2) : '';

  return `
  <div class="fade-in">
    <div class="card" style="padding:22px;margin-bottom:18px;background:rgba(22, 28, 40, 0.85);border:1px solid rgba(255,255,255,0.08)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <div style="font-size:16px;font-weight:800;color:var(--text-primary);display:flex;align-items:center;gap:8px">
            <span>🔥 Sincronización en la Nube con Firebase Cloud Firestore</span>
          </div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:3px">
            Permite que todos los técnicos, supervisores, operadores y pantallas de TV compartan datos en tiempo real entre múltiples dispositivos.
          </div>
        </div>

        <div>
          <span class="badge ${isConnected ? 'badge-closed' : 'badge-open'}" style="font-size:12px;padding:6px 14px">
            ${isConnected ? '🟢 Conectado en Tiempo Real' : '🟡 Modo Local (Sin credenciales)'}
          </span>
        </div>
      </div>

      <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:14px 18px;margin-bottom:20px;font-size:12px;color:var(--text-secondary);line-height:1.6">
        <strong>📋 ¿Cómo obtener tus credenciales de Firebase?</strong><br>
        1. Entra a tu proyecto en <a href="https://console.firebase.google.com" target="_blank" style="color:var(--accent-blue);font-weight:700;text-decoration:underline">console.firebase.google.com</a>.<br>
        2. Ve a <strong>Configuración del Proyecto (⚙️)</strong> → Pestaña <strong>General</strong> → Sección <strong>Tus apps (Web &lt;/&gt;)</strong>.<br>
        3. Copia el objeto <code>firebaseConfig</code> y pégalo a continuación:
      </div>

      <form id="firebase-config-form" onsubmit="saveFirebaseConfigFromUI(event)">
        <div class="form-group">
          <label class="form-label">Configuración Firebase (JSON o campos clave) <span class="required">*</span></label>
          <textarea id="fb-config-json" class="form-textarea" rows="8" style="font-family:monospace;font-size:12px" placeholder='{
  "apiKey": "AIzaSy...",
  "authDomain": "somac-xxxx.firebaseapp.com",
  "projectId": "somac-xxxx",
  "storageBucket": "somac-xxxx.appspot.com",
  "messagingSenderId": "...",
  "appId": "..."
}'>${configJSON}</textarea>
        </div>

        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary btn-lg">💾 Guardar y Conectar Firebase</button>
          ${isConnected ? `
            <button type="button" class="btn btn-ghost btn-lg" onclick="pushAllToFirebaseFromUI()" style="border:1px solid rgba(255,255,255,0.15)">
              ☁️ Subir datos locales a la Nube
            </button>
          ` : ''}
        </div>
      </form>
    </div>
  </div>`;
}

function saveFirebaseConfigFromUI(e) {
  e.preventDefault();
  const rawText = document.getElementById('fb-config-json')?.value.trim();
  if (!rawText) {
    NotifSystem.toast('error', 'Error', 'Por favor ingresa la configuración de Firebase.');
    return;
  }

  try {
    let configObj = null;
    if (rawText.startsWith('{') && rawText.endsWith('}')) {
      configObj = JSON.parse(rawText);
    } else {
      // Clean javascript object notation if pasted with const firebaseConfig = { ... }
      const jsonStr = rawText.replace(/^[^{]*{/, '{').replace(/}[^}]*$/, '}').replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":');
      configObj = JSON.parse(jsonStr);
    }

    if (!configObj || !configObj.projectId) {
      NotifSystem.toast('error', 'Configuración Inválida', 'Falta el campo projectId en la configuración.');
      return;
    }

    if (window.FirebaseSync) {
      window.FirebaseSync.saveConfig(configObj);
      NotifSystem.toast('success', 'Firebase Conectado', `Proyecto ${configObj.projectId} sincronizado.`);
      setTimeout(() => App.renderSection('admin-config'), 500);
    }
  } catch (err) {
    NotifSystem.toast('error', 'JSON Inválido', 'Asegúrate de pegar el formato JSON correcto con llaves y comillas dobles.');
  }
}

async function pushAllToFirebaseFromUI() {
  if (!window.FirebaseSync || !window.FirebaseSync.isConnected()) {
    NotifSystem.toast('error', 'No Conectado', 'Conecta Firebase antes de subir los datos.');
    return;
  }

  NotifSystem.toast('info', 'Sincronizando', 'Subiendo base de datos a Firestore...');
  const ok = await window.FirebaseSync.pushAllToCloud();
  if (ok) {
    NotifSystem.toast('success', 'Nube Actualizada', 'Todos los datos actuales se guardaron en Firebase.');
  } else {
    NotifSystem.toast('error', 'Error', 'Ocurrió un problema al subir a Firestore. Revisa las reglas de seguridad.');
  }
}

// Expose globals
window.renderAdminDashboard = renderAdminDashboard;
window.renderAdminStats = renderAdminStats;
window.renderAdminReportsTable = renderAdminReportsTable;
window.renderAdminMachines = renderAdminMachines;
window.renderAdminPlants = renderAdminPlants;
window.renderAdminUsers = renderAdminUsers;
window.renderAdminConfig = renderAdminConfig;
window.renderAdminAudit = renderAdminAudit;
window.renderFirebaseConfigSubTab = renderFirebaseConfigSubTab;
window.saveFirebaseConfigFromUI = saveFirebaseConfigFromUI;
window.pushAllToFirebaseFromUI = pushAllToFirebaseFromUI;
window.exportAllReports = exportAllReports;
window.filterReportsTable = filterReportsTable;
window.openAvailabilityDrillDownModal = openAvailabilityDrillDownModal;
window.openMachineModal = openMachineModal;
window.deleteMachine = deleteMachine;
window.openPlantModal = openPlantModal;
window.openUserModal = openUserModal;
window.deleteUserAdmin = deleteUserAdmin;
window.deleteReportAdmin = deleteReportAdmin;
window.onDashPlantChange = onDashPlantChange;
window.onDashPeriodChange = onDashPeriodChange;
window.switchConfigSubTab = switchConfigSubTab;
window.renderMachineAvailView = renderMachineAvailView;
window.renderMachineAvailabilityBars = renderMachineAvailabilityBars;
window.openMachineFailuresModal = openMachineFailuresModal;

