// ============================================================
// REQUISITIONS, MATERIALES & ALMACEN VIEW - SOMAC
// ============================================================

var REQ_STATUSES = [
  { key: 'pendiente_aprobacion', label: 'Pendiente',        color: 'var(--accent-yellow)' },
  { key: 'aprobada',             label: 'Aprobada',          color: 'var(--accent-blue)' },
  { key: 'cotizando',            label: 'Cotizando',         color: '#f0a500' },
  { key: 'en_espera_auth',       label: 'En espera aut.',    color: '#9b59b6' },
  { key: 'comprado',             label: 'Comprado',          color: '#1abc9c' },
  { key: 'entregado',            label: 'Entregado',         color: 'var(--accent-green)' },
  { key: 'rechazada',            label: 'Rechazada',         color: 'var(--accent-red)' },
];

var PLANNER_FLOW = ['aprobada', 'cotizando', 'en_espera_auth', 'comprado', 'entregado'];

var reqState = { activeTab: 'seguimiento', filterKeyword: '' };

function getReqStatus(key) {
  return REQ_STATUSES.find(function(s){ return s.key === key; }) || { key: key, label: key, color: 'var(--text-muted)' };
}

function reqStatusBadge(status) {
  var s = getReqStatus(status);
  return '<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:' + s.color + '22;color:' + s.color + ';border:1px solid ' + s.color + '44">' + s.label + '</span>';
}

// ============================================================
// MAIN VIEW
// ============================================================
function renderRequisitionsView() {
  var user = Auth.currentUser;
  var allReqs = DB.Requisitions.getByUserPlant(user);
  var isPlannerOrAdmin = ['programador', 'planeador', 'admin', 'sup_mtto'].includes(user.role);

  var pendingReqs = allReqs.filter(function(r){ return r.status === 'pendiente_aprobacion'; });
  var activeReqs  = allReqs.filter(function(r){ return ['aprobada','cotizando','en_espera_auth','comprado'].includes(r.status); });
  var doneReqs    = allReqs.filter(function(r){ return ['entregado','rechazada'].includes(r.status); });

  function kw(list) {
    var q = reqState.filterKeyword.toLowerCase().trim();
    if (!q) return list;
    return list.filter(function(r){
      return [r.id, r.item, r.machineName, r.reason, r.createdByName].some(function(f){ return (f||'').toLowerCase().includes(q); });
    });
  }

  var listHtml = '';
  if (reqState.activeTab === 'pendientes') {
    listHtml = renderReqTable(kw(pendingReqs), user, isPlannerOrAdmin);
  } else if (reqState.activeTab === 'seguimiento') {
    listHtml = renderReqTable(kw(activeReqs), user, isPlannerOrAdmin);
  } else if (reqState.activeTab === 'historial') {
    listHtml = renderReqTable(kw(doneReqs), user, isPlannerOrAdmin);
  } else if (reqState.activeTab === 'almacen') {
    listHtml = renderWarehouseTab(user, isPlannerOrAdmin);
  }

  var filterHtml = '';
  if (reqState.activeTab !== 'almacen') {
    filterHtml = '<div class="filter-row mb-16"><div class="filter-search"><span class="filter-search-icon">&#128269;</span>' +
      '<input type="text" class="form-input" id="req-kw" placeholder="Buscar refaccion, maquina, usuario..." value="' + reqState.filterKeyword + '" oninput="applyReqFilters()"></div></div>';
  }

  var tabPend = '<button class="tab-btn' + (reqState.activeTab==='pendientes'?' active':'') + '" onclick="setReqTab(\'pendientes\')">Pendientes <span class="tab-count' + (pendingReqs.length>0?'':' muted') + '">' + pendingReqs.length + '</span></button>';
  var tabSeg  = '<button class="tab-btn' + (reqState.activeTab==='seguimiento'?' active':'') + '" onclick="setReqTab(\'seguimiento\')">En Seguimiento <span class="tab-count blue">' + activeReqs.length + '</span></button>';
  var tabHist = '<button class="tab-btn' + (reqState.activeTab==='historial'?' active':'') + '" onclick="setReqTab(\'historial\')">Historial <span class="tab-count muted">' + doneReqs.length + '</span></button>';
  var tabAlm  = '<button class="tab-btn' + (reqState.activeTab==='almacen'?' active':'') + '" onclick="setReqTab(\'almacen\')">Almacen</button>';

  return '<div class="fade-in">' +
    '<div class="mb-24" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
      '<div class="config-header-wrap" style="margin-bottom:0"><div class="config-icon-box">&#128705;</div>' +
        '<div><div class="config-title">Materiales &amp; Requisiciones</div>' +
        '<div class="config-subtitle">Seguimiento de solicitudes de compra &middot; Almacen del taller</div></div></div>' +
      '<button class="btn btn-primary" onclick="openNewReqModal()">&#10133; Nueva Solicitud</button>' +
    '</div>' +
    '<div class="tab-bar" style="margin-bottom:20px">' + tabPend + tabSeg + tabHist + tabAlm + '</div>' +
    filterHtml + listHtml + '</div>';
}

