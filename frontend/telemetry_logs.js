document.addEventListener('DOMContentLoaded', () => {
    const btnToggle = document.getElementById('btn-toggle-tel-logs');
    const container = document.getElementById('tel-logs-container');
    const tbody = document.getElementById('tel-logs-tbody');
    const btnPrev = document.getElementById('btn-tel-prev');
    const btnNext = document.getElementById('btn-tel-next');
    const pageInfo = document.getElementById('tel-page-info');

    if (!btnToggle) return;

    let allLogs = [];
    let currentPage = 1;
    const pageSize = 15;

    btnToggle.onclick = () => {
        const isHidden = container.classList.toggle('hidden');
        btnToggle.textContent = isHidden ? '📋 View Telemetry Logs History' : '✖ Close Telemetry Logs';
        if (!isHidden) {
            loadTelemetryHistory();
        }
    };

    async function loadTelemetryHistory() {
        try {
            const res = await fetch('/api/telemetry/history');
            if (res.ok) {
                allLogs = await res.json();
                renderPage();
            }
        } catch (e) {
            console.error('Failed to load telemetry history:', e);
        }
    }

    function renderPage() {
        const totalPages = Math.max(Math.ceil(allLogs.length / pageSize), 1);
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageLogs = allLogs.slice(start, end);

        tbody.innerHTML = pageLogs.length ? pageLogs.map(l => `
            <tr>
                <td>${new Date(l.timestamp).toLocaleString()}</td>
                <td><strong>${l.tower_id}</strong></td>
                <td>${l.battery}%</td>
                <td>${l.solar_output}W</td>
                <td>${l.latency}ms</td>
            </tr>
        `).join('') : '<tr><td colspan="5" style="text-align:center; color:var(--text-secondary);">No telemetry logs captured yet. Try running simulator overrides to populate logs.</td></tr>';

        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        btnPrev.disabled = currentPage <= 1;
        btnNext.disabled = currentPage >= totalPages;
    }

    btnPrev.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
        }
    };

    btnNext.onclick = () => {
        const totalPages = Math.max(Math.ceil(allLogs.length / pageSize), 1);
        if (currentPage < totalPages) {
            currentPage++;
            renderPage();
        }
    };

    // Auto refresh logs when expanded and telemetry updates (every 8 seconds)
    setInterval(() => {
        if (!container.classList.contains('hidden')) {
            loadTelemetryHistory();
        }
    }, 8000);
});
