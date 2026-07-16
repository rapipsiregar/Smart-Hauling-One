document.addEventListener('DOMContentLoaded', () => {
    let currentCrossings = [], selectedCrossingId = null;

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
    }));

    // WebSocket Real-time Feed
    function connectWS() {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
        ws.onmessage = (e) => {
            try {
                const c = JSON.parse(e.data);
                currentCrossings.push(c);
                updateDashboardUI();
                selectCrossing(c.id);
            } catch (err) { console.error('WS JSON error:', err); }
        };
        ws.onclose = () => setTimeout(connectWS, 3000);
        ws.onerror = (err) => { console.error('WS error:', err); ws.close(); };
    }
    connectWS();

    // Ingest Upload dropzone
    const dropzone = document.getElementById('video-dropzone');
    const fileInput = document.getElementById('video-input');
    const filenameDisplay = document.getElementById('selected-filename');
    let selectedFile = null;

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.style.borderColor = '#38bdf8'; });
    dropzone.addEventListener('dragleave', () => dropzone.style.borderColor = '');
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault(); dropzone.style.borderColor = '';
        if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) handleFileSelect(fileInput.files[0]);
    });
    const handleFileSelect = (f) => {
        selectedFile = f;
        filenameDisplay.textContent = `Selected: ${f.name} (${(f.size / (1024*1024)).toFixed(2)} MB)`;
    };

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
        processPanel.classList.remove('hidden');
        processLoader.classList.remove('hidden');
        processResult.classList.add('hidden');

        const fd = new FormData();
        fd.append('file', selectedFile);
        fd.append('lane', document.getElementById('lane-select').value);
        fd.append('direction', document.getElementById('direction-select').value);

        try {
            const res = await fetch('/api/process-video', { method: 'POST', body: fd });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            processLoader.classList.add('hidden');
            processResult.classList.remove('hidden');
            resultDetails.innerHTML = `
                <div><strong>Log ID:</strong> #${data.id}</div>
                <div><strong>Hull ID:</strong> ${data.hull_id}</div>
                <div><strong>Confidence:</strong> ${data.confidence}%</div>
                <div><strong>Lane:</strong> ${data.lane}</div>
                <div><strong>Direction:</strong> ${data.direction}</div>
                <div><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString()}</div>
            `;
            selectedFile = null; filenameDisplay.textContent = ''; ingestForm.reset();
        } catch (err) {
            alert(`OCR Failed: ${err.message}`); processPanel.classList.add('hidden');
        } finally { submitBtn.disabled = false; }
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
            distContainer.innerHTML = '';
            const total = stats.total_crossings || 1;
            Object.entries(stats.lane_distribution).forEach(([lane, count]) => {
                const percentage = ((count / total) * 100).toFixed(0);
                distContainer.innerHTML += `
                    <div class="distribution-item">
                        <div class="dist-label-row"><span>${lane}</span><span>${count} (${percentage}%)</span></div>
                        <div class="dist-bar-bg"><div class="dist-bar-fill" style="width: ${percentage}%"></div></div>
                    </div>
                `;
            });

            updateDashboardUI();
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
            card.innerHTML = `
                <div class="feed-row-top"><span class="oht-id">${c.hull_id}</span><span class="badge ${badgeClass}">${c.confidence}%</span></div>
                <div class="feed-row-mid">
                    <div class="feed-thumb"><img src="${c.crop_image_path}"></div>
                    <div class="feed-thumb"><img src="${c.context_image_path}"></div>
                </div>
                <div class="feed-row-bot"><span>📍 ${c.lane}</span><span>🕒 ${new Date(c.timestamp).toLocaleTimeString()}</span></div>
            `;
            card.addEventListener('click', () => selectCrossing(c.id));
            feedList.appendChild(card);
        });
    }

    function selectCrossing(id) {
        selectedCrossingId = id;
        document.querySelectorAll('.crossing-feed-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.id == id);
        });
        const crossing = currentCrossings.find(c => c.id == id);
        if (crossing) {
            document.getElementById('audit-crop-img').src = crossing.crop_image_path;
            document.getElementById('audit-context-img').src = crossing.context_image_path;
            document.getElementById('audit-details').innerHTML = `
                <div><strong>OHT Hull ID:</strong> ${crossing.hull_id} | <strong>Confidence Score:</strong> ${crossing.confidence}%</div>
                <div><strong>Checkpoint Lane:</strong> ${crossing.lane} | <strong>Direction:</strong> ${crossing.direction}</div>
                <div><strong>Timestamp Logged:</strong> ${new Date(crossing.timestamp).toLocaleString()}</div>
            `;
        }
    }

    // Load & Render Fleet
    async function loadFleetData() {
        try {
            const res = await fetch('/api/trucks');
            const trucks = await res.json();
            const tbody = document.getElementById('fleet-tbody');
            tbody.innerHTML = '';
            trucks.forEach(t => {
                tbody.innerHTML += `
                    <tr>
                        <td><strong>${t.hull_id}</strong></td>
                        <td>${t.contractor}</td>
                        <td>${t.model}</td>
                        <td><span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-danger'}">${t.status}</span></td>
                    </tr>
                `;
            });
        } catch (err) { console.error('Load fleet error:', err); }
    }

    // Modal Control: Register OHT
    const registerModal = document.getElementById('register-modal');
    const registerForm = document.getElementById('register-form');
    const toggleModal = (modal, show) => modal.classList.toggle('hidden', !show);

    document.getElementById('btn-open-register').addEventListener('click', () => toggleModal(registerModal, true));
    document.getElementById('btn-close-register').addEventListener('click', () => toggleModal(registerModal, false));
    document.getElementById('register-modal-overlay').addEventListener('click', () => toggleModal(registerModal, false));

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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(await res.text());
            toggleModal(registerModal, false);
            registerForm.reset();
            loadFleetData();
        } catch (err) { alert(`Failed to register OHT: ${err.message}`); }
    });

    document.getElementById('btn-refresh-feed').addEventListener('click', loadDashboardData);

    // Initial Load
    loadDashboardData();
});