// ============================================================
// REQUISITIONS LIST
// ============================================================
function renderReqTable(list, user, isPlannerOrAdmin) {
  if (list.length === 0) {
    return '<div class="empty-state"><div class="empty-state-icon">&#128203;</div>' +
      '<div class="empty-state-title">Sin registros</div>' +
      '<div class="empty-state-desc">No hay requisiciones en esta categoria.</div></div>';
  }
  return '<div style="display:flex;flex-direction:column;gap:10px">' +
    list.map(function(r){ return renderReqCard(r, user, isPlannerOrAdmin); }).join('') + '</div>';
}

function renderReqCard(r, user, isPlannerOrAdmin) {
  var s = getReqStatus(r.status);
  var isActive = ['aprobada','cotizando','en_espera_auth','comprado'].includes(r.status);
  var canAdvance = isPlannerOrAdmin && isActive;
  var canApproveReject = isPlannerOrAdmin && r.status === 'pendiente_aprobacion';

  var progressHtml = '';
  if (isActive) {
    var idx = PLANNER_FLOW.indexOf(r.status);
    var pct = Math.round((idx / (PLANNER_FLOW.length - 1)) * 100);
    var steps = PLANNER_FLOW.map(function(st, i){
      var ss = getReqStatus(st);
      var done = i <= idx;
      return '<span style="color:' + (done ? ss.color : 'var(--text-muted)') + ';font-weight:' + (done ? 700 : 400) + '">' + ss.label + '</span>';
    }).join('<span style="color:var(--border-color);margin:0 4px">></span>');
    progressHtml = '<div style="margin:10px 0 4px">' +
      '<div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">' + steps + '</div>' +
      '<div style="background:var(--bg-tertiary);border-radius:4px;height:4px">' +
        '<div style="background:' + s.color + ';width:' + pct + '%;height:4px;border-radius:4px;transition:width .4s"></div>' +
      '</div></div>';
  }

  var actions = '';
  if (canApproveReject) {
    actions += '<button class="btn btn-sm" style="background:rgba(35,200,100,.12);color:var(--accent-green);border:1px solid rgba(35,200,100,.3)" onclick="reqQuickApprove(\'' + r.id + '\')">Aprobar</button>';
    actions += '<button class="btn btn-sm" style="background:rgba(255,68,68,.12);color:var(--accent-red);border:1px solid rgba(255,68,68,.3)" onclick="reqQuickReject(\'' + r.id + '\')">Rechazar</button>';
  }
  if (canAdvance) {
    actions += '<button class="btn btn-sm btn-primary" onclick="openPlannerModal(\'' + r.id + '\')">Actualizar</button>';
  }
  actions += '<button class="btn btn-sm" style="background:var(--bg-tertiary);color:var(--text-secondary)" onclick="toggleReqHistory(\'' + r.id + '\')">Bit\u00e1cora</button>';
  if (isPlannerOrAdmin) {
    actions += '<button class="btn-icon" onclick="deleteReq(\'' + r.id + '\')" title="Eliminar" style="color:var(--accent-red)">&#128465;</button>';
  }

  var deliveryInfo = r.deliveryDate ? ' &middot; Entrega: <strong style="color:var(--accent-blue)">' + r.deliveryDate + '</strong>' : '';
  var supplierInfo = r.supplier ? ' &middot; Proveedor: ' + r.supplier : '';
  var autoTag = r.isAutoRestock ? '<span style="font-size:10px;background:var(--bg-tertiary);color:var(--text-muted);padding:2px 6px;border-radius:10px">Reposicion auto</span>' : '';

  return '<div class="card" style="padding:16px 20px;border-left:4px solid ' + s.color + '">' +
    '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
      '<div style="flex:1;min-width:200px">' +
        '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">' +
          '<span style="font-family:monospace;font-size:10px;color:var(--text-muted);font-weight:700">' + r.id + '</span>' +
          reqStatusBadge(r.status) + autoTag +
        '</div>' +
        '<div style="font-size:15px;font-weight:800;color:var(--text-primary);margin-bottom:2px">' + r.item + '</div>' +
        '<div style="font-size:12px;color:var(--text-secondary)">Cant: <strong>' + r.quantity + '</strong> &middot; ' +
          'Maquina: <strong>' + (r.machineName||'General') + '</strong> &middot; Solicito: ' + r.createdByName +
          deliveryInfo + supplierInfo + '</div>' +
        (r.reason ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px;font-style:italic">' + r.reason + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap">' + actions + '</div>' +
    '</div>' +
    progressHtml +
    '<div id="req-hist-' + r.id + '" style="display:none;margin-top:12px;padding-top:12px;border-top:1px solid var(--border-color)">' +
      renderReqHistory(r) +
    '</div>' +
  '</div>';
}

function renderReqHistory(r) {
  var hist = r.statusHistory || [];
  if (hist.length === 0) return '<div style="font-size:12px;color:var(--text-muted)">Sin historial disponible.</div>';
  var rows = hist.slice().reverse().map(function(h){
    var hs = getReqStatus(h.status);
    return '<div style="display:flex;align-items:center;gap:8px;font-size:12px">' +
      '<span style="color:' + hs.color + '">' + hs.label + '</span>' +
      '<span style="color:var(--text-muted)">por</span>' +
      '<span>' + h.updatedBy + '</span>' +
      '<span style="color:var(--text-muted);margin-left:auto">' + Utils.formatDateTime(h.date) + '</span>' +
      (h.note ? '<span style="font-style:italic;color:var(--text-secondary)">' + h.note + '</span>' : '') +
    '</div>';
  }).join('');
  return '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Historial de estatus</div>' +
    '<div style="display:flex;flex-direction:column;gap:4px">' + rows + '</div>';
}

// ============================================================
// WAREHOUSE / ALMACEN TAB
// ============================================================
function renderWarehouseTab(user, isPlannerOrAdmin) {
  var plantId = user.plantId;
  var items = DB.Inventory.getByPlant(plantId);
  var plants = DB.Plants.getActive();

  function stockLevel(item, pId) {
    var stock = DB.Inventory.getStockForPlant(item, pId);
    var min = item.minQuantity || 1;
    if (stock === 0) return { label: 'Sin stock', color: 'var(--accent-red)', icon: '&#128308;' };
    if (stock <= min) return { label: 'Stock bajo', color: 'var(--accent-yellow)', icon: '&#128993;' };
    return { label: 'OK', color: 'var(--accent-green)', icon: '&#128994;' };
  }

  var addBtn = isPlannerOrAdmin ? '<button class="btn btn-primary" onclick="openNewInventoryModal()">&#10133; Agregar Articulo</button>' : '';

  if (items.length === 0) {
    return '<div>' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">' +
        '<div><div style="font-size:14px;font-weight:700;color:var(--text-primary)">Inventario de Almacen</div>' +
        '<div style="font-size:12px;color:var(--text-secondary)">0 articulos</div></div>' + addBtn +
      '</div>' +
      '<div class="empty-state"><div class="empty-state-icon">&#128230;</div>' +
        '<div class="empty-state-title">Almacen vacio</div>' +
        '<div class="empty-state-desc">No hay articulos registrados en el inventario.</div>' +
        (isPlannerOrAdmin ? '<button class="btn btn-primary" style="margin-top:16px" onclick="openNewInventoryModal()">Agregar primer articulo</button>' : '') +
      '</div></div>';
  }

  var showMultiPlant = plantId === 'ambas';
  var plantHeaders = showMultiPlant
    ? plants.map(function(p){ return '<th style="text-align:center">' + p.name + '</th>'; }).join('')
    : '<th style="text-align:center">Stock</th>';
  var actionsHeader = isPlannerOrAdmin ? '<th>Acciones</th>' : '';

  var rows = items.map(function(item){
    var lvl = stockLevel(item, plantId);
    var stockCells = '';
    if (showMultiPlant) {
      stockCells = plants.map(function(p){
        var s2 = DB.Inventory.getStockForPlant(item, p.id);
        var l2 = stockLevel(item, p.id);
        return '<td style="text-align:center"><span style="font-weight:700;color:' + l2.color + '">' + s2 + '</span></td>';
      }).join('');
    } else {
      var st = DB.Inventory.getStockForPlant(item, plantId);
      stockCells = '<td style="text-align:center"><span style="font-weight:700;color:' + lvl.color + '">' + st + '</span></td>';
    }
    var actionsCell = isPlannerOrAdmin
      ? '<td><div class="table-actions">' +
          '<button class="btn-icon" onclick="openAdjustStockModal(\'' + item.id + '\')" title="Ajustar stock">&#9878;</button>' +
          '<button class="btn-icon" onclick="deleteInventoryItem(\'' + item.id + '\')" style="color:var(--accent-red)">&#128465;</button>' +
        '</div></td>'
      : '';
    var modelBrand = [item.model, item.brand].filter(Boolean).join(' - ') || '&mdash;';
    return '<tr>' +
      '<td style="font-family:monospace;font-weight:700;font-size:11px">' + item.id + '</td>' +
      '<td><div style="font-weight:700;color:var(--text-primary)">' + item.name + '</div></td>' +
      '<td style="font-size:12px;color:var(--text-secondary)">' + modelBrand + '</td>' +
      '<td style="font-size:12px">' + (item.supplier||'&mdash;') + '</td>' +
      '<td style="font-weight:700;color:var(--accent-blue)">$' + Number(item.costUnit||0).toLocaleString('es-MX',{minimumFractionDigits:2}) + '</td>' +
      stockCells +
      '<td style="text-align:center"><span title="' + lvl.label + '">' + lvl.icon + '</span></td>' +
      actionsCell + '</tr>';
  }).join('');

  return '<div>' +
    '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:16px">' +
      '<div><div style="font-size:14px;font-weight:700;color:var(--text-primary)">Inventario de Almacen</div>' +
      '<div style="font-size:12px;color:var(--text-secondary)">' + items.length + ' articulo(s)</div></div>' + addBtn +
    '</div>' +
    '<div class="table-container"><table>' +
      '<thead><tr><th>ID</th><th>Articulo</th><th>Modelo / Marca</th><th>Proveedor</th><th>Costo Unit.</th>' +
      plantHeaders + '<th style="text-align:center">Estado</th>' + actionsHeader + '</tr></thead>' +
      '<tbody>' + rows + '</tbody></table></div></div>';
}

// ============================================================
// TAB / FILTER ACTIONS
// ============================================================
function setReqTab(tab) {
  reqState.activeTab = tab;
  reqState.filterKeyword = '';
  App.renderSection('requisitions');
}

function applyReqFilters() {
  var el = document.getElementById('req-kw');
  reqState.filterKeyword = el ? el.value : '';
  App.renderSection('requisitions');
}

function toggleReqHistory(id) {
  var el = document.getElementById('req-hist-' + id);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// ============================================================
// PLANNER STATUS MODAL
// ============================================================
function openPlannerModal(reqId) {
  var r = DB.Requisitions.getById(reqId);
  if (!r) return;
  var currentIdx = PLANNER_FLOW.indexOf(r.status);

  var steps = PLANNER_FLOW.map(function(st, i){
    var ss = getReqStatus(st);
    var isDone = i < currentIdx;
    var isCurrent = i === currentIdx;
    var isNext = i === currentIdx + 1;
    var bg = isCurrent ? ss.color + '22' : isDone ? 'rgba(35,200,100,.06)' : 'var(--bg-secondary)';
    var border = isCurrent ? ss.color + '66' : isDone ? 'rgba(35,200,100,.2)' : 'var(--border-color)';
    var cursor = (isNext || isCurrent) ? 'pointer' : 'default';
    var checkMark = isDone ? '&#9989;' : isCurrent ? '&#9654;' : '&#9744;';
    var clickAttr = isNext ? ' onclick="advanceReqStep(\'' + reqId + '\',\'' + st + '\')"' : '';
    var sub = isCurrent ? '<div style="font-size:11px;color:' + ss.color + '">Estado actual</div>' :
      (isNext ? '<div style="font-size:11px;color:var(--text-muted)">Clic para avanzar</div>' : '');
    return '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:8px;cursor:' + cursor +
      ';background:' + bg + ';border:1px solid ' + border + ';transition:.2s"' + clickAttr + '>' +
      '<span style="font-size:16px;width:24px;text-align:center">' + checkMark + '</span>' +
      '<div style="flex:1"><div style="font-weight:' + (isCurrent||isNext?700:500) + ';color:' +
        (isCurrent ? ss.color : isDone ? 'var(--accent-green)' : 'var(--text-secondary)') + '">' + ss.label + '</div>' + sub + '</div>' +
    '</div>';
  }).join('');

  var html = '<div class="modal" style="max-width:520px">' +
    '<div class="modal-header">' +
      '<div class="modal-title">Actualizar Requisicion ' + r.id + '</div>' +
      '<button class="modal-close" onclick="document.getElementById(\'planner-modal-overlay\').remove()">&#10005;</button>' +
    '</div>' +
    '<div style="padding:20px 24px">' +
      '<div style="font-weight:700;color:var(--text-primary);margin-bottom:4px">' + r.item + '</div>' +
      '<div style="font-size:12px;color:var(--text-secondary);margin-bottom:20px">Cant: ' + r.quantity + ' &middot; ' + (r.machineName||'General') + '</div>' +
      '<div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">Progreso</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">' + steps + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;align-items:end">' +
        '<div class="form-group" style="margin-bottom:0"><label class="form-label">Fecha de Entrega</label>' +
          '<input type="date" id="pm-delivery-date" class="form-input" value="' + (r.deliveryDate||'') + '"></div>' +
        '<div class="form-group" style="margin-bottom:0"><label class="form-label">Costo Estimado ($)</label>' +
          '<input type="number" id="pm-cost" class="form-input" min="0" step="0.01" placeholder="0.00" value="' + (r.cost||'') + '"></div>' +
      '</div>' +
      '<div class="form-group" style="margin-bottom:12px"><label class="form-label">Proveedor</label>' +
        '<input type="text" id="pm-supplier" class="form-input" placeholder="Nombre del proveedor" value="' + (r.supplier||'') + '"></div>' +
      '<div class="form-group"><label class="form-label">Nota</label>' +
        '<textarea id="pm-note" class="form-textarea" rows="2" placeholder="Nota opcional..."></textarea></div>' +
    '</div>' +
    '<div class="modal-footer">' +
      '<button class="btn btn-ghost" onclick="document.getElementById(\'planner-modal-overlay\').remove()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="savePlannerUpdate(\'' + reqId + '\')">Guardar Cambios</button>' +
    '</div></div>';

  var existing = document.getElementById('planner-modal-overlay');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'planner-modal-overlay';
  modal.innerHTML = html;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });
}

