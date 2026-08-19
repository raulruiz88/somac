// ============================================================
// EXPORT MODULE - PDF and Excel/CSV export
// ============================================================

const Exporter = {
  // ---- CSV Export -----------------------------------------
  exportCSV(reports, filename = 'reportes_mantenimiento') {
    const headers = [
      'ID', 'Fecha Creación (T0)', 'Fecha Lectura (T1)', 'Fecha Cierre Técnico (T2)', 'Fecha Liberación (T3)',
      'Máquina', 'Planta', 'Área', 'Paro Total', 'Estado',
      'Operador', 'Técnico', 'Supervisor',
      'Descripción Falla', 'Trabajo Realizado', 'Materiales',
      'Por Qué 1', 'Por Qué 2', 'Por Qué 3', 'Por Qué 4', 'Por Qué 5', 'Causa Raíz',
      'Tiempo Respuesta (min)', 'Tiempo Reparación (min)', 'Tiempo Total (min)',
    ];

    const rows = reports.map(r => {
      const responseMs = r.t1 ? new Date(r.t1) - new Date(r.t0) : null;
      const repairMs   = (r.t1 && r.t2) ? new Date(r.t2) - new Date(r.t1) : null;
      const totalMs    = (r.t0 && r.t3) ? new Date(r.t3) - new Date(r.t0) : null;
      return [
        r.id,
        Utils.formatDateTime(r.t0),
        Utils.formatDateTime(r.t1),
        Utils.formatDateTime(r.t2),
        Utils.formatDateTime(r.t3),
        r.machineName, r.plantName, r.area,
        r.totalStop ? 'Sí' : 'No',
        Utils.getStatusLabel(r.status),
        r.operatorName, r.technicianName || '—', r.supervisorName || '—',
        r.description, r.workDescription, r.materials,
        r.why1, r.why2, r.why3, r.why4, r.why5, r.rootCause,
        responseMs ? Math.round(responseMs / 60000) : '—',
        repairMs   ? Math.round(repairMs   / 60000) : '—',
        totalMs    ? Math.round(totalMs    / 60000) : '—',
      ];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    this._download(
      '\uFEFF' + csvContent,  // BOM for Excel UTF-8
      `${filename}_${new Date().toISOString().slice(0,10)}.csv`,
      'text/csv;charset=utf-8;'
    );
  },

  // ---- PDF Export (Print-based) ---------------------------
  exportPDF(reports, title = 'Reporte de Mantenimiento', dateRange = '') {
    const config = DB.Config.get();
    const printWindow = window.open('', '_blank');

    const mttr = Utils.formatDuration(DB.Analytics.getMTTR(reports));
    const avgResp = Utils.formatDuration(DB.Analytics.getResponseTime(reports));
    const byMachine = DB.Analytics.getByMachine(reports);

    const rows = reports.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${Utils.formatDateTime(r.t0)}</td>
        <td>${r.machineName}</td>
        <td>${r.plantName}</td>
        <td>${r.totalStop ? '<span class="stop">PARO TOTAL</span>' : 'Parcial'}</td>
        <td class="status-${r.status}">${Utils.getStatusLabel(r.status)}</td>
        <td>${r.technicianName || '—'}</td>
        <td>${r.t1 && r.t0 ? Math.round((new Date(r.t1)-new Date(r.t0))/60000)+'m' : '—'}</td>
        <td>${r.t1 && r.t2 ? Math.round((new Date(r.t2)-new Date(r.t1))/60000)+'m' : '—'}</td>
        <td>${r.supervisorName || '—'}</td>
      </tr>
    `).join('');

    const machineRows = byMachine.map(m => `
      <tr>
        <td>${m.name}</td>
        <td>${m.count}</td>
        <td>${m.totalStop}</td>
        <td>${m.downtime > 0 ? Utils.formatDuration(m.downtime) : '—'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; color: #222; background: #fff; }
          .header { background: #0d1117; color: #fff; padding: 20px 24px; }
          .header h1 { font-size: 18px; }
          .header p { font-size: 12px; opacity: .7; margin-top: 4px; }
          .content { padding: 24px; }
          .summary { display: flex; gap: 16px; margin: 16px 0 24px; }
          .kpi { border: 1px solid #e0e0e0; border-radius: 6px; padding: 12px 16px; min-width: 120px; }
          .kpi-val { font-size: 22px; font-weight: 700; color: #2f81f7; }
          .kpi-label { font-size: 10px; color: #666; margin-top: 2px; }
          h2 { font-size: 13px; color: #333; margin: 20px 0 10px; border-bottom: 2px solid #2f81f7; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f5f5f5; font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 8px 10px; text-align: left; border-bottom: 1px solid #ddd; }
          td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; font-size: 10px; }
          tr:nth-child(even) td { background: #fafafa; }
          .stop { background: #ffecec; color: #c00; padding: 1px 6px; border-radius: 3px; font-weight: 700; }
          .status-closed { color: #2ea043; font-weight: 600; }
          .status-open, .status-read { color: #d29922; font-weight: 600; }
          .status-pending { color: #f78166; font-weight: 600; }
          .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; font-size: 10px; color: #999; text-align: center; }
          @media print { body { font-size: 9px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 ${title}</h1>
          <p>${config.companyName || 'Mi Empresa'} · ${dateRange} · Generado: ${new Date().toLocaleString('es-MX')}</p>
        </div>
        <div class="content">
          <div class="summary">
            <div class="kpi"><div class="kpi-val">${reports.length}</div><div class="kpi-label">Total Fallas</div></div>
            <div class="kpi"><div class="kpi-val">${reports.filter(r=>r.totalStop).length}</div><div class="kpi-label">Paros Totales</div></div>
            <div class="kpi"><div class="kpi-val">${mttr}</div><div class="kpi-label">MTTR</div></div>
            <div class="kpi"><div class="kpi-val">${avgResp}</div><div class="kpi-label">Tiempo de Reacción</div></div>
            <div class="kpi"><div class="kpi-val">${reports.filter(r=>r.status==='closed').length}</div><div class="kpi-label">Cerradas</div></div>
          </div>

          <h2>📊 Fallas por Máquina</h2>
          <table>
            <thead><tr><th>Máquina</th><th>Fallas</th><th>Paros Totales</th><th>Tiempo Parado</th></tr></thead>
            <tbody>${machineRows || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody>
          </table>

          <h2>📋 Detalle de Reportes</h2>
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Fecha</th><th>Máquina</th><th>Planta</th><th>Tipo</th>
                <th>Estado</th><th>Técnico</th><th>T. Respuesta</th><th>MTTR</th><th>Supervisor</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="10">Sin reportes</td></tr>'}</tbody>
          </table>

          <div class="footer">
            SOMAC · Sistema Operativo de Mantenimiento Correctivo · ${config.companyName || 'Mi Empresa'} · ${new Date().getFullYear()}
          </div>
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  },

  _download(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};

window.Exporter = Exporter;
