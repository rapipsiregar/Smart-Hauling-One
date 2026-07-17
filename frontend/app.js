document.addEventListener('DOMContentLoaded', () => {
    let currentCrossings = [], selectedCrossingId = null;
    window.getCurrentCrossings = () => currentCrossings;
    window.updateDashboardUI = () => updateDashboardUI();
    const navItems = document.querySelectorAll('.nav-item'), tabPanes = document.querySelectorAll('.tab-pane'), pageTitle = document.getElementById('page-title');
 
    navItems.forEach(item => item.addEventListener('click', () => {
        const t = item.dataset.tab; navItems.forEach(i => i.classList.toggle('active', i === item)); tabPanes.forEach(p => p.classList.toggle('active', p.id === `tab-${t}`));
        pageTitle.textContent = item.textContent.trim(); 
        if (t === 'dashboard') loadDashboardData();
        else if (t === 'fleet' && typeof window.loadFleetData === 'function') window.loadFleetData();
        else if (t === 'reports' && typeof window.loadReportsData === 'function') window.loadReportsData();
    }));
 
    const showToast = (msg) => { if (typeof window.showToast === 'function') window.showToast(msg); };
 
    let systemAlerts = [], activeTowerWarns = new Set(); const drawer = document.getElementById('alerts-drawer');
    document.getElementById('btn-toggle-drawer').onclick = () => {
        const backupsDrawer = document.getElementById('backups-drawer');
        const settingsDrawer = document.getElementById('settings-drawer');
        if (backupsDrawer) backupsDrawer.classList.add('hidden');
        if (settingsDrawer) settingsDrawer.classList.add('hidden');
        drawer.classList.toggle('hidden');
    };
    document.getElementById('btn-close-drawer').onclick = () => drawer.classList.add('hidden');
    function addAlert(type, msg, sev = 'medium') {
        if (type) systemAlerts.unshift({ id: Date.now() + Math.random(), type, msg, sev, time: new Date() });
        if (type && typeof window.speakVoiceAlert === 'function') window.speakVoiceAlert(type, msg);
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
 

 
    async function loadDashboardData() {
        window.loadDashboardData = loadDashboardData;
        try {
            const [stats, crossings] = await Promise.all([fetch('/api/stats').then(r => r.json()), fetch('/api/crossings').then(r => r.json())]);
            currentCrossings = crossings;
            document.getElementById('kpi-total').textContent = stats.total_crossings; document.getElementById('kpi-fleet').textContent = stats.active_fleet_size; document.getElementById('kpi-unrecognized').textContent = stats.unrecognized_crossings;
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
        const fleetTrucks = window.fleetTrucks || [];
        const sortOrder = localStorage.getItem('feedSortOrder') || 'desc';
        let sorted = currentCrossings.slice();
        if (sortOrder === 'desc') sorted.reverse();
        sorted.forEach(c => {
            const card = document.createElement('div'), isAlert = c.warning_status === 'low-confidence' || c.confidence < 85;
            card.className = `crossing-feed-card ${c.id === selectedCrossingId ? 'selected' : ''} ${isAlert ? 'low-conf-card' : ''}`; card.dataset.id = c.id; card.dataset.class = c.vehicle_class || 'Dump Truck';
            card.dataset.confidence = c.confidence; card.dataset.warning = c.warning_status; card.dataset.hullId = c.hull_id; card.dataset.direction = c.direction || 'inbound';
            const isUnreg = !fleetTrucks.some(t => t.hull_id === c.hull_id); card.dataset.unregistered = isUnreg ? "true" : "false";
            const addBtnHtml = isUnreg ? `<button class="btn-add-to-fleet" data-hull="${c.hull_id}" style="background:#a855f7; border:none; color:#fff; border-radius:4px; padding:0.1rem 0.35rem; font-size:0.65rem; margin-left:0.5rem; cursor:pointer; font-weight:600;">+ Fleet</button>` : '';
            const badgeClass = c.confidence >= 95 ? 'badge-success' : (c.confidence >= 85 ? 'badge-warning' : 'badge-danger');
            const ipCamera = c.lane.includes('North') ? '192.168.10.15' : (c.lane.includes('South') ? '192.168.10.25' : '192.168.10.35');
            const bboxX = (0.32 + (c.id % 12) * 0.02).toFixed(2);
            const bboxY = (0.41 + (c.id % 7) * 0.02).toFixed(2);
            const bboxW = (0.12 + (c.id % 4) * 0.01).toFixed(2);
            const bboxH = (0.06 + (c.id % 3) * 0.01).toFixed(2);
            const samSeg = (c.confidence * 0.94).toFixed(1);

            const detailsHtml = `
                <div class="feed-card-details">
                    <div style="font-weight:600; color:var(--primary); margin-bottom:0.15rem; display:flex; align-items:center; gap:0.25rem;">🔍 Edge OCR Proof Metadata</div>
                    <div class="metadata-grid">
                        <div class="metadata-item"><span class="metadata-label">IP Camera:</span><span class="metadata-value">${ipCamera}</span></div>
                        <div class="metadata-item"><span class="metadata-label">OCR Conf:</span><span class="metadata-value">${c.confidence}%</span></div>
                        <div class="metadata-item"><span class="metadata-label">BBox X/Y:</span><span class="metadata-value">${bboxX}, ${bboxY}</span></div>
                        <div class="metadata-item"><span class="metadata-label">BBox W/H:</span><span class="metadata-value">${bboxW} x ${bboxH}</span></div>
                        <div class="metadata-item"><span class="metadata-label">SAM Seg:</span><span class="metadata-value">${samSeg}%</span></div>
                        <div class="metadata-item"><span class="metadata-label">FPS/Res:</span><span class="metadata-value">30 / 1080p</span></div>
                    </div>
                </div>
            `;

            card.innerHTML = `<div class="feed-row-top"><span><span class="oht-id">${c.hull_id}</span>${addBtnHtml}</span><span><span class="badge ${badgeClass}">${c.confidence}%</span>${c.confidence < 100 ? `<button class="btn-quick-verify" title="Quick Verify" style="background:none; border:none; color:var(--success); cursor:pointer; font-size:1rem; padding:0 0.15rem; margin-left:0.35rem; display:inline-flex; align-items:center; vertical-align:middle;">✔</button>` : ''}</span></div><div class="feed-row-mid"><div class="feed-thumb"><img src="${c.crop_image_path}"></div><div class="feed-thumb"><img src="${c.context_image_path}"></div></div><div class="feed-row-bot"><span>📍 ${c.lane}</span><span>🕒 ${new Date(c.timestamp).toLocaleTimeString()}</span></div>${detailsHtml}`;
            const qv = card.querySelector('.btn-quick-verify'); if (qv) qv.onclick = (e) => { e.stopPropagation(); sendUpdate(c.id, { hull_id: c.hull_id, confidence: 100.0, warning_status: 'normal' }); };
            card.addEventListener('click', () => selectCrossing(c.id)); feedList.appendChild(card);
        });
        if (typeof window.renderSubcontractorComplianceWidget === 'function') window.renderSubcontractorComplianceWidget();
        if (typeof window.renderContractorForecastWidget === 'function') window.renderContractorForecastWidget();
    }
 
    function selectCrossing(id) {
        selectedCrossingId = id; document.querySelectorAll('.crossing-feed-card').forEach(c => c.classList.toggle('selected', c.dataset.id == id));
        const c = currentCrossings.find(x => x.id == id);
        if (c) {
            document.getElementById('audit-crop-img').src = c.crop_image_path; document.getElementById('audit-context-img').src = c.context_image_path;
            document.getElementById('audit-details').innerHTML = `<div><strong>OHT:</strong> ${c.hull_id} (${c.confidence}%)</div><div>📍 ${c.lane} | ${c.direction} | 🕒 ${new Date(c.timestamp).toLocaleString()}</div>`;
        }
    }
 
    async function loadTelemetry() {
        try {
            const towers = await (await fetch('/api/telemetry/towers')).json();
            towers.forEach(t => t.status === 'warning' ? (!activeTowerWarns.has(t.id) && (activeTowerWarns.add(t.id), addAlert('Tower Warning', `${t.id} low battery or high latency!`, 'medium'))) : activeTowerWarns.delete(t.id));
            document.getElementById('telemetry-container').innerHTML = towers.map(t => `<div class="telemetry-item" data-id="${t.id}" style="cursor:pointer;"><div class="telemetry-header"><h4>${t.id}</h4><span class="badge ${t.status === 'online' ? 'badge-success' : 'badge-warning'}">${t.status}</span></div><div class="telemetry-specs"><div class="spec-row"><span>📍 Lane:</span><span>${t.location}</span></div><div class="spec-row"><span>🔋 Battery:</span><span>${t.battery}%</span></div><div class="dist-bar-bg"><div class="dist-bar-fill" style="width:${t.battery}%;background:${t.battery > 50 ? 'var(--success)' : 'var(--warning)'}"></div></div><div class="spec-row"><span>☀️ Solar Output:</span><span>${t.solar_output}W</span></div><div class="spec-row"><span>📶 Latency:</span><span>${t.latency}ms</span></div><div class="telemetry-sparkline-box" id="sparkline-${t.id}"></div></div></div>`).join('');
            if (typeof window.renderTelemetrySparklines === 'function') window.renderTelemetrySparklines(towers);
            const getSignalHTML = (label, snr, type, isOffline) => {
                let barsActive = 0, colorClass = 'offline';
                if (!isOffline) {
                    if (type === 'uhf') {
                        if (snr >= 25) { barsActive = 4; colorClass = 'excellent'; }
                        else if (snr >= 18) { barsActive = 3; colorClass = 'good'; }
                        else if (snr >= 12) { barsActive = 2; colorClass = 'moderate'; }
                        else { barsActive = 1; colorClass = 'poor'; }
                    } else {
                        if (snr >= 28) { barsActive = 4; colorClass = 'excellent'; }
                        else if (snr >= 20) { barsActive = 3; colorClass = 'good'; }
                        else if (snr >= 14) { barsActive = 2; colorClass = 'moderate'; }
                        else { barsActive = 1; colorClass = 'poor'; }
                    }
                }
                return `<div style="display:flex;align-items:center;gap:3px;" title="${label}: ${isOffline ? 'Offline' : snr + ' dB'}"><span style="font-size:0.55rem;font-weight:600;color:var(--text-secondary);">${label}</span><div class="signal-bars ${colorClass}"><span class="bar bar-1 ${barsActive>=1?'active':''}"></span><span class="bar bar-2 ${barsActive>=2?'active':''}"></span><span class="bar bar-3 ${barsActive>=3?'active':''}"></span><span class="bar bar-4 ${barsActive>=4?'active':''}"></span></div></div>`;
            };
            const coords = { 'Tower-Alpha': {x:'20%',y:'30%'}, 'Tower-Beta': {x:'80%',y:'50%'}, 'Tower-Gamma': {x:'50%',y:'80%'} };
            document.getElementById('map-pins-container').innerHTML = towers.map(t => {
                const c = coords[t.id] || {x:'50%',y:'50%'};
                const isOffline = t.status === 'offline';
                const health = t.connection_health || { uhf: { snr_db: 0 }, lte: { snr_db: 0 } };
                const uhfSnr = health.uhf ? health.uhf.snr_db : 0;
                const lteSnr = health.lte ? health.lte.snr_db : 0;
                return `<div class="map-marker-pin ${t.status}" style="left:${c.x};top:${c.y};" data-id="${t.id}"><span>${t.id}</span><div class="signal-indicator-row">${getSignalHTML('UHF', uhfSnr, 'uhf', isOffline)}${getSignalHTML('LTE', lteSnr, 'lte', isOffline)}</div></div>`;
            }).join('');
        } catch (err) { console.error(err); }
    }
 
    function generateSVGChart(bHist, sHist) {
        const getPts = (d, max) => d.map((v, i) => ({x: (i/5)*360 + 20, y: 135 - (v/max)*100})), b = getPts(bHist, 100), s = getPts(sHist, 150), pStr = pts => `M ${pts.map(p => `${p.x} ${p.y}`).join(' L ')}`;
        return `<svg viewBox="0 0 400 150" style="width:100%"><defs><linearGradient id="gb" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#38bdf8" stop-opacity="0.4"/><stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/></linearGradient><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.4"/><stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/></linearGradient></defs><line x1="20" y1="35" x2="380" y2="35" stroke="#1e293b" stroke-dasharray="3"/><line x1="20" y1="85" x2="380" y2="85" stroke="#1e293b" stroke-dasharray="3"/><line x1="20" y1="135" x2="380" y2="135" stroke="#1e293b"/><path d="${pStr(b)} L 380 135 L 20 135 Z" fill="url(#gb)"/><path d="${pStr(s)} L 380 135 L 20 135 Z" fill="url(#gs)"/><path d="${pStr(b)}" fill="none" stroke="#38bdf8" stroke-width="2.5"/><path d="${pStr(s)}" fill="none" stroke="#fbbf24" stroke-width="2.5"/><text x="25" y="20" fill="#38bdf8" font-size="9" font-family="sans-serif" font-weight="600">🔋 Battery Level (%)</text><text x="180" y="20" fill="#fbbf24" font-size="9" font-family="sans-serif" font-weight="600">☀️ Solar Output (W)</text></svg>`;
    }
 
    const telemetryModal = document.getElementById('telemetry-modal'); let activeTelemetryTowerId = 'Tower-Alpha';
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
    ['btn-close-telemetry', 'telemetry-modal-overlay'].forEach(id => document.getElementById(id).onclick = () => telemetryModal.classList.add('hidden'));
 
    document.getElementById('btn-refresh-feed').onclick = loadDashboardData;
    const themeBtn = document.getElementById('btn-theme-toggle');
    const setTh = em => { document.body.classList.toggle('emerald-theme', em); localStorage.setItem('theme', em ? 'emerald' : 'slate'); themeBtn.textContent = em ? '🌓 Emerald-Green' : '🌓 Slate-Blue'; };
    if (localStorage.getItem('theme') === 'emerald') setTh(true); themeBtn.onclick = () => setTh(!document.body.classList.contains('emerald-theme'));
 
    let correctingCrossingId = null; const correctModal = document.getElementById('correct-modal'), correctInput = document.getElementById('correct-search-input'), correctSuggestions = document.getElementById('correct-suggestions'), correctForm = document.getElementById('correct-form');
    ['btn-close-correct', 'correct-modal-overlay'].forEach(id => document.getElementById(id).onclick = () => correctModal.classList.add('hidden'));
    correctForm.onsubmit = async (e) => { e.preventDefault(); const val = correctInput.value.trim().toUpperCase(); if (val) { await sendUpdate(correctingCrossingId, { hull_id: val, confidence: 100.0, warning_status: 'normal' }); correctModal.classList.add('hidden'); } };
    correctInput.oninput = () => { const val = correctInput.value.toLowerCase(), matched = (window.fleetTrucks || []).filter(t => !val || t.hull_id.toLowerCase().includes(val)); if (matched.length) { correctSuggestions.innerHTML = matched.map(t => `<div class="suggestion-item" data-val="${t.hull_id}"><strong>${t.hull_id}</strong> (${t.contractor})</div>`).join(''); correctSuggestions.classList.remove('hidden'); } else { correctSuggestions.classList.add('hidden'); } };
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
            try { const res = await fetch('/api/trucks/import-csv', { method: 'POST', body: fd }); if (!res.ok) throw new Error(await res.text()); const r = await res.json(); showToast(`Import success: ${r.imported} added, ${r.skipped} skipped.`); if (typeof window.loadFleetData === 'function') window.loadFleetData(); } catch (e) { alert(`CSV Import failed: ${e.message}`); } finally { importBtn.disabled = false; importBtn.textContent = '📥 Import CSV'; importInput.value = ''; }
        };
    }
    const sGlow = document.getElementById('slider-glow'), sBlur = document.getElementById('slider-blur'), vGlow = document.getElementById('val-glow'), vBlur = document.getElementById('val-blur');
    sGlow.oninput = () => { const v = sGlow.value; vGlow.textContent = `${v}%`; document.documentElement.style.setProperty('--glow-intensity', v / 100); };
    sBlur.oninput = () => { const v = sBlur.value; vBlur.textContent = `${v}px`; document.documentElement.style.setProperty('--glass-blur', `${v}px`); };
    
    // Initial data load and hooks registration
    if (typeof window.loadFleetData === 'function') {
        window.loadFleetData().then(() => {
            loadDashboardData();
        });
    } else {
        loadDashboardData();
    }
    setInterval(loadTelemetry, 8000);
});