function advanceReqStep(reqId, nextStatus) {
  DB.Requisitions.updateFull(reqId, { status: nextStatus }, Auth.currentUser);
  var overlay = document.getElementById('planner-modal-overlay');
  if (overlay) overlay.remove();
  openPlannerModal(reqId);
  NotifSystem.toast('success', 'Estado actualizado', getReqStatus(nextStatus).label);
}

function savePlannerUpdate(reqId) {
  var deliveryDate = document.getElementById('pm-delivery-date') ? document.getElementById('pm-delivery-date').value : undefined;
  var cost = document.getElementById('pm-cost') ? document.getElementById('pm-cost').value : undefined;
  var supplier = document.getElementById('pm-supplier') ? document.getElementById('pm-supplier').value : undefined;
  var note = document.getElementById('pm-note') ? document.getElementById('pm-note').value.trim() : '';
  DB.Requisitions.updateFull(reqId, {
    deliveryDate: deliveryDate || undefined,
    cost: cost ? parseFloat(cost) : undefined,
    supplier: supplier || undefined,
    note: note || undefined
  }, Auth.currentUser);
  var overlay = document.getElementById('planner-modal-overlay');
  if (overlay) overlay.remove();
  NotifSystem.toast('success', 'Requisicion Actualizada', 'Cambios guardados.');
  App.renderSection('requisitions');
}

