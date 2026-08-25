// ============================================================
// DATA LAYER - localStorage CRUD + SOMAC Data Model
// ============================================================

const DB_KEYS = {
  USERS:     'mtto_users',
  REPORTS:   'mtto_reports',
  MACHINES:  'mtto_machines',
  PLANTS:    'mtto_plants',
  AUDIT_LOG: 'mtto_audit_log',
  CONFIG:    'mtto_config',
  NOTIFICATIONS: 'mtto_notifications',
  PM_TICKETS: 'mtto_pm_tickets',
  REQUISITIONS: 'mtto_requisitions',
  INVENTORY: 'mtto_inventory',
};

// ---- Helpers ------------------------------------------------
const db = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(key)) || null; }
    catch { return null; }
  },
  set(key, val, fromRemote = false) {
    localStorage.setItem(key, JSON.stringify(val));
    try {
      window.dispatchEvent(new CustomEvent('somac:data-changed', { detail: { key } }));
    } catch (e) {}
    if (!fromRemote && window.FirebaseSync && window.FirebaseSync.isConnected && window.FirebaseSync.isConnected()) {
      window.FirebaseSync.saveKey(key, val);
    }
  },
  update(key, fn) {
    const current = db.get(key);
    db.set(key, fn(current));
  },
};

function generateId(prefix = 'ID') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7).toUpperCase()}`;
}

function now() { return new Date().toISOString(); }

// Helper to get next Sunday ISO date
function getNextSunday(fromDate = new Date()) {
  const d = new Date(fromDate);
  const day = d.getDay();
  const diff = (7 - day) % 7 || 7; // days to next Sunday
  d.setDate(d.getDate() + diff);
  d.setHours(8, 0, 0, 0); // 8:00 AM on Sunday
  return d.toISOString().slice(0, 10);
}

// ---- Seed Data (Clean Production Zero-State) -----------------
function seedDatabase() {
  // Essential Base Users: Admin & TV
  const baseUsers = [
    { id: 'user-adm1', username: 'admin', password: 'admin123', name: 'Administrador SOMAC', role: 'admin', plantId: 'ambas', email: 'admin@danfoss.com', active: true, createdAt: now() },
    { id: 'user-tv', username: 'tv', password: 'tv', name: 'Pantalla Informativa (TV)', role: 'display', plantId: 'ambas', email: 'tv@danfoss.com', active: true, createdAt: now() }
  ];

  const existingUsers = db.get(DB_KEYS.USERS);
  if (!existingUsers || !Array.isArray(existingUsers) || existingUsers.length === 0) {
    db.set(DB_KEYS.USERS, baseUsers);
  } else {
    // Make sure base admin and tv users exist, but keep all custom users intact!
    let modified = false;
    baseUsers.forEach(bu => {
      if (!existingUsers.some(u => u.username.toLowerCase() === bu.username.toLowerCase())) {
        existingUsers.push(bu);
        modified = true;
      }
    });
    if (modified) {
      db.set(DB_KEYS.USERS, existingUsers);
    }
  }

  // Initial Plants Data
  if (!db.get(DB_KEYS.PLANTS)) {
    db.set(DB_KEYS.PLANTS, [
      { id: 'plant-1', name: 'Planta 1', location: 'Norte', defaultHoursPerDay: 24, defaultHoursPerWeek: 168, active: true },
      { id: 'plant-2', name: 'Planta 2', location: 'Sur', defaultHoursPerDay: 24, defaultHoursPerWeek: 168, active: true },
    ]);
  }

  // Initial Machines Data
  if (!db.get(DB_KEYS.MACHINES)) {
    db.set(DB_KEYS.MACHINES, [
      { id: 'mach-1', name: 'Compresor Atlas C-01', area: 'Área A', plantId: 'plant-1', plantName: 'Planta 1', hoursPerDay: 24, hoursPerWeek: 168, active: true },
      { id: 'mach-2', name: 'Prensa Hidráulica PH-200', area: 'Área B', plantId: 'plant-1', plantName: 'Planta 1', hoursPerDay: 24, hoursPerWeek: 168, active: true },
      { id: 'mach-3', name: 'Banda Transportadora BT-05', area: 'Línea 1', plantId: 'plant-1', plantName: 'Planta 1', hoursPerDay: 16, hoursPerWeek: 96, active: true },
      { id: 'mach-4', name: 'Extrusora EX-3000', area: 'Línea 2', plantId: 'plant-2', plantName: 'Planta 2', hoursPerDay: 24, hoursPerWeek: 168, active: true },
      { id: 'mach-5', name: 'Robot Soldador RS-01', area: 'Celda A', plantId: 'plant-2', plantName: 'Planta 2', hoursPerDay: 24, hoursPerWeek: 168, active: true },
      { id: 'mach-6', name: 'Caldera Industrial CI-02', area: 'Cuarto de Máquinas', plantId: 'plant-2', plantName: 'Planta 2', hoursPerDay: 24, hoursPerWeek: 168, active: true },
    ]);
  }

  if (!db.get(DB_KEYS.CONFIG)) {
    db.set(DB_KEYS.CONFIG, {
      slaMinutes: 60,
      slaEnabled: true,
      companyName: 'SOMAC · Danfoss',
      escalationText: '🚨 ALERTA: Falla en {machine} sigue sin atención después de {minutes} minutos.',
    });
  }

  if (!db.get(DB_KEYS.REPORTS)) db.set(DB_KEYS.REPORTS, []);
  if (!db.get(DB_KEYS.PM_TICKETS)) db.set(DB_KEYS.PM_TICKETS, []);
  if (!db.get(DB_KEYS.REQUISITIONS)) db.set(DB_KEYS.REQUISITIONS, []);
  if (!db.get(DB_KEYS.AUDIT_LOG)) db.set(DB_KEYS.AUDIT_LOG, []);
  if (!db.get(DB_KEYS.INVENTORY)) db.set(DB_KEYS.INVENTORY, []);
}

// ---- Plants -------------------------------------------------
const Plants = {
  getAll() { return db.get(DB_KEYS.PLANTS) || []; },
  getActive() { return this.getAll().filter(p => p.active !== false); },
  getById(id) { return this.getAll().find(p => p.id === id) || null; },
  create(data, user) {
    const plants = this.getAll();
    const newPlant = {
      id: `plant-${Date.now()}`,
      name: data.name,
      location: data.location || '',
      defaultHoursPerDay: parseInt(data.defaultHoursPerDay) || 24,
      defaultHoursPerWeek: parseInt(data.defaultHoursPerWeek) || 168,
      active: true
    };
    db.set(DB_KEYS.PLANTS, [...plants, newPlant]);
    Audit.log('PLANT_CREATED', user ? user.name : 'Sistema', `Planta ${newPlant.name} creada`);
    return newPlant;
  },
  update(id, data, user) {
    db.update(DB_KEYS.PLANTS, ps => (ps || []).map(p => p.id === id ? { ...p, ...data } : p));
    Audit.log('PLANT_UPDATED', user ? user.name : 'Sistema', `Planta ${id} actualizada`);
  },
  delete(id, user) {
    db.update(DB_KEYS.PLANTS, ps => (ps || []).filter(p => p.id !== id));
    Audit.log('PLANT_DELETED', user ? user.name : 'Sistema', `Planta ${id} eliminada`);
  }
};

// ---- Machines -----------------------------------------------
const Machines = {
  getAll() { return db.get(DB_KEYS.MACHINES) || []; },
  getActive() { return this.getAll().filter(m => m.active !== false); },
  getByPlant(plantId) {
    if (!plantId || plantId === 'ambas') return this.getActive();
    return this.getActive().filter(m => m.plantId === plantId);
  },
  getById(id) { return this.getAll().find(m => m.id === id) || null; },
  create(data, user) {
    const machines = this.getAll();
    const plant = Plants.getById(data.plantId);
    const newMachine = {
      id: `mach-${Date.now()}`,
      name: data.name,
      area: data.area || 'General',
      plantId: data.plantId,
      plantName: plant ? plant.name : (data.plantId === 'plant-2' ? 'Planta 2' : 'Planta 1'),
      hoursPerDay: parseInt(data.hoursPerDay) || (plant ? plant.defaultHoursPerDay : 24),
      hoursPerWeek: parseInt(data.hoursPerWeek) || (plant ? plant.defaultHoursPerWeek : 168),
      serialNumber: data.serialNumber || '',
      active: true
    };
    db.set(DB_KEYS.MACHINES, [...machines, newMachine]);
    Audit.log('MACHINE_CREATED', user ? user.name : 'Sistema', `Máquina ${newMachine.name} creada en ${newMachine.plantName}`);
    return newMachine;
  },
  update(id, data, user) {
    db.update(DB_KEYS.MACHINES, ms => (ms || []).map(m => {
      if (m.id !== id) return m;
      const plant = data.plantId ? Plants.getById(data.plantId) : Plants.getById(m.plantId);
      return {
        ...m,
        ...data,
        plantName: plant ? plant.name : m.plantName
      };
    }));
    Audit.log('MACHINE_UPDATED', user ? user.name : 'Sistema', `Máquina ${id} actualizada`);
  },
  delete(id, user) {
    db.update(DB_KEYS.MACHINES, ms => (ms || []).filter(m => m.id !== id));
    Audit.log('MACHINE_DELETED', user ? user.name : 'Sistema', `Máquina ${id} eliminada`);
  }
};

// ---- Users --------------------------------------------------
const Users = {
  getAll() { return db.get(DB_KEYS.USERS) || []; },
  getActive() { return this.getAll().filter(u => u.active !== false); },
  getById(id) { return this.getAll().find(u => u.id === id) || null; },
  getByUsername(uname) { return this.getAll().find(u => u.username.toLowerCase() === uname.toLowerCase()) || null; },
  getByPlant(plantId) {
    if (!plantId || plantId === 'ambas') return this.getActive();
    return this.getActive().filter(u => u.plantId === plantId || u.plantId === 'ambas');
  },
  login(username, password) {
    let user = this.getByUsername(username);
    if (!user) {
      // Auto-sync seed database in case new accounts were registered
      seedDatabase();
      user = this.getByUsername(username);
    }
    if (user && user.password === password && user.active !== false) {
      return user;
    }
    return null;
  },
  create(data, user) {
    const users = this.getAll();
    if (users.some(u => u.username.toLowerCase() === data.username.toLowerCase())) {
      throw new Error('El nombre de usuario ya existe');
    }
    const newUser = {
      id: `user-${Date.now()}`,
      username: data.username.trim(),
      password: data.password,
      name: data.name,
      role: data.role, // 'sup_op'|'tecnico'|'sup_mtto'|'planeador'|'programador'|'admin'
      plantId: data.plantId || 'plant-1', // 'plant-1'|'plant-2'|'ambas'
      email: data.email || '',
      active: true,
      createdAt: now()
    };
    db.set(DB_KEYS.USERS, [...users, newUser]);
    Audit.log('USER_CREATED', user ? user.name : 'Sistema', `Usuario ${newUser.username} (${newUser.role}) creado`);
    return newUser;
  },
  update(id, data, user) {
    db.update(DB_KEYS.USERS, us => (us || []).map(u => u.id === id ? { ...u, ...data } : u));
    Audit.log('USER_UPDATED', user ? user.name : 'Sistema', `Usuario ${id} actualizado`);
  },
  delete(id, user) {
    db.update(DB_KEYS.USERS, us => (us || []).filter(u => u.id !== id));
    Audit.log('USER_DELETED', user ? user.name : 'Sistema', `Usuario ${id} eliminado`);
  }
};

// ---- Reports ------------------------------------------------
const Reports = {
  getAll() { return db.get(DB_KEYS.REPORTS) || []; },
  getById(id) { return this.getAll().find(r => r.id === id) || null; },
  getByStatus(status) { return this.getAll().filter(r => r.status === status); },
  getByPlant(plantId) {
    if (!plantId || plantId === 'ambas') return this.getAll();
    return this.getAll().filter(r => r.plantId === plantId);
  },
  getByUserPlant(user) {
    if (!user) return this.getAll();
    if (['admin', 'planeador', 'programador'].includes(user.role) || user.plantId === 'ambas') {
      return this.getAll();
    }
    return this.getAll().filter(r => r.plantId === user.plantId);
  },

  create(data, user) {
    const all = this.getAll();

    // Anti-double-click deduplication check (within 8 seconds)
    const recentDuplicate = all.find(r =>
      r.machineId === data.machineId &&
      r.description === data.description &&
      (r.createdById === user.id || r.createdBy === user.id) &&
      (Date.now() - new Date(r.t0).getTime()) < 8000
    );
    if (recentDuplicate) {
      return recentDuplicate;
    }

    const count = all.length + 1;
    const reportId = `REP-${String(count).padStart(4, '0')}`;
    const machine = Machines.getById(data.machineId);
    const plant = machine ? Plants.getById(machine.plantId) : null;

    const report = {
      id: reportId,
      reportNumber: count,
      machineId: data.machineId,
      machineName: machine ? machine.name : (data.machineName || 'Equipo N/A'),
      plantId: machine ? machine.plantId : (data.plantId || user.plantId || 'plant-1'),
      plantName: plant ? plant.name : (data.plantName || 'Planta 1'),
      area: machine ? machine.area : (data.area || 'General'),
      description: data.description,
      totalStop: !!data.totalStop,
      t0: now(),
      t1: null,
      t2: null,
      t3: null,
      status: 'open', // 'open' | 'working' | 'pending' | 'closed'
      createdBy: user.id,
      createdById: user.id,
      createdByName: user.name,
      createdByRole: user.role,
      technicianId: null,
      technicianName: null,
      workDescription: '',
      rootCause: '',
      materials: '',
      supervisorNotes: '',
      hasPendingActivity: false,
      pendingActivityId: null,
      updatedAt: now()
    };

    db.set(DB_KEYS.REPORTS, [report, ...all]);
    Audit.log('REPORT_CREATED', user.name, `Reporte ${reportId} creado para ${report.machineName} (${report.plantName})`);
    return report;
  },

  claimReport(reportId, technicianUser) {
    let claimedReport = null;
    db.update(DB_KEYS.REPORTS, rs => (rs || []).map(r => {
      if (r.id !== reportId) return r;
      if (r.status !== 'open') return r; // Already claimed
      claimedReport = {
        ...r,
        status: 'working',
        technicianId: technicianUser.id,
        technicianName: technicianUser.name,
        t1: r.t1 || now(),
        updatedAt: now()
      };
      return claimedReport;
    }));
    if (claimedReport) {
      Audit.log('REPORT_CLAIMED', technicianUser.name, `Reporte ${reportId} tomado por ${technicianUser.name}`);
    }
    return claimedReport;
  },

  reassignTechnician(reportId, newTechnician, user) {
    db.update(DB_KEYS.REPORTS, rs => (rs || []).map(r => {
      if (r.id !== reportId) return r;
      return {
        ...r,
        technicianId: newTechnician.id,
        technicianName: newTechnician.name,
        updatedAt: now()
      };
    }));
    Audit.log('REPORT_REASSIGNED', user.name, `Reporte ${reportId} reasignado a ${newTechnician.name}`);
  },

  closeIntervention(reportId, data, user) {
    let closedReport = null;
    let pmTicket = null;

    db.update(DB_KEYS.REPORTS, rs => (rs || []).map(r => {
      if (r.id !== reportId) return r;

      // Handle T2 timestamp: editable datetime-local format or fallback to now ISO
      let t2Iso = now();
      if (data.t2) {
        try {
          const parsed = new Date(data.t2);
          if (!isNaN(parsed.getTime())) t2Iso = parsed.toISOString();
        } catch { t2Iso = now(); }
      }

      closedReport = {
        ...r,
        status: 'pending', // Pending supervisor signoff
        workDescription: data.workDescription || '',
        rootCause: data.rootCause || '',
        materials: data.materials || '',
        t2: t2Iso,
        hasPendingActivity: !!data.hasPendingActivity,
        updatedAt: now()
      };

      return closedReport;
    }));

    // If technician requested a pending activity
    if (closedReport && data.hasPendingActivity && data.pendingDescription) {
      pmTicket = PMTickets.createFromReport(closedReport, data.pendingDescription, data.pendingPriority || 'media', user);
      db.update(DB_KEYS.REPORTS, rs => (rs || []).map(r => r.id === reportId ? { ...r, pendingActivityId: pmTicket.id } : r));
    }

    // Auto-create requisition if materials were recorded
    if (closedReport && data.materials && data.materials.trim().length > 0) {
      Requisitions.createAutoRestock(closedReport, data.materials, user);
    }

    Audit.log('REPORT_INTERVENTION_CLOSED', user.name, `Intervención del reporte ${reportId} completada. Pendiente de firma.`);
    return closedReport;
  },

  signReport(reportId, supervisorNotes, supervisorUser) {
    let signed = null;
    db.update(DB_KEYS.REPORTS, rs => (rs || []).map(r => {
      if (r.id !== reportId) return r;
      signed = {
        ...r,
        status: 'closed',
        supervisorNotes: supervisorNotes || '',
        t3: now(),
        supervisorName: supervisorUser.name,
        updatedAt: now()
      };
      return signed;
    }));
    Audit.log('REPORT_SIGNED', supervisorUser.name, `Visto bueno otorgado para ${reportId}`);
    return signed;
  },

  update(id, data, user) {
    db.update(DB_KEYS.REPORTS, rs => (rs || []).map(r => r.id === id ? { ...r, ...data, updatedAt: now() } : r));
    Audit.log('REPORT_UPDATED', user ? user.name : 'Sistema', `Reporte ${id} editado por admin`);
  },

  delete(id, user) {
    db.update(DB_KEYS.REPORTS, rs => (rs || []).filter(r => r.id !== id));
    Audit.log('REPORT_DELETED', user ? user.name : 'Sistema', `Reporte ${id} eliminado`);
  }
};

// ---- PM Tickets -------------------------------------------
const PMTickets = {
  getAll() {
    return db.get(DB_KEYS.PM_TICKETS) || [];
  },

  getByStatus(status) {
    return this.getAll().filter(t => t.status === status);
  },

  getByMachine(machineId) {
    return this.getAll().filter(t => t.machineId === machineId);
  },

  getByUserPlant(user) {
    if (!user) return this.getAll();
    if (['admin', 'planeador', 'programador'].includes(user.role) || user.plantId === 'ambas') {
      return this.getAll();
    }
    return this.getAll().filter(t => t.plantId === user.plantId);
  },

  createFromReport(report, description, priority, user) {
    const all = this.getAll();
    const num = all.length + 1;
    const cleanPriority = ['alta', 'media', 'baja'].includes(priority) ? priority : 'media';

    const ticket = {
      id: `PM-${String(num).padStart(4, '0')}`,
      reportId: report.id,
      machineId: report.machineId,
      machineName: report.machineName,
      plantId: report.plantId,
      plantName: report.plantName,
      activity: description,
      scheduledDate: null,
      priority: cleanPriority,
      status: 'pendiente', // 'pendiente' (Por Asignar) | 'en-revision' (Asignado) | 'incorporado' (Completado) | 'cancelado'
      assignedTechIds: [],
      assignedTechNames: [],
      createdBy: user.id,
      createdByName: user.name,
      createdAt: now(),
      updatedAt: now(),
      comments: []
    };

    db.set(DB_KEYS.PM_TICKETS, [ticket, ...all]);
    Audit.log('PM_TICKET_CREATED', user.name, `Actividad pendiente ${ticket.id} (${cleanPriority.toUpperCase()}) creada para ${ticket.machineName}`);
    return ticket;
  },

  createManual(data, user) {
    const all = this.getAll();
    const num = all.length + 1;
    const ticket = {
      id: `PM-${String(num).padStart(4, '0')}`,
      reportId: null,
      machineId: data.machineId,
      machineName: data.machineName,
      plantId: data.plantId,
      plantName: data.plantName || 'Planta 1',
      activity: data.activity,
      scheduledDate: data.scheduledDate || getNextSunday(),
      priority: data.priority || 'media',
      status: 'pendiente',
      assignedTechIds: data.assignedTechIds || [],
      assignedTechNames: data.assignedTechNames || [],
      createdBy: user.id,
      createdByName: user.name,
      createdAt: now(),
      updatedAt: now(),
      comments: []
    };
    db.set(DB_KEYS.PM_TICKETS, [ticket, ...all]);
    Audit.log('PM_TICKET_CREATED', user.name, `Ticket PM ${ticket.id} programado manualmente`);
    return ticket;
  },

  assignTechnicians(id, techIds, user) {
    const allTechs = Users.getAll();
    const selectedTechs = allTechs.filter(u => techIds.includes(u.id));
    const names = selectedTechs.map(t => t.name);

    db.update(DB_KEYS.PM_TICKETS, ts => (ts || []).map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        assignedTechIds: techIds,
        assignedTechNames: names,
        status: techIds.length > 0 ? 'en-revision' : 'pendiente',
        updatedAt: now(),
        comments: [...(t.comments || []), {
          user: user.name,
          text: `Técnicos asignados: ${names.join(', ') || 'Ninguno'}`,
          timestamp: now()
        }]
      };
    }));
    Audit.log('PM_TICKET_ASSIGNED', user.name, `Ticket ${id} asignado a: ${names.join(', ')}`);
  },

  updateStatus(id, newStatus, user, note = '') {
    db.update(DB_KEYS.PM_TICKETS, ts => (ts || []).map(t => {
      if (t.id !== id) return t;
      return {
        ...t,
        status: newStatus,
        updatedAt: now(),
        comments: [...(t.comments || []), {
          user: user.name,
          text: note || `Estado cambiado a: ${newStatus}`,
          timestamp: now()
        }]
      };
    }));
    Audit.log('PM_TICKET_STATUS', user.name, `Ticket ${id} → ${newStatus}`);
  },

  delete(id, user) {
    db.update(DB_KEYS.PM_TICKETS, ts => (ts || []).filter(t => t.id !== id));
    Audit.log('PM_TICKET_DELETED', user ? user.name : 'Sistema', `Ticket PM ${id} eliminado`);
  }
};

// ---- Requisitions -----------------------------------------
const Requisitions = {
  getAll() { return db.get(DB_KEYS.REQUISITIONS) || []; },
  getById(id) { return this.getAll().find(r => r.id === id) || null; },
  getByUserPlant(user) {
    if (!user) return this.getAll();
    if (['admin', 'planeador', 'programador'].includes(user.role) || user.plantId === 'ambas') {
      return this.getAll();
    }
    const machines = Machines.getByPlant(user.plantId).map(m => m.id);
    return this.getAll().filter(r => machines.includes(r.machineId) || !r.machineId);
  },

  create(data, user) {
    const all = this.getAll();
    const num = all.length + 1;
    const initialStatus = data.isAutoRestock ? 'aprobada' : 'pendiente_aprobacion';
    const req = {
      id: `REQ-${String(num).padStart(4,'0')}`,
      item: data.item,
      quantity: data.quantity || 1,
      machineId: data.machineId || '',
      machineName: data.machineName || '',
      urgency: data.urgency || 'normal',
      reason: data.reason || '',
      isAutoRestock: !!data.isAutoRestock,
      reportId: data.reportId || null,
      inventoryItemId: data.inventoryItemId || null,
      status: initialStatus,
      deliveryDate: null,
      cost: null,
      supplier: '',
      statusHistory: [{ status: initialStatus, date: now(), updatedBy: user.name }],
      createdBy: user.id,
      createdByName: user.name,
      createdAt: now(),
      updatedAt: now()
    };
    db.set(DB_KEYS.REQUISITIONS, [req, ...all]);
    Audit.log('REQUISITION_CREATED', user.name, `Requisición ${req.id} creada: ${req.item}`);
    return req;
  },

  createAutoRestock(report, materialsText, user) {
    if (!materialsText) return;
    this.create({
      item: `Refacciones usadas: ${materialsText}`,
      quantity: 1,
      machineId: report.machineId,
      machineName: report.machineName,
      urgency: 'normal',
      reason: `Reposición de material derivado del reporte ${report.id}`,
      isAutoRestock: true,
      reportId: report.id
    }, user);
  },

  updateStatus(id, newStatus, user) {
    db.update(DB_KEYS.REQUISITIONS, rs => (rs || []).map(r => {
      if (r.id !== id) return r;
      const history = r.statusHistory || [];
      return { ...r, status: newStatus, updatedAt: now(), statusHistory: [...history, { status: newStatus, date: now(), updatedBy: user.name }] };
    }));
    Audit.log('REQUISITION_STATUS', user.name, `Requisición ${id} → ${newStatus}`);
  },

  updateFull(id, { status, deliveryDate, cost, supplier, note }, user) {
    db.update(DB_KEYS.REQUISITIONS, rs => (rs || []).map(r => {
      if (r.id !== id) return r;
      const history = r.statusHistory || [];
      const histEntry = { status: status || r.status, date: now(), updatedBy: user.name };
      if (note) histEntry.note = note;
      return {
        ...r,
        status: status || r.status,
        deliveryDate: deliveryDate !== undefined ? deliveryDate : r.deliveryDate,
        cost: cost !== undefined ? cost : r.cost,
        supplier: supplier !== undefined ? supplier : r.supplier,
        updatedAt: now(),
        statusHistory: (status && status !== r.status) ? [...history, histEntry] : history
      };
    }));
    Audit.log('REQUISITION_UPDATED', user.name, `Requisición ${id} actualizada`);
  },

  delete(id, user) {
    db.update(DB_KEYS.REQUISITIONS, rs => (rs || []).filter(r => r.id !== id));
    Audit.log('REQUISITION_DELETED', user ? user.name : 'Sistema', `Requisición ${id} eliminada`);
  }
};

// ---- Inventory (Almacén) ------------------------------------
const Inventory = {
  getAll() { return db.get(DB_KEYS.INVENTORY) || []; },
  getById(id) { return this.getAll().find(i => i.id === id) || null; },

  // Returns items available for a given plant (plantId = specific plant or 'ambas')
  getByPlant(plantId) {
    const all = this.getAll();
    if (!plantId || plantId === 'ambas') return all;
    return all.filter(i => i.plants.includes(plantId) || i.plants.includes('ambas'));
  },

  // Returns items that have stock > 0 for a given plant
  getInStockByPlant(plantId) {
    return this.getByPlant(plantId).filter(i => this.getStockForPlant(i, plantId) > 0);
  },

  getStockForPlant(item, plantId) {
    if (!item.stockByPlant) return 0;
    if (plantId === 'ambas') {
      return Object.values(item.stockByPlant).reduce((a, b) => a + b, 0);
    }
    return item.stockByPlant[plantId] || 0;
  },

  create(data, user) {
    const all = this.getAll();
    const num = all.length + 1;
    // Build initial stock by plant
    const stockByPlant = {};
    const plants = data.plants || ['plant-1', 'plant-2'];
    plants.forEach(p => { stockByPlant[p] = data.initialStock || 0; });

    const item = {
      id: `INV-${String(num).padStart(4,'0')}`,
      name: data.name,
      model: data.model || '',
      brand: data.brand || '',
      supplier: data.supplier || '',
      costUnit: parseFloat(data.costUnit) || 0,
      plants,
      stockByPlant,
      minQuantity: parseInt(data.minQuantity) || 1,
      active: true,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: now(),
      updatedAt: now(),
      movementLog: []
    };
    db.set(DB_KEYS.INVENTORY, [item, ...all]);
    Audit.log('INVENTORY_CREATED', user.name, `Artículo ${item.id}: ${item.name}`);
    return item;
  },

  adjustQuantity(id, plantId, delta, reason, user) {
    db.update(DB_KEYS.INVENTORY, items => (items || []).map(i => {
      if (i.id !== id) return i;
      const stockByPlant = { ...(i.stockByPlant || {}) };
      stockByPlant[plantId] = Math.max(0, (stockByPlant[plantId] || 0) + delta);
      const entry = { date: now(), plantId, delta, reason, user: user ? user.name : 'Sistema', balanceBefore: (i.stockByPlant[plantId] || 0) };
      return { ...i, stockByPlant, updatedAt: now(), movementLog: [entry, ...(i.movementLog || [])].slice(0, 100) };
    }));
    Audit.log('INVENTORY_ADJUSTED', user ? user.name : 'Sistema', `${id} → ${delta > 0 ? '+' : ''}${delta} en ${plantId}: ${reason}`);
  },

  delete(id, user) {
    db.update(DB_KEYS.INVENTORY, items => (items || []).filter(i => i.id !== id));
    Audit.log('INVENTORY_DELETED', user ? user.name : 'Sistema', `Artículo ${id} eliminado`);
  }
};

// ---- Config -------------------------------------------------
const Config = {
  get() {
    return db.get(DB_KEYS.CONFIG) || {
      slaMinutes: 60,
      slaEnabled: true,
      companyName: 'SOMAC · Danfoss',
      escalationText: '🚨 ALERTA: Falla en {machine} sigue sin atención.',
    };
  },
  set(newCfg) {
    const current = this.get();
    db.set(DB_KEYS.CONFIG, { ...current, ...newCfg });
  },
  getSLA() { return this.get().slaMinutes || 60; }
};

// ---- Audit --------------------------------------------------
const Audit = {
  log(action, username, details) {
    const log = db.get(DB_KEYS.AUDIT_LOG) || [];
    const entry = {
      id: generateId('AUD'),
      action,
      username: username || 'Sistema',
      details,
      timestamp: now()
    };
    db.set(DB_KEYS.AUDIT_LOG, [entry, ...log].slice(0, 500));
  },
  getAll() { return db.get(DB_KEYS.AUDIT_LOG) || []; }
};

// ---- Analytics & KPIs --------------------------------------
const Analytics = {

  // Period Date Range Filter Helper
  getPeriodRange(period = 'diario', customStart = null, customEnd = null) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (period === 'diario') {
      // 6:00 AM today to 5:59 AM tomorrow
      start.setHours(6, 0, 0, 0);
      if (now < start) {
        start.setDate(start.getDate() - 1);
      }
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      end.setMilliseconds(-1);
    } else if (period === 'semanal') {
      // Monday 6:00 AM to next Monday 5:59 AM
      const day = start.getDay();
      const diffToMonday = (day === 0 ? -6 : 1 - day);
      start.setDate(start.getDate() + diffToMonday);
      start.setHours(6, 0, 0, 0);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      end.setMilliseconds(-1);
    } else if (period === 'mensual') {
      // 1st of month 0:00 to last day 23:59
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'personalizado' && customStart && customEnd) {
      start = new Date(customStart);
      end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
    } else {
      // Default: Last 30 days
      start.setDate(start.getDate() - 30);
    }

    return { start, end };
  },

  filterReportsByPeriod(reports, period = 'diario', customStart = null, customEnd = null) {
    const { start, end } = this.getPeriodRange(period, customStart, customEnd);
    return reports.filter(r => {
      if (!r.t0) return false;
      const t = new Date(r.t0);
      return t >= start && t <= end;
    });
  },

  getMTTR(reports) {
    // T2 - T1 (using manual equipment delivery time T2)
    const valid = reports.filter(r => r.t1 && r.t2);
    if (!valid.length) return 0;
    const totalMs = valid.reduce((sum, r) => {
      const ms = new Date(r.t2) - new Date(r.t1);
      return sum + (ms > 0 ? ms : 0);
    }, 0);
    return totalMs / valid.length; // milliseconds
  },

  getMTBF(reports) {
    const byMachine = {};
    reports
      .filter(r => r.t0)
      .forEach(r => {
        const key = r.machineId || r.machineName;
        if (!byMachine[key]) byMachine[key] = [];
        byMachine[key].push(new Date(r.t0).getTime());
      });

    const gaps = [];
    Object.values(byMachine).forEach(times => {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        gaps.push(times[i] - times[i - 1]);
      }
    });

    if (!gaps.length) return 0;
    return gaps.reduce((s, g) => s + g, 0) / gaps.length;
  },

  getResponseTime(reports) {
    const valid = reports.filter(r => r.t0 && r.t1);
    if (!valid.length) return 0;
    const totalMs = valid.reduce((sum, r) => {
      const ms = new Date(r.t1) - new Date(r.t0);
      return sum + (ms > 0 ? ms : 0);
    }, 0);
    return totalMs / valid.length;
  },

  // Plant Availability KPI: (Available Hours - Downtime Hours) / Available Hours * 100
  getAvailabilityByPlant(plantId, period = 'diario', customStart = null, customEnd = null) {
    const { start, end } = this.getPeriodRange(period, customStart, customEnd);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

    const machines = Machines.getByPlant(plantId);
    if (!machines.length) return { availabilityPct: 100, downtimeHours: 0, availableHours: 0, machineCount: 0 };

    let totalAvailableHours = 0;
    machines.forEach(m => {
      const dailyHours = m.hoursPerDay || 24;
      totalAvailableHours += dailyHours * days;
    });

    const allReports = Reports.getAll();
    const periodReports = this.filterReportsByPeriod(allReports, period, customStart, customEnd)
      .filter(r => (plantId === 'ambas' || r.plantId === plantId));

    // Calculate total downtime (T2 - T1 for totalStop or reported downtime)
    let totalDowntimeMs = 0;
    periodReports.forEach(r => {
      if (r.t1 && r.t2) {
        const ms = new Date(r.t2) - new Date(r.t1);
        if (ms > 0) totalDowntimeMs += ms;
      }
    });

    const downtimeHours = totalDowntimeMs / 3600000;
    const availHours = Math.max(0, totalAvailableHours - downtimeHours);
    const availabilityPct = totalAvailableHours > 0 ? Math.min(100, Math.max(0, (availHours / totalAvailableHours) * 100)) : 100;

    return {
      availabilityPct: Math.round(availabilityPct * 10) / 10,
      downtimeHours: Math.round(downtimeHours * 10) / 10,
      availableHours: totalAvailableHours,
      machineCount: machines.length,
      reportsCount: periodReports.length
    };
  },

  // Individual Machine Availability Drill-Down
  getAvailabilityByMachine(plantId, period = 'diario', customStart = null, customEnd = null) {
    const { start, end } = this.getPeriodRange(period, customStart, customEnd);
    const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

    const machines = Machines.getByPlant(plantId);
    const allReports = Reports.getAll();
    const periodReports = this.filterReportsByPeriod(allReports, period, customStart, customEnd);

    return machines.map(m => {
      const availableHours = (m.hoursPerDay || 24) * days;
      const mReports = periodReports.filter(r => r.machineId === m.id);

      let downtimeMs = 0;
      let totalStopCount = 0;

      mReports.forEach(r => {
        if (r.totalStop) totalStopCount++;
        if (r.t1 && r.t2) {
          const ms = new Date(r.t2) - new Date(r.t1);
          if (ms > 0) downtimeMs += ms;
        }
      });

      const downtimeHours = downtimeMs / 3600000;
      const availHours = Math.max(0, availableHours - downtimeHours);
      const availabilityPct = availableHours > 0 ? Math.min(100, Math.max(0, (availHours / availableHours) * 100)) : 100;
      const mttrMs = this.getMTTR(mReports);

      return {
        id: m.id,
        name: m.name,
        area: m.area,
        plantName: m.plantName,
        hoursPerDay: m.hoursPerDay || 24,
        availableHours,
        availabilityPct: Math.round(availabilityPct * 10) / 10,
        downtimeHours: Math.round(downtimeHours * 10) / 10,
        failuresCount: mReports.length,
        totalStopCount,
        mttrMs
      };
    }).sort((a, b) => a.availabilityPct - b.availabilityPct);
  },

  // --- Annual Average (YTD) -----------------------------------
  getAnnualAverage(metric, plantId = 'ambas') {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    const allReports = Reports.getAll().filter(r => {
      if (plantId !== 'ambas' && r.plantId !== plantId) return false;
      if (!r.t0) return false;
      return new Date(r.t0) >= yearStart && new Date(r.t0) <= now;
    });
    if (metric === 'mttr') {
      const ms = this.getMTTR(allReports);
      return ms ? Math.round(ms / 60000) : 0;
    }
    if (metric === 'avail') {
      let total = 0, count = 0;
      for (let m = 0; m <= now.getMonth(); m++) {
        const mS = new Date(now.getFullYear(), m, 1, 0, 0, 0);
        const mE = new Date(now.getFullYear(), m + 1, 0, 23, 59, 59, 999);
        const avail = this.getAvailabilityByPlant(plantId, 'mensual', mS, mE);
        total += avail.availabilityPct; count++;
      }
      return count > 0 ? Math.round((total / count) * 10) / 10 : 100;
    }
    return 0;
  },

  // --- YTD Summary -------------------------------------------
  getYTD(plantId = 'ambas') {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
    const allReports = Reports.getAll().filter(r => {
      if (plantId !== 'ambas' && r.plantId !== plantId) return false;
      if (!r.t0) return false;
      return new Date(r.t0) >= yearStart && new Date(r.t0) <= now;
    });
    const mttrMs = this.getMTTR(allReports);
    return {
      totalFailures: allReports.length,
      mttrMin: mttrMs ? Math.round(mttrMs / 60000) : 0,
      availAvgPct: this.getAnnualAverage('avail', plantId)
    };
  },

  // --- ISO week helpers ----------------------------------------
  _currentISOWeek() { return this._dateToISOWeek(new Date()); },
  _dateToISOWeek(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  },
  _isoWeekRange(year, week) {
    const jan4 = new Date(year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - (dayOfWeek - 1) + (week - 1) * 7);
    monday.setHours(6, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 7);
    sunday.setMilliseconds(-1);
    return { start: monday, end: sunday };
  },
  getRecentISOWeeks(n = 16) {
    const current = this._currentISOWeek();
    const weeks = [];
    for (let i = 0; i < n; i++) { const w = current - i; if (w > 0) weeks.push(w); }
    return weeks;
  },

  // --- Multi-period getTrendDataPoints -------------------------
  getTrendDataPoints(metric, period = 'semanal', plantId = 'ambas', selectedWeeks = [], selectedMonths = []) {
    const allReports = Reports.getAll().filter(r => plantId === 'ambas' || r.plantId === plantId);
    const now = new Date();
    const points = [];

    if (period === 'diario') {
      const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const d = now.getDay();
      const diffToMonday = d === 0 ? -6 : 1 - d;
      const weekMonday = new Date(now);
      weekMonday.setDate(now.getDate() + diffToMonday);
      weekMonday.setHours(6, 0, 0, 0);
      for (let i = 0; i < 7; i++) {
        const dStart = new Date(weekMonday);
        dStart.setDate(weekMonday.getDate() + i);
        dStart.setHours(6, 0, 0, 0);
        const dEnd = new Date(dStart);
        dEnd.setDate(dStart.getDate() + 1);
        dEnd.setMilliseconds(-1);
        const dayReports = allReports.filter(r => r.t0 && new Date(r.t0) >= dStart && new Date(r.t0) <= dEnd);
        let val = 0;
        if (metric === 'mttr') { const ms = this.getMTTR(dayReports); val = ms ? Math.round(ms / 60000) : 0; }
        else if (metric === 'avail') { val = this.getAvailabilityByPlant(plantId, 'mensual', dStart, dEnd).availabilityPct; }
        points.push({ label: dayLabels[i], value: val });
      }
    } else if (period === 'semanal') {
      const weeks = selectedWeeks.length > 0 ? [...selectedWeeks].sort((a,b)=>a-b) : [this._currentISOWeek()];
      weeks.forEach(wNum => {
        const { start: wS, end: wE } = this._isoWeekRange(now.getFullYear(), wNum);
        const weekReports = allReports.filter(r => r.t0 && new Date(r.t0) >= wS && new Date(r.t0) <= wE);
        let val = 0;
        if (metric === 'mttr') { const ms = this.getMTTR(weekReports); val = ms ? Math.round(ms / 60000) : 0; }
        else if (metric === 'avail') { val = this.getAvailabilityByPlant(plantId, 'semanal', wS, wE).availabilityPct; }
        points.push({ label: `Sem ${wNum}`, value: val });
      });
    } else if (period === 'mensual') {
      const monthNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      const currentMonth = now.getMonth();
      const months = selectedMonths.length > 0 ? [...selectedMonths].sort((a,b)=>a-b) : Array.from({length: currentMonth+1}, (_,i)=>i);
      months.forEach(mIdx => {
        const mS = new Date(now.getFullYear(), mIdx, 1, 0, 0, 0);
        const mE = new Date(now.getFullYear(), mIdx + 1, 0, 23, 59, 59, 999);
        const mReports = allReports.filter(r => r.t0 && new Date(r.t0) >= mS && new Date(r.t0) <= mE);
        let val = 0;
        if (metric === 'mttr') { const ms = this.getMTTR(mReports); val = ms ? Math.round(ms / 60000) : 0; }
        else if (metric === 'avail') { val = this.getAvailabilityByPlant(plantId, 'mensual', mS, mE).availabilityPct; }
        points.push({ label: monthNames[mIdx], value: val });
      });
    }
    return points;
  },

  getTopDowntimeMachines(plantId = 'ambas', limit = 3, period = 'mensual') {
    const mAvail = this.getAvailabilityByMachine(plantId, period);
    return mAvail
      .filter(m => m.failuresCount > 0 || m.downtimeHours > 0)
      .sort((a, b) => b.downtimeHours - a.downtimeHours)
      .slice(0, limit);
  },

  getTopRepetitiveFailures(plantId = 'ambas', limit = 3, period = 'mensual') {
    const plantReports = Reports.getByPlant(plantId);
    const filtered = this.filterReportsByPeriod(plantReports, period);
    const counts = {};
    filtered.forEach(r => {
      const key = r.machineId || 'general';
      if (!counts[key]) counts[key] = { machineId: r.machineId, name: r.machineName || 'General', count: 0, lastDesc: '' };
      counts[key].count++;
      counts[key].lastDesc = r.description || '';
    });
    return Object.values(counts)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
};

// ---- Utility ------------------------------------------------
function formatDuration(ms) {
  if (!ms || ms <= 0) return '0m';
  const mins = Math.floor(ms / 60000);
  const hrs  = Math.floor(mins / 60);
  const remM = mins % 60;
  if (hrs > 0) return `${hrs}h ${remM}m`;
  return `${mins}m`;
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-MX', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function getStatusLabel(status) {
  const labels = {
    open: 'Abierto 🔴',
    working: 'En Reparación 🔧',
    pending: 'Pend. Firma ⏳',
    closed: 'Cerrado ✅'
  };
  return labels[status] || status;
}

function getStatusClass(status) {
  const cls = {
    open: 'open',
    working: 'working',
    pending: 'pending',
    closed: 'closed'
  };
  return cls[status] || 'open';
}

function timeSince(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  return formatDuration(ms);
}

function getPlantDisplayName(plantId) {
  if (!plantId || plantId === 'ambas' || plantId === 'todas') return 'Ambas Plantas';
  if (plantId === 'plant-1') return 'Planta 1';
  if (plantId === 'plant-2') return 'Planta 2';
  const p = Plants.getById(plantId);
  return p ? p.name : plantId;
}

// Export Globals
window.Utils = { generateId, now, getNextSunday, formatDuration, formatDateTime, formatDate, formatTime, getStatusLabel, getStatusClass, timeSince, getPlantDisplayName };
window.getPlantDisplayName = getPlantDisplayName;
window.seedDatabase = seedDatabase;

window.DB = {
  db, DB_KEYS, Reports, Machines, Plants, Users,
  Config, Audit, Analytics, PMTickets, Requisitions, Inventory
};

// Auto-seed and sync database on load
seedDatabase();

