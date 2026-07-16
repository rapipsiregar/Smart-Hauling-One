document.addEventListener('DOMContentLoaded', () => {
    let currentCrossings = [], selectedCrossingId = null, lastReportsData = null;

    // Tab Navigation
    const navItems = document.querySelectorAll('.nav-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
    const pageTitle = document.getElementById('page-title');

    navItems.forEach(item => item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        navItems.forEach(i => i.classList.toggle('active', i === item));
        tabPanes.forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
        pageTitle.textContent = item.textContent.trim();
        if (tab === 'dashboard') loadDashboardData();
        if (tab === 'fleet') loadFleetData();
        if (tab === 'reports') loadReportsData();
    }));

    // WebSocket Real-time Feed
    function connectWS() {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
        ws.onmessage = (e) => {
            try {
                const c = JSON.parse(e.data);
                currentCrossings.push(c); updateDashboardUI(); selectCrossing(c.id);
            } catch (err) { console.error('WS JSON error:', err); }
        };
        ws.onclose = () => setTimeout(connectWS, 3000);
        ws.onerror = () => ws.close();
    }
    connectWS();

    // Ingest Upload dropzone
    const dropzone = document.getElementById('video-dropzone');
    const fileInput = document.getElementById('video-input');
    const filenameDisplay = document.getElementById('selected-filename');
    let selectedFile = null;

    const setFile = (f) => { selectedFile = f; filenameDisplay.textContent = `Selected: ${f.name}`; };
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = '#38bdf8'; });
    dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = '');
    dropzone.addEventListener('drop', e => {
        e.preventDefault(); dropzone.style.borderColor = '';
        if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => { if (fileInput.files.length) setFile(fileInput.files[0]); });

    // Ingest Form Submission
    const ingestForm = document.getElementById('ingest-form');
    const processPanel = document.getElementById('process-panel');
    const processLoader = document.getElementById('process-loader');
    const processResult = document.getElementById('process-result');
    const resultDetails = document.getElementById('result-details');
    const submitBtn = document.getElementById('btn-submit-ingest');

    ingestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) return alert('Select OHT video file.');

        submitBtn.disabled = true;
        processPanel.classList.remove('hidden'); processLoader.classList.remove('hidden'); processResult.classList.add('hidden');

        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('lane', document.getElementById('lane-select').value);
        fd.append('direction', document.getElementById('direction-select').value);

        try {
            const res = await fetch('/api/process-video', { method: 'POST', body: fd });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            processLoader.classList.add('hidden'); processResult.classList.remove('hidden');
            resultDetails.innerHTML = `<div><strong>Log ID:</strong> #${data.id} | <strong>Hull ID:</strong> ${data.hull_id}</div><div><strong>Lane:</strong> ${data.lane} | <strong>Confidence:</strong> ${data.confidence}%</div>`;
            selectedFile = null; filenameDisplay.textContent = ''; ingestForm.reset();
        } catch (err) { alert(`OCR Failed: ${err.message}`); processPanel.classList.add('hidden'); }
        finally { submitBtn.disabled = false; }
    });

    // Load & Render Dashboard Data
    async function loadDashboardData() {
        try {
            const [statsRes, crossingsRes] = await Promise.all([fetch('/api/stats'), fetch('/api/crossings')]);
            const stats = await statsRes.json();
            currentCrossings = await crossingsRes.json();

            document.getElementById('kpi-total').textContent = stats.total_crossings;
            document.getElementById('kpi-fleet').textContent = stats.active_fleet_size;
            document.getElementById('kpi-unrecognized').textContent = stats.unrecognized_crossings;

            // Render stats lane distribution
            const distContainer = document.getElementById('distribution-container');
            const total = stats.total_crossings || 1;
            distContainer.innerHTML = Object.entries(stats.lane_distribution).map(([lane, count]) => {
                const percentage = ((count / total) * 100).toFixed(0);
                return `<div class="distribution-item"><div class="dist-label-row"><span>${lane}</span><span>${count} (${percentage}%)</span></div><div class="dist-bar-bg"><div class="dist-bar-fill" style="width: ${percentage}%"></div></div></div>`;
            }).join('');

            updateDashboardUI();
            loadTelemetry();
            if (currentCrossings.length > 0 && !selectedCrossingId) {
                selectCrossing(currentCrossings[currentCrossings.length - 1].id);
            }
        } catch (err) { console.error('Load dashboard error:', err); }
    }

    function updateDashboardUI() {
        const feedList = document.getElementById('live-feed-list');
        feedList.innerHTML = '';
        currentCrossings.slice().reverse().forEach(c => {
            const card = document.createElement('div');
            card.className = `crossing-feed-card ${c.id === selectedCrossingId ? 'selected' : ''}`;
            card.dataset.id = c.id;
            const badgeClass = c.confidence >= 95 ? 'badge-success' : (c.confidence >= 85 ? 'badge-warning' : 'badge-danger');
            card.innerHTML = `<div class="feed-row-top"><span class="oht-id">${c.hull_id}</span><span class="badge ${badgeClass}">${c.confidence}%</span></div><div class="feed-row-mid"><div class="feed-thumb"><img src="${c.crop_image_path}"></div><div class="feed-thumb"><img src="${c.context_image_path}"></div></div><div class="feed-row-bot"><span>📍 ${c.lane}</span><span>🕒 ${new Date(c.timestamp).toLocaleTimeString()}</span></div>`;
            card.addEventListener('click', () => selectCrossing(c.id));
            feedList.appendChild(card);
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

    // Load & Render Fleet
    async function loadFleetData() {
        try {
            const trucks = await (await fetch('/api/trucks')).json();
            const tbody = document.getElementById('fleet-tbody');
            tbody.innerHTML = trucks.map(t => `<tr><td><strong>${t.hull_id}</strong></td><td>${t.contractor}</td><td>${t.model}</td><td><span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-danger'}">${t.status}</span></td></tr>`).join('');
        } catch (err) { console.error('Load fleet error:', err); }
    }

    // Load & Render Reports Data
    async function loadReportsData() {
        try {
            lastReportsData = await (await fetch('/api/reports/shift-summary')).json();
            renderReports();
        } catch (err) { console.error('Load reports error:', err); }
    }

    function renderReports() {
        if (!lastReportsData) return;
        const query = document.getElementById('report-search-input').value.toLowerCase();
        const lane = document.getElementById('report-lane-filter').value;

        const tbody = document.getElementById('ritase-tbody');
        tbody.innerHTML = Object.entries(lastReportsData.completed_ritase).filter(([hid]) => !query || hid.toLowerCase().includes(query)).map(([hid, cycles]) => `<tr><td><strong>${hid}</strong></td><td>${cycles}</td><td>${lastReportsData.crossings_per_truck[hid] || 0}</td></tr>`).join('');

        const shiftContainer = document.getElementById('shift-distribution-container');
        const maxVal = Math.max(...Object.values(lastReportsData.shift_distribution), 1);
        shiftContainer.innerHTML = Object.entries(lastReportsData.shift_distribution).map(([slot, count]) => {
            const percentage = ((count / maxVal) * 100).toFixed(0);
            return `<div class="distribution-item"><div class="dist-label-row"><span>${slot}</span><span>${count}</span></div><div class="dist-bar-bg"><div class="dist-bar-fill" style="width: ${percentage}%"></div></div></div>`;
        }).join('');

        const alertContainer = document.getElementById('discrepancies-container');
        const filtered = lastReportsData.discrepancies.filter(d => (!query || d.hull_id.toLowerCase().includes(query)) && (!lane || d.lane === lane));
        alertContainer.innerHTML = filtered.length ? filtered.map(d => `<div class="alert-card severity-${d.severity}"><div class="alert-header"><span class="alert-title">${d.type}</span><span>${new Date(d.timestamp).toLocaleTimeString()}</span></div><div class="alert-desc">${d.details} (<strong>${d.hull_id}</strong>)</div></div>`).join('') : '<div style="color: var(--text-secondary); font-size: 0.9rem;">No subcontractor discrepancies detected.</div>';
    }

    // Fetch and render remote tower telemetry
    async function loadTelemetry() {
        try {
            const towers = await (await fetch('/api/telemetry/towers')).json();
            const container = document.getElementById('telemetry-container');
            container.innerHTML = towers.map(t => `
                <div class="telemetry-item">
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

    // Modal Control: Register OHT
    const registerModal = document.getElementById('register-modal');
    const registerForm = document.getElementById('register-form');
    const toggleModal = (modal, show) => modal.classList.toggle('hidden', !show);

    ['btn-open-register', 'btn-close-register', 'register-modal-overlay'].forEach((id, i) => document.getElementById(id).addEventListener('click', () => toggleModal(registerModal, i === 0)));

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            hull_id: document.getElementById('reg-hull-id').value,
            contractor: document.getElementById('reg-contractor').value,
            model: document.getElementById('reg-model').value,
            status: document.getElementById('reg-status').value
        };

        try {
            const res = await fetch('/api/trucks', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(await res.text());
            toggleModal(registerModal, false); registerForm.reset(); loadFleetData();
        } catch (err) { alert(`Failed to register OHT: ${err.message}`); }
    });

    document.getElementById('btn-refresh-feed').addEventListener('click', loadDashboardData);
    document.getElementById('btn-refresh-reports').addEventListener('click', loadReportsData);

    // Search, Filter, Export & Cloud Sync Triggers
    document.getElementById('report-search-input').addEventListener('input', renderReports);
    document.getElementById('report-lane-filter').addEventListener('change', renderReports);
    document.getElementById('report-dir-filter').addEventListener('change', renderReports);

    document.getElementById('btn-export-csv').addEventListener('click', () => {
        const q = document.getElementById('report-search-input').value;
        const l = document.getElementById('report-lane-filter').value;
        const d = document.getElementById('report-dir-filter').value;
        window.open(`/api/reports/export-csv?query=${encodeURIComponent(q)}&lane=${encodeURIComponent(l)}&direction=${encodeURIComponent(d)}`);
    });

    const btnSync = document.getElementById('btn-sync-cloud');
    const syncIndicator = document.getElementById('sync-status-indicator');
    btnSync.addEventListener('click', async () => {
        btnSync.disabled = true; btnSync.textContent = 'Syncing...';
        try {
            const res = await fetch('/api/reports/sync', { method: 'POST' });
            const result = await res.json();
            syncIndicator.textContent = `Last sync: Success (Synced ${result.synchronized_records_count} logs)`;
            syncIndicator.style.color = 'var(--success)';
        } catch (err) {
            syncIndicator.textContent = 'Last sync: Failed'; syncIndicator.style.color = 'var(--danger)';
        } finally { btnSync.disabled = false; btnSync.textContent = '☁ Sync Cloud'; }
    });

    // Initial Load & Telemetry Polling
    loadDashboardData();
    setInterval(loadTelemetry, 8000);
});