// ============================================================
// QUICK APPROVE / REJECT / DELETE
// ============================================================
function reqQuickApprove(id) {
  if (!confirm('Aprobar esta requisicion?')) return;
  DB.Requisitions.updateFull(id, { status: 'aprobada' }, Auth.currentUser);
  NotifSystem.toast('success', 'Aprobada', 'Requisicion aprobada.');
  App.renderSection('requisitions');
}

function reqQuickReject(id) {
  var note = prompt('Motivo del rechazo (opcional):') || '';
  DB.Requisitions.updateFull(id, { status: 'rechazada', note: note }, Auth.currentUser);
  NotifSystem.toast('info', 'Rechazada', 'Requisicion rechazada.');
  App.renderSection('requisitions');
}

function deleteReq(id) {
  if (!confirm('Eliminar esta requisicion?')) return;
  DB.Requisitions.delete(id, Auth.currentUser);
  NotifSystem.toast('info', 'Eliminada', '');
  App.renderSection('requisitions');
}

// ============================================================
// NEW REQUISITION MODAL
// ============================================================
function openNewReqModal() {
  var user = Auth.currentUser;
  var machines = DB.Machines.getByPlant(user.plantId);
  var plantId = user.plantId !== 'ambas' ? user.plantId : (DB.Plants.getActive()[0] ? DB.Plants.getActive()[0].id : '');
  var inventoryItems = DB.Inventory.getInStockByPlant(plantId);

  var invOptions = inventoryItems.map(function(i){
    var stock = DB.Inventory.getStockForPlant(i, plantId);
    return '<option value="' + i.id + '">' + i.name + (i.model ? ' (' + i.model + ')' : '') + ' - Stock: ' + stock + '</option>';
  }).join('');

  var machineOptions = '<option value="">- Ninguna -</option>' +
    machines.map(function(m){ return '<option value="' + m.id + '">' + m.name + '</option>'; }).join('');

  var hasInv = inventoryItems.length > 0;

  var html = '<div class="modal" style="max-width:500px">' +
    '<div class="modal-header"><div class="modal-title">Nueva Solicitud de Material</div>' +
      '<button class="modal-close" onclick="document.getElementById(\'new-req-modal-overlay\').remove()">&#10005;</button></div>' +
    '<form id="new-req-form" style="padding:20px 24px">' +
      '<div class="form-group mb-16"><label class="form-label">El material esta en almacen?</label>' +
        '<div style="display:flex;gap:8px">' +
          '<button type="button" id="req-src-inv" class="btn btn-sm ' + (hasInv ? 'btn-primary' : 'btn-ghost') + '" onclick="setReqSource(\'inventory\')">Seleccionar de Almacen</button>' +
          '<button type="button" id="req-src-man" class="btn btn-sm ' + (!hasInv ? 'btn-primary' : 'btn-ghost') + '" onclick="setReqSource(\'manual\')">Capturar Manualmente</button>' +
        '</div></div>' +
      '<div id="req-inv-section" style="display:' + (hasInv ? 'block' : 'none') + '">' +
        '<div class="form-group mb-16"><label class="form-label">Articulo del Almacen</label>' +
          '<select id="req-inv-item" class="form-select" onchange="onReqInvChange(this.value)">' +
            '<option value="">- Selecciona articulo -</option>' + invOptions +
          '</select></div>' +
        '<div id="req-inv-info" style="display:none;margin-bottom:16px;padding:10px 14px;background:var(--bg-secondary);border-radius:8px;font-size:12px;color:var(--text-secondary)"></div>' +
      '</div>' +
      '<div id="req-man-section" style="display:' + (!hasInv ? 'block' : 'none') + '">' +
        '<div class="form-group mb-16"><label class="form-label">Refaccion / Descripcion</label>' +
          '<input type="text" id="req-item" class="form-input" placeholder="Ej: Rodamiento SKF 6205..."></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div class="form-group"><label class="form-label">Cantidad</label><input type="number" id="req-qty" class="form-input" value="1" min="1" required></div>' +
        '<div class="form-group"><label class="form-label">Maquina Asociada</label><select id="req-machine" class="form-select">' + machineOptions + '</select></div>' +
      '</div>' +
      '<div class="form-group mb-0"><label class="form-label">Notas adicionales</label>' +
        '<textarea id="req-reason" class="form-textarea" rows="2" placeholder="Especificaciones, urgencia..."></textarea></div>' +
      '<div class="modal-footer" style="padding:0;margin-top:20px">' +
        '<button type="button" class="btn btn-ghost" onclick="document.getElementById(\'new-req-modal-overlay\').remove()">Cancelar</button>' +
        '<button type="submit" class="btn btn-primary">Enviar Solicitud</button>' +
      '</div>' +
    '</form></div>';

  var existing = document.getElementById('new-req-modal-overlay');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'new-req-modal-overlay';
  modal.innerHTML = html;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });

  modal.querySelector('#new-req-form').addEventListener('submit', function(e){
    e.preventDefault();
    var invItemEl = document.getElementById('req-inv-item');
    var invItemId = invItemEl ? invItemEl.value : '';
    var manualItem = (document.getElementById('req-item') ? document.getElementById('req-item').value : '').trim();
    var qty = parseInt((document.getElementById('req-qty') ? document.getElementById('req-qty').value : 1)) || 1;
    var machineId = document.getElementById('req-machine') ? document.getElementById('req-machine').value : '';
    var reason = (document.getElementById('req-reason') ? document.getElementById('req-reason').value : '').trim();
    var m = machineId ? DB.Machines.getById(machineId) : null;
    var invSecVisible = document.getElementById('req-inv-section') && document.getElementById('req-inv-section').style.display !== 'none';
    var isInventory = invSecVisible && invItemId;
    var itemName = manualItem;
    var inventoryItemId = null;
    if (isInventory) {
      var inv = DB.Inventory.getById(invItemId);
      if (!inv) { NotifSystem.toast('error', 'Error', 'Articulo no encontrado.'); return; }
      itemName = inv.name + (inv.model ? ' (' + inv.model + ')' : '');
      inventoryItemId = inv.id;
      var pId = user.plantId !== 'ambas' ? user.plantId : (DB.Plants.getActive()[0] ? DB.Plants.getActive()[0].id : '');
      DB.Inventory.adjustQuantity(inv.id, pId, -qty, 'Usado en requisicion por ' + user.name, user);
    }
    if (!itemName) { NotifSystem.toast('error', 'Campos incompletos', 'Ingresa o selecciona el material.'); return; }
    DB.Requisitions.create({
      item: itemName, quantity: qty, machineId: machineId || '', machineName: m ? m.name : 'Uso General',
      reason: reason, urgency: 'normal', inventoryItemId: inventoryItemId, isAutoRestock: !!inventoryItemId
    }, user);
    modal.remove();
    NotifSystem.toast('success', 'Solicitud Creada', 'Requisicion enviada.');
    App.renderSection('requisitions');
  });
}

