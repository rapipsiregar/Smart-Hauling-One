import { CrossingLog, KPISummary, TruckAsset } from './types';
import { mockKPIs, mockTrucks } from './api-client';

interface ExportOptions {
  kpi?: KPISummary;
  trucks?: TruckAsset[];
  towers?: any[];
  filenamePrefix?: string;
}

export function exportToExcel(crossings: CrossingLog[], options: ExportOptions = {}): void {
  const kpi = options.kpi || mockKPIs;
  const trucks = options.trucks || mockTrucks;
  const filenamePrefix = options.filenamePrefix || 'ISHS_Shift_Report';
  const today = new Date().toISOString().split('T')[0];

  const htmlContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          th { background-color: #0f172a; color: #ffffff; font-weight: bold; border: 1px solid #334155; padding: 8px; text-align: left; }
          td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 11px; }
          .title { font-size: 16px; font-weight: bold; color: #0284c7; }
          .section { background-color: #e2e8f0; font-weight: bold; font-size: 12px; color: #0f172a; }
          .kpi-val { font-weight: bold; color: #0284c7; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="8" class="title">LAPORAN INTEGRATED SMART HAULING SYSTEM (ISHS) CONTROL ROOM</td></tr>
          <tr><td colspan="8">PT TUNAS INTI ABADI (TIA) & PT BORNEO INDAH CEMERLANG (BIC)</td></tr>
          <tr><td colspan="8">Tanggal Ekspor: ${today}</td></tr>
          <tr><td colspan="8"></td></tr>

          <!-- SECTION 1: RINGKASAN KPI -->
          <tr class="section"><td colspan="8">1. RINGKASAN KPI OPERASIONAL SHIFT</td></tr>
          <tr>
            <th colspan="2">METRIK KPI</th>
            <th colspan="2">NILAI AKTUAL</th>
            <th>SATUAN</th>
            <th colspan="3">STATUS OPERASIONAL</th>
          </tr>
          <tr>
            <td colspan="2">Total Ritase Hari Ini</td>
            <td colspan="2" class="kpi-val">${kpi.total_ritase_today}</td>
            <td>Trips</td>
            <td colspan="3">+${kpi.traffic_trend_diff}% vs Kemarin</td>
          </tr>
          <tr>
            <td colspan="2">Truk Aktif di Koridor</td>
            <td colspan="2" class="kpi-val">${kpi.active_trucks}</td>
            <td>Units</td>
            <td colspan="3">Armada Beroperasi Real-time</td>
          </tr>
          <tr><td colspan="8"></td></tr>

          <!-- SECTION 2: DETAIL LOG LINTASAN AUDIT TRAIL -->
          <tr class="section"><td colspan="6">2. DETAIL LOG LINTASAN AUDIT TRAIL</td></tr>
          <tr>
            <th>TX ID</th>
            <th>WAKTU</th>
            <th>ID LAMBUNG (OHT)</th>
            <th>KONTRAKTOR</th>
            <th>ARAH</th>
            <th>STATUS VALIDASI</th>
          </tr>
          ${crossings
            .map(
              (c) => `
            <tr>
              <td>${c.id}</td>
              <td>${c.timestamp}</td>
              <td style="font-weight:bold; color:#0284c7;">${c.oht_id}</td>
              <td>${c.contractor}</td>
              <td>${c.direction}</td>
              <td style="font-weight:bold; color:${c.confidence >= 90 ? '#16a34a' : '#d97706'};">
                ${c.confidence >= 90 ? 'Terverifikasi' : 'Perlu Review'}
              </td>
            </tr>
          `
            )
            .join('')}
          <tr><td colspan="8"></td></tr>

          <!-- SECTION 3: DETAIL INVENTARISASI ARMADA (FLEET) -->
          <tr class="section"><td colspan="5">3. DETAIL INVENTARISASI ARMADA (FLEET)</td></tr>
          <tr>
            <th>ID LAMBUNG</th>
            <th>KONTRAKTOR</th>
            <th>MODEL TRUK</th>
            <th>STATUS</th>
            <th>RITASE HARI INI</th>
          </tr>
          ${trucks
            .map(
              (t) => `
            <tr>
              <td style="font-weight:bold; color:#0284c7;">${t.oht_id}</td>
              <td>${t.contractor}</td>
              <td>${t.model}</td>
              <td style="font-weight:bold; color:${t.status === 'ACTIVE' ? '#16a34a' : '#d97706'};">${t.status}</td>
              <td style="font-weight:bold; color:#f97316;">${t.total_ritase_today} Trips</td>
            </tr>
          `
            )
            .join('')}
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${today}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF(crossings: CrossingLog[], options: ExportOptions = {}): void {
  const kpi = options.kpi || mockKPIs;
  const trucks = options.trucks || mockTrucks;
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Pop-up terblokir oleh browser. Harap izinkan pop-up untuk mencetak PDF.');
    return;
  }

  const pdfHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Laporan Eksekutif Integrated Smart Hauling System (ISHS)</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a; padding: 25px; background: #fff; line-height: 1.4; }
          .header-kop { border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .header-title h1 { margin: 0; font-size: 18px; color: #0284c7; text-transform: uppercase; }
          .header-title p { margin: 3px 0 0 0; font-size: 11px; color: #64748b; font-weight: bold; }
          .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 20px; }
          .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; }
          .kpi-title { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: bold; }
          .kpi-num { font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 4px; font-family: monospace; }
          .section-heading { font-size: 12px; font-weight: bold; color: #0f172a; border-left: 4px solid #0284c7; padding-left: 8px; margin: 20px 0 10px 0; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; text-align: left; margin-bottom: 15px; }
          th { background: #0f172a; color: white; padding: 6px 8px; font-size: 9px; text-transform: uppercase; }
          td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
          .footer { margin-top: 25px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 9px; color: #64748b; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header-kop">
          <div class="header-title">
            <h1>LAPORAN INTEGRATED SMART HAULING SYSTEM (ISHS)</h1>
            <p>PT TUNAS INTI ABADI (TIA) & PT BORNEO INDAH CEMERLANG (BIC)</p>
          </div>
          <div style="text-align: right; font-size: 11px; color: #475569; line-height: 1.3;">
            <strong>Tanggal:</strong> ${today}<br/>
            <strong>Status Audit:</strong> VERIFIED DATA AUDIT
          </div>
        </div>

        <div class="section-heading">1. RINGKASAN KEY PERFORMANCE INDICATORS (KPI) SHIFT</div>
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-title">TOTAL RITASE HARI INI</div>
            <div class="kpi-num" style="color:#0284c7;">${kpi.total_ritase_today} Trips</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">TRUK AKTIF DI KORIDOR</div>
            <div class="kpi-num" style="color:#059669;">${kpi.active_trucks} Units</div>
          </div>
        </div>

        <div class="section-heading">2. DETAIL LOG LINTASAN AUDIT TRAIL</div>
        <table>
          <thead>
            <tr>
              <th>TX ID</th>
              <th>WAKTU</th>
              <th>ID LAMBUNG (OHT)</th>
              <th>KONTRAKTOR</th>
              <th>ARAH</th>
              <th>STATUS VALIDASI</th>
            </tr>
          </thead>
          <tbody>
            ${crossings
              .map(
                (c) => `
              <tr>
                <td style="font-weight:bold; font-family:monospace;">${c.id}</td>
                <td>${c.timestamp}</td>
                <td style="font-family:monospace; font-weight:bold; color:#0284c7;">${c.oht_id}</td>
                <td>${c.contractor}</td>
                <td>${c.direction}</td>
                <td style="font-weight:bold; color:${c.confidence >= 90 ? '#16a34a' : '#d97706'};">
                  ${c.confidence >= 90 ? 'Terverifikasi' : 'Perlu Review'}
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="section-heading">3. DETAIL INVENTARISASI ARMADA (FLEET REGISTRY)</div>
        <table>
          <thead>
            <tr>
              <th>ID LAMBUNG</th>
              <th>KONTRAKTOR</th>
              <th>MODEL TRUK</th>
              <th>STATUS</th>
              <th>RITASE HARI INI</th>
            </tr>
          </thead>
          <tbody>
            ${trucks
              .map(
                (t) => `
              <tr>
                <td style="font-family:monospace; font-weight:bold; color:#0284c7;">${t.oht_id}</td>
                <td>${t.contractor}</td>
                <td>${t.model}</td>
                <td style="font-weight:bold; color:${t.status === 'ACTIVE' ? '#16a34a' : '#d97706'};">${t.status}</td>
                <td style="font-weight:bold; color:#f97316;">${t.total_ritase_today} Trips</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>Diproses secara otomatis oleh Integrated Smart Hauling System (ISHS) v2.4</div>
          <div>Halaman 1 dari 1</div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(pdfHtml);
  printWindow.document.close();
}
