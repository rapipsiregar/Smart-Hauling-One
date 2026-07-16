document.addEventListener('DOMContentLoaded', () => {
    let currentCrossings = [], selectedCrossingId = null, lastReportsData = null, fleetTrucks = [];
    window.getCurrentCrossings = () => currentCrossings;
    const navItems = document.querySelectorAll('.nav-item'), tabPanes = document.querySelectorAll('.tab-pane'), pageTitle = document.getElementById('page-title');

    navItems.forEach(item => item.addEventListener('click', () => {
        const t = item.dataset.tab; navItems.forEach(i => i.classList.toggle('active', i === item)); tabPanes.forEach(p => p.classList.toggle('active', p.id === `tab-${t}`));
        pageTitle.textContent = item.textContent.trim(); t === 'dashboard' ? loadDashboardData() : (t === 'fleet' ? loadFleetData() : loadReportsData());
    }));

    const showToast = (msg) => { if (typeof window.showToast === 'function') window.showToast(msg); };

    let systemAlerts = [], activeTowerWarns = new Set(); const drawer = document.getElementById('alerts-drawer');
    document.getElementById('btn-toggle-drawer').onclick = () => drawer.classList.toggle('hidden'); document.getElementById('btn-close-drawer').onclick = () => drawer.classList.add('hidden');
    function addAlert(type, msg, sev = 'medium') {
        if (type) systemAlerts.unshift({ id: Date.now() + Math.random(), type, msg, sev, time: new Date() });
        const badge = document.getElementById('alerts-badge'); if (badge) badge.textContent = systemAlerts.length, badge.classList.toggle('hidden', !systemAlerts.length);
        const lst = document.getElementById('drawer-alerts-list'); if (lst) {
            lst.innerHTML = systemAlerts.length ? systemAlerts.map(a => `<div class="drawer-alert-item severity-${a.sev}"><button class="dis-alert" data-id="${a.id}">×</button><div style="font-weight:600;">${a.type}</div><div>${a.msg}</div><div style="font-size:0.7rem;opacity:0.6;margin-top:0.25rem;">${a.time.toLocaleTimeString()}</div></div>`).join('') : '<div style="color:var(--text-secondary);text-align:center;margin-top:2rem;">No system alerts.</div>';
            lst.querySelectorAll('.dis-alert').forEach(btn => btn.onclick = () => { systemAlerts = systemAlerts.filter(a => a.id != btn.dataset.id); addAlert(); });
        }
    }

    function connectWS() {
        const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`), ind = document.getElementById('ws-indicator'), txt = document.getElementById('ws-text');
        ws.onopen = () => { if (ind && txt) ind.className = 'ws-pulse connected', txt.textContent = 'WS Connected'; addAlert('WS Connected', 'WebSocket link established', 'low'); };
        ws.onmessage = (e) => {
            try {
                const c = JSON.parse(e.data);
                if (c.type === 'dispatch_alert') return showToast(`Mock Dispatch: ${c.message}`), addAlert('Mock Dispatch', c.message, 'medium');
                const idx = currentCrossings.findIndex(x => x.id === c.id); idx !== -1 ? currentCrossings[idx] = c : currentCrossings.push(c);
                updateDashboardUI(); if (selectedCrossingId === c.id) selectCrossing(c.id);
                if (c.warning_status === 'low-confidence') { showToast(`Low confidence OCR: ${c.hull_id} (${c.confidence}%)`); addAlert('Low Confidence OCR', `OHT ${c.hull_id} detected at ${c.confidence}%`, 'medium'); if (typeof window.playAudioAlert === 'function') window.playAudioAlert(); }
                if (c.warning_status === 'cycle-discrepancy') showToast(`Cycle discrepancy for ${c.hull_id}!`), addAlert('Cycle Discrepancy', `OHT ${c.hull_id} sequence mismatch`, 'high');
            } catch (err) { console.error(err); }
        };
        ws.onclose = () => { if (ind && txt) ind.className = 'ws-pulse reconnecting', txt.textContent = 'WS Reconnecting...'; addAlert('WS Disconnected', 'WebSocket link lost, reconnecting...', 'high'); setTimeout(connectWS, 3000); };
        ws.onerror = () => ws.close();
    }
    connectWS();

    const sampleSelect = document.getElementById('sample-select');
    async function loadSampleVideos() {
        try {
            const res = await fetch('/api/sample-videos');
            if (res.ok) {
                const videos = await res.json();
                videos.forEach(v => {
                    const opt = document.createElement('option');
                    opt.value = v.filename;
                    opt.textContent = `${v.filename} (${(v.size_bytes / (1024 * 1024)).toFixed(2)} MB)`;
                    sampleSelect.appendChild(opt);
                });
            }
        } catch (err) { console.error('Failed to load sample videos:', err); }
    }
    loadSampleVideos();

    const dz = document.getElementById('video-dropzone'), fi = document.getElementById('video-input'), fn = document.getElementById('selected-filename'); let selectedFile = null;
    const ingestVideo = document.getElementById('ingest-video-player');
    const processPrompt = document.getElementById('process-prompt');
    const ingestForm = document.getElementById('ingest-form'), processPanel = document.getElementById('process-panel'), processLoader = document.getElementById('process-loader'), processResult = document.getElementById('process-result'), resultDetails = document.getElementById('result-details'), submitBtn = document.getElementById('btn-submit-ingest');

    function updateIngestPreview() {
        const sampleVal = sampleSelect.value;
        if (selectedFile) {
            ingestVideo.src = URL.createObjectURL(selectedFile);
            processPanel.classList.remove('hidden');
            processPrompt.classList.remove('hidden');
            processLoader.classList.add('hidden');
            processResult.classList.add('hidden');
        } else if (sampleVal) {
            ingestVideo.src = `/playlist/${sampleVal}`;
            processPanel.classList.remove('hidden');
            processPrompt.classList.remove('hidden');
            processLoader.classList.add('hidden');
            processResult.classList.add('hidden');
        } else {
            ingestVideo.src = '';
            processPanel.classList.add('hidden');
        }
    }

    sampleSelect.onchange = () => {
        if (sampleSelect.value) {
            selectedFile = null;
            fn.textContent = '';
        }
        updateIngestPreview();
    };

    dz.onclick = () => fi.click(); dz.ondragover = e => { e.preventDefault(); dz.style.borderColor = '#38bdf8'; }; dz.ondragleave = () => dz.style.borderColor = '';
    dz.ondrop = e => { e.preventDefault(); dz.style.borderColor = ''; if (e.dataTransfer.files.length) { selectedFile = e.dataTransfer.files[0]; fn.textContent = `Selected: ${selectedFile.name}`; sampleSelect.value = ''; updateIngestPreview(); } }; 
    fi.onchange = () => { if (fi.files.length) { selectedFile = fi.files[0]; fn.textContent = `Selected: ${selectedFile.name}`; sampleSelect.value = ''; updateIngestPreview(); } };

    ingestForm.onsubmit = async (e) => {
        e.preventDefault(); 
        const sampleVal = sampleSelect.value;
        if (!selectedFile && !sampleVal) return alert('Select OHT video file or choose a sample video.');
        submitBtn.disabled = true; 
        processPanel.classList.remove('hidden'); 
        processPrompt.classList.add('hidden');
        processLoader.classList.remove('hidden'); 
        processResult.classList.add('hidden');
        const fd = new FormData();
        if (selectedFile) {
            fd.append('file', selectedFile);
        } else {
            fd.append('sample_filename', sampleVal);
        }
        fd.append('lane', document.getElementById('lane-select').value);
        fd.append('direction', document.getElementById('direction-select').value);
        try {
            const res = await fetch('/api/process-video', { method: 'POST', body: fd });
            if (!res.ok) throw new Error(await res.text());
            const d = await res.json();
            processLoader.classList.add('hidden'); 
            processResult.classList.remove('hidden');
            resultDetails.innerHTML = `<div><strong>Log ID:</strong> #${d.id} | <strong>Hull ID:</strong> ${d.hull_id}</div><div><strong>Lane:</strong> ${d.lane} | <strong>Confidence:</strong> ${d.confidence}%</div>`;
        } catch (err) { 
            alert(`OCR Failed: ${err.message}`); 
            processPrompt.classList.remove('hidden');
            processLoader.classList.add('hidden');
        } finally { submitBtn.disabled = false; }
    };

    async function loadDashboardData() {
        try {
            const [stats, crossings] = await Promise.all([fetch('/api/stats').then(r => r.json()), fetch('/api/crossings').then(r => r.json())]);
            currentCrossings = crossings;
            document.getElementById('kpi-total').textContent = stats.total_crossings;
            document.getElementById('kpi-fleet').textContent = stats.active_fleet_size;
            document.getElementById('kpi-unrecognized').textContent = stats.unrecognized_crossings;
            const dist = document.getElementById('distribution-container'), tot = stats.total_crossings || 1;
            dist.innerHTML = Object.entries(stats.lane_distribution).map(([l, cnt]) => `<div class="distribution-item"><div class="dist-label-row"><span>${l}</span><span>${cnt} (${((cnt/tot)*100).toFixed(0)}%)</span></div><div class="dist-bar-bg"><div class="dist-bar-fill" style="width: ${((cnt/tot)*100).toFixed(0)}%"></div></div></div>`).join('');
            updateDashboardUI(); loadTelemetry(); updateMapHeatmap();
            if (crossings.length && !selectedCrossingId) selectCrossing(crossings[crossings.length - 1].id);
        } catch (err) { console.error(err); }
    }

    function updateMapHeatmap() {
        const limit = 15 * 60 * 1000, now = new Date(), recent = currentCrossings.filter(c => (now - new Date(c.timestamp)) <= limit).length ? currentCrossings.filter(c => (now - new Date(c.timestamp)) <= limit) : currentCrossings.slice(-6);
        const cnts = { loading: 0, dumping: 0, haulroad: 0 }; recent.forEach(c => { if (c.lane === 'North Checkpoint' || c.direction === 'inbound') cnts.loading++; if (c.lane === 'South Gate' || c.direction === 'outbound') cnts.dumping++; if (c.lane === 'Main Portal') cnts.haulroad++; });
        const colors = cnt => cnt === 0 ? 'rgba(16,185,129,0.15)' : (cnt <= 2 ? 'rgba(251,191,36,0.45)' : 'rgba(239,68,68,0.65)');
        ['loading', 'dumping', 'haulroad'].forEach(z => { const el = document.getElementById(`heat-${z}`); if (el) el.setAttribute('fill', colors(cnts[z])), el.setAttribute('r', 16 + Math.min(cnts[z] * 3, 16)); });
    }

    function updateDashboardUI() {
        const feedList = document.getElementById('live-feed-list'); feedList.innerHTML = '';
        currentCrossings.slice().reverse().forEach(c => {
            const card = document.createElement('div'), isAlert = c.warning_status === 'low-confidence' || c.confidence < 85;
            card.className = `crossing-feed-card ${c.id === selectedCrossingId ? 'selected' : ''} ${isAlert ? 'low-conf-card' : ''}`; card.dataset.id = c.id; card.dataset.class = c.vehicle_class || 'Dump Truck';
            card.dataset.confidence = c.confidence; card.dataset.warning = c.warning_status;
            card.dataset.unregistered = !fleetTrucks.some(t => t.hull_id === c.hull_id) ? "true" : "false";
            const badgeClass = c.confidence >= 95 ? 'badge-success' : (c.confidence >= 85 ? 'badge-warning' : 'badge-danger');
            card.innerHTML = `<div class="feed-row-top"><span class="oht-id">${c.hull_id}</span><span><span class="badge ${badgeClass}">${c.confidence}%</span>${c.confidence < 100 ? `<button class="btn-quick-verify" title="Quick Verify" style="background:none; border:none; color:var(--success); cursor:pointer; font-size:1rem; padding:0 0.15rem; margin-left:0.35rem; display:inline-flex; align-items:center; vertical-align:middle;">✔</button>` : ''}</span></div><div class="feed-row-mid"><div class="feed-thumb"><img src="${c.crop_image_path}"></div><div class="feed-thumb"><img src="${c.context_image_path}"></div></div><div class="feed-row-bot"><span>📍 ${c.lane}</span><span>🕒 ${new Date(c.timestamp).toLocaleTimeString()}</span></div>`;
            const qv = card.querySelector('.btn-quick-verify'); if (qv) qv.onclick = (e) => { e.stopPropagation(); sendUpdate(c.id, { hull_id: c.hull_id, confidence: 100.0, warning_status: 'normal' }); };
            card.addEventListener('click', () => selectCrossing(c.id)); feedList.appendChild(card);
        });
    }

    function selectCrossing(id) {
        selectedCrossingId = id;
        document.querySelectorAll('.crossing-feed-card').forEach(c => c.classList.toggle('selected', c.dataset.id == id));
        const c = currentCrossings.find(x => x.id == id);
        if (c) {
            document.getElementById('audit-crop-img').src = c.crop_image_path;
            document.getElementById('audit-context-img').src = c.context_image_path;
            document.getElementById('audit-details').innerHTML = `<div><strong>OHT:</strong> ${c.hull_id} (${c.confidence}%)</div><div>📍 ${c.lane} | ${c.direction} | 🕒 ${new Date(c.timestamp).toLocaleString()}</div>`;
        }
    }

    async function loadFleetData() {
        try {
            try { fleetTrucks = await (await fetch('/api/trucks')).json(); localStorage.setItem('fleet_trucks_cache', JSON.stringify(fleetTrucks)); }
            catch (e) { fleetTrucks = JSON.parse(localStorage.getItem('fleet_trucks_cache') || '[]'); }
            document.getElementById('fleet-tbody').innerHTML = fleetTrucks.map(t => `<tr><td><strong>${t.hull_id}</strong></td><td>${t.contractor}</td><td>${t.model}</td><td><label class="switch"><input type="checkbox" class="toggle-truck-status" data-hull="${t.hull_id}" ${t.status === 'active' ? 'checked' : ''}><span class="slider-toggle"></span></label></td><td><button class="btn btn-secondary btn-sm edit-truck-btn" data-hull="${t.hull_id}" data-contractor="${t.contractor}" data-model="${t.model}" data-status="${t.status}">✏ Edit</button><button class="btn btn-danger btn-sm delete-truck-btn" data-hull="${t.hull_id}" style="margin-left: 0.5rem; background: var(--danger); border-color: var(--danger); color: white;">🗑 Delete</button></td></tr>`).join('');
            
            document.querySelectorAll('.toggle-truck-status').forEach(cb => cb.onchange = async () => {
                const hull = cb.dataset.hull, status = cb.checked ? 'active' : 'inactive';
                try { if ((await fetch(`/api/trucks/${hull}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })).ok) showToast(`OHT ${hull} status synced!`); else throw new Error(); } catch (e) { cb.checked = !cb.checked; alert('Failed to sync status.'); }
            });

            document.querySelectorAll('.edit-truck-btn').forEach(btn => btn.onclick = () => {
                editingHullId = btn.dataset.hull;
                regModal.querySelector('h3').textContent = 'Edit OHT Vehicle';
                document.getElementById('reg-hull-id').value = btn.dataset.hull;
                document.getElementById('reg-contractor').value = btn.dataset.contractor;
                document.getElementById('reg-model').value = btn.dataset.model;
                document.getElementById('reg-status').value = btn.dataset.status;
                regModal.classList.remove('hidden');
            });

            document.querySelectorAll('.delete-truck-btn').forEach(btn => btn.onclick = async () => {
                const hull = btn.dataset.hull;
                if (confirm(`Are you sure you want to delete OHT ${hull}?`)) {
                    try {
                        const res = await fetch(`/api/trucks/${hull}`, { method: 'DELETE' });
                        if (res.ok) {
                            showToast(`OHT ${hull} deleted successfully.`);
                            loadFleetData();
                        } else {
                            throw new Error(await res.text());
                        }
                    } catch (e) {
                        alert(`Failed to delete truck: ${e.message}`);
                    }
                }
            });
        } catch (err) { console.error(err); }
    }

    async function loadReportsData() { try { if (!fleetTrucks.length) await loadFleetData(); lastReportsData = await (await fetch('/api/reports/shift-summary')).json(); renderReports(); } catch (err) { console.error(err); } }

    function renderReports() {
        window.renderReports = renderReports;
        if (!lastReportsData) return;
        const query = document.getElementById('report-search-input').value.toLowerCase(), lane = document.getElementById('report-lane-filter').value;
        const contractors = [...new Set(fleetTrucks.map(t => t.contractor).concat(lastReportsData.discrepancies.map(d => (fleetTrucks.find(t => t.hull_id === d.hull_id) || {}).contractor || 'Ad-hoc Contractor')))].filter(Boolean).sort();
        const cEl = document.getElementById('disc-contractors-filter'), existing = [...document.querySelectorAll('.disc-cont-cb')].map(cb => cb.value).sort();
        if (JSON.stringify(contractors) !== JSON.stringify(existing)) {
            cEl.innerHTML = '<strong>Contractors:</strong>' + contractors.map(c => `<label style="display:flex; align-items:center; gap:0.25rem;"><input type="checkbox" class="disc-cont-cb" value="${c}" checked> ${c}</label>`).join('');
            document.querySelectorAll('.disc-lane-cb, .disc-cont-cb').forEach(cb => cb.onchange = renderReports);
        }
        const checkedLanes = [...document.querySelectorAll('.disc-lane-cb:checked')].map(cb => cb.value);
        const checkedContractors = [...document.querySelectorAll('.disc-cont-cb:checked')].map(cb => cb.value);
        document.getElementById('ritase-tbody').innerHTML = Object.entries(lastReportsData.completed_ritase).filter(([hid]) => !query || hid.toLowerCase().includes(query)).map(([hid, cycles]) => `<tr><td><strong>${hid}</strong></td><td>${cycles}</td><td>${lastReportsData.crossings_per_truck[hid] || 0}</td></tr>`).join('');
        if (typeof window.renderShiftCards === 'function') window.renderShiftCards(lastReportsData.shift_distribution);
        const alertContainer = document.getElementById('discrepancies-container'), filtered = lastReportsData.discrepancies.filter(d => {
            const truck = fleetTrucks.find(t => t.hull_id === d.hull_id);
            return (!query || d.hull_id.toLowerCase().includes(query)) && (!lane || d.lane === lane) && checkedLanes.includes(d.lane) && checkedContractors.includes(truck ? truck.contractor : 'Ad-hoc Contractor');
        });
        if (typeof window.sortDiscrepancies === 'function') window.sortDiscrepancies(filtered);
        alertContainer.innerHTML = filtered.length ? filtered.map(d => `<div class="alert-card severity-${d.severity}"><div class="alert-header"><span class="alert-title">${d.type}</span><span>${new Date(d.timestamp).toLocaleTimeString()}</span></div><div class="alert-desc">${d.details} (<strong>${d.hull_id}</strong>)</div></div>`).join('') : '<div style="color: var(--text-secondary); font-size: 0.9rem;">No subcontractor discrepancies detected.</div>';

        let contractorCycles = {}, totalCycles = 0;
        Object.entries(lastReportsData.completed_ritase).forEach(([hid, cycles]) => {
            const truck = fleetTrucks.find(t => t.hull_id === hid);
            const contractor = truck ? truck.contractor : 'Ad-hoc Contractor';
            contractorCycles[contractor] = (contractorCycles[contractor] || 0) + cycles;
            totalCycles += cycles;
        });
        const colors = ['#38bdf8', '#6366f1', '#10b981', '#fbbf24', '#ef4444'];
        let conicSegments = [], legendHtml = [], accumulatedPercent = 0;
        Object.entries(contractorCycles).forEach(([contractor, val], idx) => {
            const percent = totalCycles > 0 ? (val / totalCycles) * 100 : 0;
            const color = colors[idx % colors.length];
            conicSegments.push(`${color} ${accumulatedPercent}% ${accumulatedPercent + percent}%`);
            accumulatedPercent += percent;
            legendHtml.push(`<div style="display:flex; align-items:center; gap:0.5rem;"><span style="width:10px; height:10px; background:${color}; border-radius:50%;"></span><strong>${contractor}</strong>: ${val} (${percent.toFixed(0)}%)</div>`);
        });
        const donut = document.getElementById('contractor-donut');
        if (donut) {
            donut.style.background = totalCycles > 0 ? `conic-gradient(${conicSegments.join(', ')})` : '#334155';
            document.getElementById('donut-total-val').textContent = totalCycles;
            document.getElementById('contractor-legend').innerHTML = legendHtml.length ? legendHtml.join('') : 'No contractor cycles recorded.';
        }
        const compContainer = document.getElementById('compliance-gauge-list');
        if (compContainer && lastReportsData.compliance) {
            compContainer.innerHTML = Object.entries(lastReportsData.compliance).map(([contractor, data]) => {
                const barColor = data.compliance_pct < 50 ? 'var(--danger)' : (data.compliance_pct < 85 ? 'var(--warning)' : 'var(--success)');
                return `<div class="distribution-item"><div class="dist-label-row"><span><strong>${contractor}</strong></span><span>${data.compliance_pct}%</span></div><div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${data.compliance_pct}%;background:${barColor}"></div></div><div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-secondary); margin-top:0.2rem;"><span>Capacity: ${data.hourly_capacity} ritase/hr</span><span>Target: ${data.target_threshold} ritase/hr</span></div></div>`;
            }).join('');
            if (typeof window.onReportsRendered === 'function') window.onReportsRendered(lastReportsData.compliance);
            if (typeof window.renderComplianceStatsChart === 'function') window.renderComplianceStatsChart(lastReportsData.compliance);
        }
    }

    async function loadTelemetry() {
        try {
            const towers = await (await fetch('/api/telemetry/towers')).json();
            towers.forEach(t => t.status === 'warning' ? (!activeTowerWarns.has(t.id) && (activeTowerWarns.add(t.id), addAlert('Tower Warning', `${t.id} low battery or high latency!`, 'medium'))) : activeTowerWarns.delete(t.id));
            document.getElementById('telemetry-container').innerHTML = towers.map(t => `<div class="telemetry-item" data-id="${t.id}" style="cursor:pointer;"><div class="telemetry-header"><h4>${t.id}</h4><span class="badge ${t.status === 'online' ? 'badge-success' : 'badge-warning'}">${t.status}</span></div><div class="telemetry-specs"><div class="spec-row"><span>📍 Lane:</span><span>${t.location}</span></div><div class="spec-row"><span>🔋 Battery:</span><span>${t.battery}%</span></div><div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${t.battery}%;background:${t.battery > 50 ? 'var(--success)' : 'var(--warning)'}"></div></div><div class="spec-row"><span>☀️ Solar Output:</span><span>${t.solar_output}W</span></div><div class="spec-row"><span>📶 Latency:</span><span>${t.latency}ms</span></div><div class="telemetry-sparkline-box" id="sparkline-${t.id}"></div></div></div>`).join('');
            if (typeof window.renderTelemetrySparklines === 'function') window.renderTelemetrySparklines(towers);
            const coords = { 'Tower-Alpha': {x:'20%',y:'30%'}, 'Tower-Beta': {x:'80%',y:'50%'}, 'Tower-Gamma': {x:'50%',y:'80%'} };
            document.getElementById('map-pins-container').innerHTML = towers.map(t => { const c = coords[t.id] || {x:'50%',y:'50%'}; return `<div class="map-marker-pin ${t.status}" style="left:${c.x};top:${c.y};" data-id="${t.id}"><span>${t.id}</span></div>`; }).join('');
        } catch (err) { console.error(err); }
    }

    function generateSVGChart(bHist, sHist) {
        const getPts = (d, max) => d.map((v, i) => ({x: (i/5)*360 + 20, y: 135 - (v/max)*100})), b = getPts(bHist, 100), s = getPts(sHist, 150), pStr = pts => `M ${pts.map(p => `${p.x} ${p.y}`).join(' L ')}`;
        return `<svg viewBox="0 0 400 150" style="width:100%"><defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/></linearGradient><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.4"/><stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/></linearGradient></defs><line x1="20" y1="35" x2="380" y2="35" stroke="#1e293b" stroke-dasharray="3"/><line x1="20" y1="85" x2="380" y2="85" stroke="#1e293b" stroke-dasharray="3"/><line x1="20" y1="135" x2="380" y2="135" stroke="#1e293b"/><path d="${pStr(b)} L 380 135 L 20 135 Z" fill="url(#gb)"/><path d="${pStr(s)} L 380 135 L 20 135 Z" fill="url(#gs)"/><path d="${pStr(b)}" fill="none" stroke="#38bdf8" stroke-width="2.5"/><path d="${pStr(s)}" fill="none" stroke="#fbbf24" stroke-width="2.5"/><text x="25" y="20" fill="#38bdf8" font-size="9" font-family="sans-serif" font-weight="600">🔋 Battery Level (%)</text><text x="180" y="20" fill="#fbbf24" font-size="9" font-family="sans-serif" font-weight="600">☀️ Solar Output (W)</text></svg>`;
    }

    const telemetryModal = document.getElementById('telemetry-modal');
    let activeTelemetryTowerId = 'Tower-Alpha';
    const openTelemetryTrends = (id) => {
        activeTelemetryTowerId = id || activeTelemetryTowerId; document.getElementById('telemetry-modal-title').textContent = `${activeTelemetryTowerId} Telemetry Trends`;
        const activeSel = document.querySelector('.time-selector.active'), hrs = activeSel ? parseInt(activeSel.dataset.hours) : 6, scale = hrs === 24 ? 1.05 : (hrs === 168 ? 1.25 : 1.0), iden = activeTelemetryTowerId;
        const bBase = iden === 'Tower-Beta' ? [90,92,91,93,90,92] : (iden === 'Tower-Gamma' ? [45,42,38,32,28,26] : [84,83,85,84,83,84]), sBase = iden === 'Tower-Beta' ? [95,92,98,102,96,99] : (iden === 'Tower-Gamma' ? [15,12,8,4,3,2] : [120,118,122,125,119,123]);
        document.getElementById('telemetry-chart-container').innerHTML = generateSVGChart(bBase.map(v => Math.min(Math.round(v * (2 - scale)), 100)), sBase.map(v => Math.min(Math.round(v * scale), 150)));
        telemetryModal.classList.remove('hidden');
    };
    document.getElementById('telemetry-container').onclick = (e) => { const item = e.target.closest('.telemetry-item'); if (item) openTelemetryTrends(item.dataset.id); };
    document.getElementById('map-pins-container').onclick = (e) => { const pin = e.target.closest('.map-marker-pin'); if (pin) openTelemetryTrends(pin.dataset.id); };
    document.querySelectorAll('.time-selector').forEach(btn => btn.onclick = () => { document.querySelectorAll('.time-selector').forEach(b => b.classList.toggle('active', b === btn)); openTelemetryTrends(); });
    let editingHullId = null;
    const regModal = document.getElementById('register-modal'), regForm = document.getElementById('register-form');
    document.getElementById('btn-open-register').onclick = () => {
        editingHullId = null;
        regModal.querySelector('h3').textContent = 'Register OHT Vehicle';
        regForm.reset();
        regModal.classList.remove('hidden');
    };
    ['btn-close-register', 'register-modal-overlay'].forEach(id => document.getElementById(id).onclick = () => regModal.classList.add('hidden'));
    ['btn-close-telemetry', 'telemetry-modal-overlay'].forEach(id => document.getElementById(id).onclick = () => telemetryModal.classList.add('hidden'));
    
    regForm.onsubmit = async (e) => {
        e.preventDefault();
        const payload = {
            hull_id: document.getElementById('reg-hull-id').value,
            contractor: document.getElementById('reg-contractor').value,
            model: document.getElementById('reg-model').value,
            status: document.getElementById('reg-status').value
        };
        const url = editingHullId ? `/api/trucks/${editingHullId}` : '/api/trucks';
        const method = editingHullId ? 'PUT' : 'POST';
        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(await res.text());
            regModal.classList.add('hidden');
            regForm.reset();
            loadFleetData();
            showToast(editingHullId ? 'OHT vehicle updated successfully!' : 'OHT vehicle registered successfully!');
        } catch (err) {
            alert(err.message);
        }
    };
    document.getElementById('btn-refresh-feed').onclick = loadDashboardData; document.getElementById('btn-refresh-reports').onclick = loadReportsData;
    ['report-search-input', 'report-lane-filter'].forEach(id => document.getElementById(id).oninput = document.getElementById(id).onchange = renderReports);
    document.getElementById('btn-export-csv').onclick = () => { const q = document.getElementById('report-search-input').value, l = document.getElementById('report-lane-filter').value, d = document.getElementById('report-dir-filter').value; window.open(`/api/reports/export-csv?query=${encodeURIComponent(q)}&lane=${encodeURIComponent(l)}&direction=${encodeURIComponent(d)}`); };
    const pModal = document.getElementById('print-modal'), pForm = document.getElementById('print-settings-form');
    document.getElementById('btn-print-report').onclick = () => pModal.classList.remove('hidden');
    ['btn-close-print-modal', 'print-modal-overlay'].forEach(id => document.getElementById(id).onclick = () => pModal.classList.add('hidden'));
    pForm.onsubmit = (e) => {
        e.preventDefault();
        const t = document.getElementById('print-custom-title').value || 'Integrated Smart Hauling Dashboard Report';
        const sd = document.getElementById('print-start-date').value, ed = document.getElementById('print-end-date').value;
        document.getElementById('print-title-val').textContent = t;
        document.getElementById('print-date-val').textContent = sd && ed ? `Report Period: ${sd} to ${ed}` : (sd ? `Report Period: Since ${sd}` : (ed ? `Report Period: Up to ${ed}` : `Report Date: ${new Date().toLocaleDateString()}`));
        pModal.classList.add('hidden'); window.print();
    };
    const btnSync = document.getElementById('btn-sync-cloud'), syncIndicator = document.getElementById('sync-status-indicator');
    btnSync.onclick = async () => { btnSync.disabled = true; btnSync.textContent = 'Syncing...'; try { const r = await (await fetch('/api/reports/sync', { method: 'POST' })).json(); syncIndicator.textContent = `Last sync: Success (Synced ${r.synchronized_records_count} logs)`; syncIndicator.style.color = 'var(--success)'; } catch (e) { syncIndicator.textContent = 'Last sync: Failed'; syncIndicator.style.color = 'var(--danger)'; } finally { btnSync.disabled = false; btnSync.textContent = '☁ Sync Cloud'; } };
    const themeBtn = document.getElementById('btn-theme-toggle');
    const setTh = em => { document.body.classList.toggle('emerald-theme', em); localStorage.setItem('theme', em ? 'emerald' : 'slate'); themeBtn.textContent = em ? '🌓 Emerald-Green' : '🌓 Slate-Blue'; };
    if (localStorage.getItem('theme') === 'emerald') setTh(true); themeBtn.onclick = () => setTh(!document.body.classList.contains('emerald-theme'));

    let correctingCrossingId = null; const correctModal = document.getElementById('correct-modal'), correctInput = document.getElementById('correct-search-input'), correctSuggestions = document.getElementById('correct-suggestions'), correctForm = document.getElementById('correct-form');
    ['btn-close-correct', 'correct-modal-overlay'].forEach(id => document.getElementById(id).onclick = () => correctModal.classList.add('hidden'));
    correctForm.onsubmit = async (e) => { e.preventDefault(); const val = correctInput.value.trim().toUpperCase(); if (val) { await sendUpdate(correctingCrossingId, { hull_id: val, confidence: 100.0, warning_status: 'normal' }); correctModal.classList.add('hidden'); } };
    correctInput.oninput = () => { const val = correctInput.value.toLowerCase(), matched = fleetTrucks.filter(t => !val || t.hull_id.toLowerCase().includes(val)); if (matched.length) { correctSuggestions.innerHTML = matched.map(t => `<div class="suggestion-item" data-val="${t.hull_id}"><strong>${t.hull_id}</strong> (${t.contractor})</div>`).join(''); correctSuggestions.classList.remove('hidden'); } else { correctSuggestions.classList.add('hidden'); } };
    correctSuggestions.onclick = (e) => { const item = e.target.closest('.suggestion-item'); if (item) { correctInput.value = item.dataset.val; correctSuggestions.classList.add('hidden'); } }; document.addEventListener('click', (e) => { if (!e.target.closest('#correct-search-input') && !e.target.closest('#correct-suggestions')) correctSuggestions.classList.add('hidden'); });

    const getCrossingHull = id => (currentCrossings.find(c => c.id === id) || {}).hull_id || '';
    async function sendUpdate(id, payload) { try { const res = await fetch(`/api/crossings/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); if (!res.ok) throw new Error(await res.text()); } catch (err) { alert(`Update failed: ${err.message}`); } }
    document.getElementById('live-feed-list').oncontextmenu = (e) => {
        const card = e.target.closest('.crossing-feed-card'); if (!card) return; e.preventDefault(); const id = parseInt(card.dataset.id), existing = document.getElementById('active-context-menu'); if (existing) existing.remove();
        const menu = document.body.appendChild(Object.assign(document.createElement('div'), { id: 'active-context-menu', className: 'custom-context-menu', style: `left:${e.clientX}px;top:${e.clientY}px;` }));
        Object.assign(menu.appendChild(document.createElement('button')), { className: 'context-menu-item', textContent: '✔ Quick-Verify', onclick: () => { sendUpdate(id, { hull_id: getCrossingHull(id), confidence: 100.0, warning_status: 'normal' }); menu.remove(); } });
        Object.assign(menu.appendChild(document.createElement('button')), { className: 'context-menu-item', textContent: '✏ Correct Hull ID', onclick: () => { correctingCrossingId = id; correctInput.value = getCrossingHull(id); correctSuggestions.classList.add('hidden'); correctModal.classList.remove('hidden'); setTimeout(() => { correctInput.focus(); if (typeof window.onCorrectModalOpened === 'function') window.onCorrectModalOpened(id); }, 50); menu.remove(); } });
        const close = () => { menu.remove(); document.removeEventListener('click', close); }; setTimeout(() => document.addEventListener('click', close), 50);
    };
    document.getElementById('btn-apply-sim').onclick = async () => {
        const payload = { tower_id: document.getElementById('sim-tower-select').value, status: document.getElementById('sim-status-select').value }, b = document.getElementById('sim-battery').value, s = document.getElementById('sim-solar').value, l = document.getElementById('sim-latency').value; if (b) payload.battery = parseInt(b); if (s) payload.solar_output = parseInt(s); if (l) payload.latency = parseInt(l); try { if ((await fetch('/api/telemetry/simulate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).ok) showToast(`Override applied!`), loadTelemetry(); } catch (e) { alert('Sim failed.'); }
    };
    document.getElementById('btn-reset-sim').onclick = async () => { try { if ((await fetch('/api/telemetry/reset', { method: 'POST' })).ok) showToast('Reset success!'), loadTelemetry(), ['sim-battery', 'sim-solar', 'sim-latency'].forEach(id => document.getElementById(id).value = ''); } catch (e) {} };
    const importBtn = document.getElementById('btn-import-csv'), importInput = document.getElementById('csv-import-input');
    if (importBtn && importInput) {
        importBtn.onclick = () => importInput.click();
        importInput.onchange = async () => {
            if (!importInput.files.length) return;
            const fd = new FormData(); fd.append('file', importInput.files[0]); importBtn.disabled = true; importBtn.textContent = 'Importing...';
            try { const res = await fetch('/api/trucks/import-csv', { method: 'POST', body: fd }); if (!res.ok) throw new Error(await res.text()); const r = await res.json(); showToast(`Import success: ${r.imported} added, ${r.skipped} skipped.`); loadFleetData(); } catch (e) { alert(`CSV Import failed: ${e.message}`); } finally { importBtn.disabled = false; importBtn.textContent = '📥 Import CSV'; importInput.value = ''; }
        };
    }
    const sGlow = document.getElementById('slider-glow'), sBlur = document.getElementById('slider-blur'), vGlow = document.getElementById('val-glow'), vBlur = document.getElementById('val-blur');
    sGlow.oninput = () => { const v = sGlow.value; vGlow.textContent = `${v}%`; document.documentElement.style.setProperty('--glow-intensity', v / 100); };
    sBlur.oninput = () => { const v = sBlur.value; vBlur.textContent = `${v}px`; document.documentElement.style.setProperty('--glass-blur', `${v}px`); };
    loadDashboardData(); setInterval(loadTelemetry, 8000);
});