function setReqSource(src) {
  var invSec = document.getElementById('req-inv-section');
  var manSec = document.getElementById('req-man-section');
  var btnInv = document.getElementById('req-src-inv');
  var btnMan = document.getElementById('req-src-man');
  if (!invSec || !manSec) return;
  if (src === 'inventory') {
    invSec.style.display = 'block'; manSec.style.display = 'none';
    if (btnInv) btnInv.className = 'btn btn-sm btn-primary';
    if (btnMan) btnMan.className = 'btn btn-sm btn-ghost';
  } else {
    invSec.style.display = 'none'; manSec.style.display = 'block';
    if (btnInv) btnInv.className = 'btn btn-sm btn-ghost';
    if (btnMan) btnMan.className = 'btn btn-sm btn-primary';
  }
}

function onReqInvChange(invId) {
  var infoEl = document.getElementById('req-inv-info');
  if (!infoEl) return;
  if (!invId) { infoEl.style.display = 'none'; return; }
  var inv = DB.Inventory.getById(invId);
  if (!inv) return;
  var user = Auth.currentUser;
  var pId = user.plantId !== 'ambas' ? user.plantId : (DB.Plants.getActive()[0] ? DB.Plants.getActive()[0].id : '');
  var stock = DB.Inventory.getStockForPlant(inv, pId);
  infoEl.style.display = 'block';
  infoEl.innerHTML = '<strong>' + inv.name + '</strong>' + (inv.model ? ' &mdash; ' + inv.model : '') +
    '<br>Marca: ' + (inv.brand||'&mdash;') + ' &middot; Proveedor: ' + (inv.supplier||'&mdash;') +
    '<br>Costo: <strong style="color:var(--accent-blue)">$' + Number(inv.costUnit||0).toLocaleString('es-MX',{minimumFractionDigits:2}) + '</strong>' +
    ' &middot; Stock: <strong style="color:' + (stock > 0 ? 'var(--accent-green)' : 'var(--accent-red)') + '">' + stock + '</strong>';
}

