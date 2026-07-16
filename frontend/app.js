document.addEventListener('DOMContentLoaded', () => {
    let currentCrossings = [], selectedCrossingId = null, lastReportsData = null;
    const navItems = document.querySelectorAll('.nav-item'), tabPanes = document.querySelectorAll('.tab-pane'), pageTitle = document.getElementById('page-title');

    navItems.forEach(item => item.addEventListener('click', () => {
        const t = item.dataset.tab;
        navItems.forEach(i => i.classList.toggle('active', i === item));
        tabPanes.forEach(p => p.classList.toggle('active', p.id === `tab-${t}`));
        pageTitle.textContent = item.textContent.trim();
        t === 'dashboard' ? loadDashboardData() : (t === 'fleet' ? loadFleetData() : loadReportsData());
    }));

    function showToast(msg) {
        let c = document.getElementById('toast-container') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toast-container', style: 'position:fixed;top:1.5rem;right:1.5rem;z-index:9999;display:flex;flex-direction:column;gap:0.5rem;' }));
        const t = c.appendChild(Object.assign(document.createElement('div'), { style: 'background:var(--danger);color:#fff;padding:0.75rem 1rem;border-radius:6px;font-size:0.85rem;font-weight:500;min-width:250px;transition:all 0.3s;box-shadow: 0 4px 6px rgba(0,0,0,0.1);', innerHTML: `⚠️ ${msg}` }));
        setTimeout(() => t.style.opacity = '0', 4000); setTimeout(() => t.remove(), 4300);
    }

    function connectWS() {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:', ws = new WebSocket(`${proto}//${window.location.host}/ws`);
        ws.onmessage = (e) => {
            try {
                const c = JSON.parse(e.data);
                currentCrossings.push(c); updateDashboardUI(); selectCrossing(c.id);
                if (c.warning_status === 'low-confidence') showToast(`Low confidence OCR: ${c.hull_id} (${c.confidence}%)`);
            } catch (err) { console.error(err); }
        };
        ws.onclose = () => setTimeout(connectWS, 3000); ws.onerror = () => ws.close();
    }
    connectWS();

    const dz = document.getElementById('video-dropzone'), fi = document.getElementById('video-input'), fn = document.getElementById('selected-filename');
    let selectedFile = null;
    const setFile = f => { selectedFile = f; fn.textContent = `Selected: ${f.name}`; };
    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = '#38bdf8'; });
    dz.addEventListener('dragleave', () => dz.style.borderColor = '');
    dz.addEventListener('drop', e => { e.preventDefault(); dz.style.borderColor = ''; if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]); });
    fi.addEventListener('change', () => { if (fi.files.length) setFile(fi.files[0]); });

    const ingestForm = document.getElementById('ingest-form'), processPanel = document.getElementById('process-panel'), processLoader = document.getElementById('process-loader'), processResult = document.getElementById('process-result'), resultDetails = document.getElementById('result-details'), submitBtn = document.getElementById('btn-submit-ingest');

    ingestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert('Select OHT video file.');
        submitBtn.disabled = true; processPanel.classList.remove('hidden'); processLoader.classList.remove('hidden'); processResult.classList.add('hidden');
        const fd = new FormData();
        fd.append('file', selectedFile); fd.append('lane', document.getElementById('lane-select').value); fd.append('direction', document.getElementById('direction-select').value);
        try {
            const res = await fetch('/api/process-video', { method: 'POST', body: fd });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            processLoader.classList.add('hidden'); processResult.classList.remove('hidden');
            resultDetails.innerHTML = `<div><strong>Log ID:</strong> #${data.id} | <strong>Hull ID:</strong> ${data.hull_id}</div><div><strong>Lane:</strong> ${data.lane} | <strong>Confidence:</strong> ${data.confidence}%</div>`;
            selectedFile = null; fn.textContent = ''; ingestForm.reset();
        } catch (err) { alert(`OCR Failed: ${err.message}`); processPanel.classList.add('hidden'); }
        finally { submitBtn.disabled = false; }
    });

    async function loadDashboardData() {
        try {
            const [statsRes, crossingsRes] = await Promise.all([fetch('/api/stats'), fetch('/api/crossings')]);
            const stats = await statsRes.json(); currentCrossings = await crossingsRes.json();
            document.getElementById('kpi-total').textContent = stats.total_crossings;
            document.getElementById('kpi-fleet').textContent = stats.active_fleet_size;
            document.getElementById('kpi-unrecognized').textContent = stats.unrecognized_crossings;
            const distContainer = document.getElementById('distribution-container'), total = stats.total_crossings || 1;
            distContainer.innerHTML = Object.entries(stats.lane_distribution).map(([lane, count]) => {
                const percentage = ((count / total) * 100).toFixed(0);
                return `<div class="distribution-item"><div class="dist-label-row"><span>${lane}</span><span>${count} (${percentage}%)</span></div><div class="dist-bar-bg"><div class="dist-bar-fill" style="width: ${percentage}%"></div></div></div>`;
            }).join('');
            updateDashboardUI(); loadTelemetry();
            if (currentCrossings.length > 0 && !selectedCrossingId) selectCrossing(currentCrossings[currentCrossings.length - 1].id);
        } catch (err) { console.error('Load dashboard error:', err); }
    }

    function updateDashboardUI() {
        const feedList = document.getElementById('live-feed-list'); feedList.innerHTML = '';
        currentCrossings.slice().reverse().forEach(c => {
            const card = document.createElement('div'), isAlert = c.warning_status === 'low-confidence' || c.confidence < 85;
            card.className = `crossing-feed-card ${c.id === selectedCrossingId ? 'selected' : ''} ${isAlert ? 'low-conf-card' : ''}`; card.dataset.id = c.id;
            const badgeClass = c.confidence >= 95 ? 'badge-success' : (c.confidence >= 85 ? 'badge-warning' : 'badge-danger');
            card.innerHTML = `<div class="feed-row-top"><span class="oht-id">${c.hull_id}</span><span class="badge ${badgeClass}">${c.confidence}%</span></div><div class="feed-row-mid"><div class="feed-thumb"><img src="${c.crop_image_path}"></div><div class="feed-thumb"><img src="${c.context_image_path}"></div></div><div class="feed-row-bot"><span>📍 ${c.lane}</span><span>🕒 ${new Date(c.timestamp).toLocaleTimeString()}</span></div>`;
            card.addEventListener('click', () => selectCrossing(c.id)); feedList.appendChild(card);
        });
    }

    function selectCrossing(id) {
        selectedCrossingId = id;
        document.querySelectorAll('.crossing-feed-card').forEach(card => card.classList.toggle('selected', card.dataset.id == id));
        const crossing = currentCrossings.find(c => c.id == id);
        if (crossing) {
            document.getElementById('audit-crop-img').src = crossing.crop_image_path;
            document.getElementById('audit-context-img').src = crossing.context_image_path;
            document.getElementById('audit-details').innerHTML = `<div><strong>OHT Hull ID:</strong> ${crossing.hull_id} | <strong>Confidence score:</strong> ${crossing.confidence}%</div><div><strong>Gate Lane:</strong> ${crossing.lane} | <strong>Direction:</strong> ${crossing.direction} | <strong>Timestamp:</strong> ${new Date(crossing.timestamp).toLocaleString()}</div>`;
        }
    }

    async function loadFleetData() {
        try {
            const trucks = await (await fetch('/api/trucks')).json();
            document.getElementById('fleet-tbody').innerHTML = trucks.map(t => `<tr><td><strong>${t.hull_id}</strong></td><td>${t.contractor}</td><td>${t.model}</td><td><span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-danger'}">${t.status}</span></td></tr>`).join('');
        } catch (err) { console.error('Load fleet error:', err); }
    }

    async function loadReportsData() {
        try { lastReportsData = await (await fetch('/api/reports/shift-summary')).json(); renderReports(); } catch (err) { console.error('Load reports error:', err); }
    }

    function renderReports() {
        if (!lastReportsData) return;
        const query = document.getElementById('report-search-input').value.toLowerCase(), lane = document.getElementById('report-lane-filter').value;
        document.getElementById('ritase-tbody').innerHTML = Object.entries(lastReportsData.completed_ritase).filter(([hid]) => !query || hid.toLowerCase().includes(query)).map(([hid, cycles]) => `<tr><td><strong>${hid}</strong></td><td>${cycles}</td><td>${lastReportsData.crossings_per_truck[hid] || 0}</td></tr>`).join('');
        const maxVal = Math.max(...Object.values(lastReportsData.shift_distribution), 1);
        document.getElementById('shift-distribution-container').innerHTML = Object.entries(lastReportsData.shift_distribution).map(([slot, count]) => `<div class="distribution-item"><div class="dist-label-row"><span>${slot}</span><span>${count}</span></div><div class="dist-bar-bg"><div class="dist-bar-fill" style="width: ${((count / maxVal) * 100).toFixed(0)}%"></div></div></div>`).join('');
        const alertContainer = document.getElementById('discrepancies-container'), filtered = lastReportsData.discrepancies.filter(d => (!query || d.hull_id.toLowerCase().includes(query)) && (!lane || d.lane === lane));
        alertContainer.innerHTML = filtered.length ? filtered.map(d => `<div class="alert-card severity-${d.severity}"><div class="alert-header"><span class="alert-title">${d.type}</span><span>${new Date(d.timestamp).toLocaleTimeString()}</span></div><div class="alert-desc">${d.details} (<strong>${d.hull_id}</strong>)</div></div>`).join('') : '<div style="color: var(--text-secondary); font-size: 0.9rem;">No subcontractor discrepancies detected.</div>';
    }

    async function loadTelemetry() {
        try {
            const towers = await (await fetch('/api/telemetry/towers')).json();
            document.getElementById('telemetry-container').innerHTML = towers.map(t => `
                <div class="telemetry-item" data-id="${t.id}" style="cursor: pointer;">
                    <div class="telemetry-header"><h4>${t.id}</h4><span class="badge ${t.status === 'online' ? 'badge-success' : 'badge-warning'}">${t.status}</span></div>
                    <div class="telemetry-specs">
                        <div class="spec-row"><span>📍 Lane:</span><span>${t.location}</span></div>
                        <div class="spec-row"><span>🔋 Battery:</span><span>${t.battery}%</span></div>
                        <div class="dist-bar-bg"><div class="dist-bar-fill" style="width: ${t.battery}%; background: ${t.battery > 50 ? 'var(--success)' : 'var(--warning)'}"></div></div>
                        <div class="spec-row"><span>☀️ Solar Output:</span><span>${t.solar_output}W</span></div>
                        <div class="spec-row"><span>📶 Latency:</span><span>${t.latency}ms</span></div>
                    </div>
                </div>
            `).join('');
        } catch (err) { console.error('Telemetry error:', err); }
    }

    function generateSVGChart(bHist, sHist) {
        const getPts = (d, max) => d.map((v, i) => ({x: (i/5)*360 + 20, y: 135 - (v/max)*100})), b = getPts(bHist, 100), s = getPts(sHist, 150), pStr = pts => `M ${pts.map(p => `${p.x} ${p.y}`).join(' L ')}`;
        return `<svg viewBox="0 0 400 150" style="width:100%"><defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/></linearGradient><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.4"/><stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/></linearGradient></defs><line x1="20" y1="35" x2="380" y2="35" stroke="#1e293b" stroke-dasharray="3"/><line x1="20" y1="85" x2="380" y2="85" stroke="#1e293b" stroke-dasharray="3"/><line x1="20" y1="135" x2="380" y2="135" stroke="#1e293b"/><path d="${pStr(b)} L 380 135 L 20 135 Z" fill="url(#gb)"/><path d="${pStr(s)} L 380 135 L 20 135 Z" fill="url(#gs)"/><path d="${pStr(b)}" fill="none" stroke="#38bdf8" stroke-width="2.5"/><path d="${pStr(s)}" fill="none" stroke="#fbbf24" stroke-width="2.5"/><text x="25" y="20" fill="#38bdf8" font-size="9" font-family="sans-serif" font-weight="600">🔋 Battery Level (%)</text><text x="180" y="20" fill="#fbbf24" font-size="9" font-family="sans-serif" font-weight="600">☀️ Solar Output (W)</text></svg>`;
    }

    const telemetryModal = document.getElementById('telemetry-modal');
    document.getElementById('telemetry-container').addEventListener('click', (e) => {
        const item = e.target.closest('.telemetry-item');
        if (item) {
            const id = item.dataset.id; document.getElementById('telemetry-modal-title').textContent = `${id} Telemetry Trends`;
            let bHist = [84, 83, 85, 84, 83, 84], sHist = [120, 118, 122, 125, 119, 123];
            if (id === 'Tower-Beta') { bHist = [90, 92, 91, 93, 90, 92]; sHist = [95, 92, 98, 102, 96, 99]; }
            if (id === 'Tower-Gamma') { bHist = [45, 42, 38, 32, 28, 26]; sHist = [15, 12, 8, 4, 3, 2]; }
            document.getElementById('telemetry-chart-container').innerHTML = generateSVGChart(bHist, sHist);
            telemetryModal.classList.remove('hidden');
        }
    });

    const regModal = document.getElementById('register-modal'), regForm = document.getElementById('register-form'), toggleModal = (m, show) => m.classList.toggle('hidden', !show);
    ['btn-open-register', 'btn-close-register', 'register-modal-overlay'].forEach((id, i) => document.getElementById(id).addEventListener('click', () => toggleModal(regModal, i === 0)));
    ['btn-close-telemetry', 'telemetry-modal-overlay'].forEach(id => document.getElementById(id).addEventListener('click', () => toggleModal(telemetryModal, false)));

    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = { hull_id: document.getElementById('reg-hull-id').value, contractor: document.getElementById('reg-contractor').value, model: document.getElementById('reg-model').value, status: document.getElementById('reg-status').value };
        try {
            const res = await fetch('/api/trucks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error(await res.text());
            toggleModal(regModal, false); regForm.reset(); loadFleetData();
        } catch (err) { alert(`Failed to register OHT: ${err.message}`); }
    });

    document.getElementById('btn-refresh-feed').onclick = loadDashboardData;
    document.getElementById('btn-refresh-reports').onclick = loadReportsData;
    ['report-search-input', 'report-lane-filter', 'report-dir-filter'].forEach(id => document.getElementById(id).addEventListener(id.includes('search') ? 'input' : 'change', renderReports));

    document.getElementById('btn-export-csv').onclick = () => {
        const q = document.getElementById('report-search-input').value, l = document.getElementById('report-lane-filter').value, d = document.getElementById('report-dir-filter').value;
        window.open(`/api/reports/export-csv?query=${encodeURIComponent(q)}&lane=${encodeURIComponent(l)}&direction=${encodeURIComponent(d)}`);
    };

    const btnSync = document.getElementById('btn-sync-cloud'), syncIndicator = document.getElementById('sync-status-indicator');
    btnSync.onclick = async () => {
        btnSync.disabled = true; btnSync.textContent = 'Syncing...';
        try {
            const res = await fetch('/api/reports/sync', { method: 'POST' });
            const result = await res.json();
            syncIndicator.textContent = `Last sync: Success (Synced ${result.synchronized_records_count} logs)`; syncIndicator.style.color = 'var(--success)';
        } catch (err) {
            syncIndicator.textContent = 'Last sync: Failed'; syncIndicator.style.color = 'var(--danger)';
        } finally { btnSync.disabled = false; btnSync.textContent = '☁ Sync Cloud'; }
    };

    loadDashboardData(); setInterval(loadTelemetry, 8000);
});
