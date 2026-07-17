document.addEventListener('DOMContentLoaded', () => {
    const btnExportCsv = document.getElementById('btn-export-csv');
    if (btnExportCsv) {
        btnExportCsv.onclick = () => {
            const searchInput = document.getElementById('report-search-input');
            const laneFilter = document.getElementById('report-lane-filter');
            const dirFilter = document.getElementById('report-dir-filter');
            
            const q = searchInput ? searchInput.value : '';
            const l = laneFilter ? laneFilter.value : '';
            const d = dirFilter ? dirFilter.value : '';
            window.open(`/api/reports/export-csv?query=${encodeURIComponent(q)}&lane=${encodeURIComponent(l)}&direction=${encodeURIComponent(d)}`);
        };
    }

    const btnSync = document.getElementById('btn-sync-cloud');
    const syncIndicator = document.getElementById('sync-status-indicator');
    if (btnSync && syncIndicator) {
        btnSync.onclick = async () => {
            btnSync.disabled = true; 
            btnSync.textContent = 'Syncing...'; 
            try { 
                const r = await (await fetch('/api/reports/sync', { method: 'POST' })).json(); 
                syncIndicator.textContent = `Last sync: Success (Synced ${r.synchronized_records_count} logs)`; 
                syncIndicator.style.color = 'var(--success)'; 
            } catch (e) { 
                syncIndicator.textContent = 'Last sync: Failed'; 
                syncIndicator.style.color = 'var(--danger)'; 
            } finally { 
                btnSync.disabled = false; 
                btnSync.textContent = '☁ Sync Cloud'; 
            }
        };
    }
});