// ============================================================
// NEW INVENTORY ITEM MODAL
// ============================================================
function openNewInventoryModal(prefillName) {
  var plants = DB.Plants.getActive();
  var plantChecks = plants.map(function(p){
    return '<label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer">' +
      '<input type="checkbox" id="inv-plant-' + p.id + '" value="' + p.id + '" checked style="accent-color:var(--accent-blue)">' + p.name + '</label>';
  }).join('');

  var html = '<div class="modal" style="max-width:520px">' +
    '<div class="modal-header"><div class="modal-title">Agregar Articulo al Almacen</div>' +
      '<button class="modal-close" onclick="document.getElementById(\'new-inv-modal-overlay\').remove()">&#10005;</button></div>' +
    '<form id="new-inv-form" style="padding:20px 24px">' +
      '<div class="form-group mb-12"><label class="form-label">Nombre del Articulo <span class="required">*</span></label>' +
        '<input type="text" id="inv-name" class="form-input" required placeholder="Ej: Rodamiento de bolas" value="' + (prefillName||'') + '"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div class="form-group"><label class="form-label">Modelo</label><input type="text" id="inv-model" class="form-input" placeholder="Ej: 6205-2RS"></div>' +
        '<div class="form-group"><label class="form-label">Marca</label><input type="text" id="inv-brand" class="form-input" placeholder="Ej: SKF"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div class="form-group"><label class="form-label">Proveedor</label><input type="text" id="inv-supplier" class="form-input" placeholder="Nombre del proveedor"></div>' +
        '<div class="form-group"><label class="form-label">Costo Unitario ($)</label><input type="number" id="inv-cost" class="form-input" min="0" step="0.01" placeholder="0.00"></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">' +
        '<div class="form-group"><label class="form-label">Stock Inicial (por planta)</label><input type="number" id="inv-stock" class="form-input" min="0" value="0"></div>' +
        '<div class="form-group"><label class="form-label">Cantidad Minima (alerta)</label><input type="number" id="inv-min" class="form-input" min="0" value="1"></div>' +
      '</div>' +
      '<div class="form-group mb-0"><label class="form-label">Plantas donde aplica</label>' +
        '<div style="display:flex;gap:12px;margin-top:6px">' + plantChecks + '</div></div>' +
      '<div class="modal-footer" style="padding:0;margin-top:20px">' +
        '<button type="button" class="btn btn-ghost" onclick="document.getElementById(\'new-inv-modal-overlay\').remove()">Cancelar</button>' +
        '<button type="submit" class="btn btn-primary">Guardar en Almacen</button>' +
      '</div>' +
    '</form></div>';

  var existing = document.getElementById('new-inv-modal-overlay');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'new-inv-modal-overlay';
  modal.innerHTML = html;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });

  modal.querySelector('#new-inv-form').addEventListener('submit', function(e){
    e.preventDefault();
    var user = Auth.currentUser;
    var selectedPlants = plants.map(function(p){ return p.id; }).filter(function(pid){
      var el = document.getElementById('inv-plant-' + pid);
      return el && el.checked;
    });
    if (selectedPlants.length === 0) { NotifSystem.toast('error', 'Error', 'Selecciona al menos una planta.'); return; }
    DB.Inventory.create({
      name: (document.getElementById('inv-name') ? document.getElementById('inv-name').value : '').trim(),
      model: (document.getElementById('inv-model') ? document.getElementById('inv-model').value : '').trim(),
      brand: (document.getElementById('inv-brand') ? document.getElementById('inv-brand').value : '').trim(),
      supplier: (document.getElementById('inv-supplier') ? document.getElementById('inv-supplier').value : '').trim(),
      costUnit: document.getElementById('inv-cost') ? document.getElementById('inv-cost').value : 0,
      initialStock: parseInt(document.getElementById('inv-stock') ? document.getElementById('inv-stock').value : 0) || 0,
      minQuantity: parseInt(document.getElementById('inv-min') ? document.getElementById('inv-min').value : 1) || 1,
      plants: selectedPlants
    }, user);
    modal.remove();
    NotifSystem.toast('success', 'Articulo agregado', 'Registrado en el almacen.');
    App.renderSection('requisitions');
  });
}

