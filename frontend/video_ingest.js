document.addEventListener('DOMContentLoaded', () => {
    const sampleSelect = document.getElementById('sample-select');
    if (!sampleSelect) return;

    async function loadSampleVideos() {
        try {
            const res = await fetch('/api/sample-videos');
            if (res.ok) {
                const videos = await res.json();
                videos.forEach(v => {
                    const opt = document.createElement('option'); opt.value = v.filename; opt.textContent = `${v.filename} (${(v.size_bytes / (1024 * 1024)).toFixed(2)} MB)`;
                    sampleSelect.appendChild(opt);
                });
            }
        } catch (err) { console.error('Failed to load sample videos:', err); }
    }
    loadSampleVideos();
 
    const dz = document.getElementById('video-dropzone'), fi = document.getElementById('video-input'), fn = document.getElementById('selected-filename'); let selectedFile = null;
    const ingestVideo = document.getElementById('ingest-video-player'), processPrompt = document.getElementById('process-prompt');
    const ingestForm = document.getElementById('ingest-form'), processPanel = document.getElementById('process-panel'), processLoader = document.getElementById('process-loader'), processResult = document.getElementById('process-result'), resultDetails = document.getElementById('result-details'), submitBtn = document.getElementById('btn-submit-ingest');
 
    function updateIngestPreview() {
        const sampleVal = sampleSelect.value;
        if (selectedFile) {
            ingestVideo.src = URL.createObjectURL(selectedFile); processPanel.classList.remove('hidden'); processPrompt.classList.remove('hidden'); processLoader.classList.add('hidden'); processResult.classList.add('hidden');
        } else if (sampleVal) {
            ingestVideo.src = `/playlist/${sampleVal}`; processPanel.classList.remove('hidden'); processPrompt.classList.remove('hidden'); processLoader.classList.add('hidden'); processResult.classList.add('hidden');
        } else {
            ingestVideo.src = ''; processPanel.classList.add('hidden');
        }
    }
    if (dz) dz.onclick = () => fi.click();
    if (dz) {
        dz.ondragover = (e) => { e.preventDefault(); dz.style.borderColor = 'var(--primary)'; };
        dz.ondragleave = () => { dz.style.borderColor = 'var(--border)'; };
        dz.ondrop = (e) => { e.preventDefault(); dz.style.borderColor = 'var(--border)'; if (e.dataTransfer.files.length) { selectedFile = e.dataTransfer.files[0]; fn.textContent = selectedFile.name; sampleSelect.value = ''; updateIngestPreview(); } };
    }
    if (fi) fi.onchange = () => { if (fi.files.length) { selectedFile = fi.files[0]; fn.textContent = selectedFile.name; sampleSelect.value = ''; updateIngestPreview(); } };
    sampleSelect.onchange = () => { if (sampleSelect.value) { selectedFile = null; fi.value = ''; fn.textContent = ''; updateIngestPreview(); } };
 
    if (ingestForm) {
        ingestForm.onsubmit = async (e) => {
            e.preventDefault();
            const sampleVal = sampleSelect.value;
            if (!selectedFile && !sampleVal) return alert('Please select a video file or sample video');
            processPrompt.classList.add('hidden'); processLoader.classList.remove('hidden'); submitBtn.disabled = true;
            const formData = new FormData();
            if (selectedFile) formData.append('file', selectedFile);
            else formData.append('sample_filename', sampleVal);
            try {
                const res = await fetch('/api/process-video', { method: 'POST', body: formData });
                const data = await res.json();
                processLoader.classList.add('hidden'); processResult.classList.remove('hidden'); submitBtn.disabled = false;
                if (res.ok) {
                    document.getElementById('result-success-title').textContent = '✅ Ingestion Completed Successfully';
                    resultDetails.innerHTML = `<div style="color:var(--primary); font-weight:700;">Hull ID: ${data.hull_id} (${(data.confidence * 100).toFixed(1)}%)</div><div>Lane: ${data.lane}</div><div>Direction: ${data.direction}</div>`;
                    if (window.showToast) window.showToast(`OCR Success: Detected ${data.hull_id}`, 'success');
                    if (window.updateDashboardUI) window.updateDashboardUI();
                } else {
                    document.getElementById('result-success-title').textContent = '❌ Ingestion Failed';
                    resultDetails.innerHTML = `<div style="color:var(--danger);">${data.detail || 'Internal server error'}</div>`;
                }
            } catch (err) {
                processLoader.classList.add('hidden'); processResult.classList.remove('hidden'); submitBtn.disabled = false;
                document.getElementById('result-success-title').textContent = '❌ Connection Error';
                resultDetails.innerHTML = `<div style="color:var(--danger);">${err.message}</div>`;
            }
        };
    }
});