// ============================================================
// ADJUST STOCK MODAL
// ============================================================
function openAdjustStockModal(invId) {
  var item = DB.Inventory.getById(invId);
  if (!item) return;
  var plants = DB.Plants.getActive().filter(function(p){ return item.plants.includes(p.id); });

  var stockRows = plants.map(function(p){
    var stock = DB.Inventory.getStockForPlant(item, p.id);
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-secondary);border-radius:8px">' +
      '<span style="font-size:13px;font-weight:600">' + p.name + '</span>' +
      '<span style="font-weight:800;color:var(--accent-blue)">' + stock + ' uds</span></div>';
  }).join('');

  var plantOptions = plants.map(function(p){ return '<option value="' + p.id + '">' + p.name + '</option>'; }).join('');

  var html = '<div class="modal" style="max-width:420px">' +
    '<div class="modal-header"><div class="modal-title">Ajustar Stock: ' + item.name + '</div>' +
      '<button class="modal-close" onclick="document.getElementById(\'adj-stock-modal-overlay\').remove()">&#10005;</button></div>' +
    '<div style="padding:20px 24px">' +
      '<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:16px">' + stockRows + '</div>' +
      '<div class="form-group mb-12"><label class="form-label">Planta</label>' +
        '<select id="adj-plant" class="form-select">' + plantOptions + '</select></div>' +
      '<div class="form-group mb-12"><label class="form-label">Ajuste (+ entrada, - salida)</label>' +
        '<input type="number" id="adj-delta" class="form-input" placeholder="Ej: 5 o -2" value="0"></div>' +
      '<div class="form-group mb-0"><label class="form-label">Motivo <span class="required">*</span></label>' +
        '<input type="text" id="adj-reason" class="form-input" required placeholder="Ej: Recepcion de pedido..."></div>' +
    '</div>' +
    '<div class="modal-footer">' +
      '<button class="btn btn-ghost" onclick="document.getElementById(\'adj-stock-modal-overlay\').remove()">Cancelar</button>' +
      '<button class="btn btn-primary" onclick="saveStockAdjustment(\'' + invId + '\')">Aplicar Ajuste</button>' +
    '</div></div>';

  var existing = document.getElementById('adj-stock-modal-overlay');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'adj-stock-modal-overlay';
  modal.innerHTML = html;
  document.body.appendChild(modal);
  modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });
}

function saveStockAdjustment(invId) {
  var plantId = document.getElementById('adj-plant') ? document.getElementById('adj-plant').value : '';
  var delta = parseInt(document.getElementById('adj-delta') ? document.getElementById('adj-delta').value : 0) || 0;
  var reason = (document.getElementById('adj-reason') ? document.getElementById('adj-reason').value : '').trim();
  if (!reason) { NotifSystem.toast('error', 'Falta motivo', 'Ingresa el motivo del ajuste.'); return; }
  if (delta === 0) { NotifSystem.toast('error', 'Sin cambio', 'El ajuste es 0.'); return; }
  DB.Inventory.adjustQuantity(invId, plantId, delta, reason, Auth.currentUser);
  var overlay = document.getElementById('adj-stock-modal-overlay');
  if (overlay) overlay.remove();
  NotifSystem.toast('success', 'Stock Actualizado', (delta > 0 ? '+' : '') + delta + ' unidades');
  App.renderSection('requisitions');
}

function deleteInventoryItem(id) {
  if (!confirm('Eliminar este articulo del almacen?')) return;
  DB.Inventory.delete(id, Auth.currentUser);
  NotifSystem.toast('info', 'Eliminado', '');
  App.renderSection('requisitions');
}

// ============================================================
// GLOBAL EXPORTS
// ============================================================
window.renderRequisitionsView = renderRequisitionsView;
window.setReqTab = setReqTab;
window.applyReqFilters = applyReqFilters;
window.toggleReqHistory = toggleReqHistory;
window.openPlannerModal = openPlannerModal;
window.advanceReqStep = advanceReqStep;
window.savePlannerUpdate = savePlannerUpdate;
window.reqQuickApprove = reqQuickApprove;
window.reqQuickReject = reqQuickReject;
window.deleteReq = deleteReq;
window.openNewReqModal = openNewReqModal;
window.setReqSource = setReqSource;
window.onReqInvChange = onReqInvChange;
window.openNewInventoryModal = openNewInventoryModal;
window.openAdjustStockModal = openAdjustStockModal;
window.saveStockAdjustment = saveStockAdjustment;
window.deleteInventoryItem = deleteInventoryItem;
