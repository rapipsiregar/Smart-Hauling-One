document.addEventListener('DOMContentLoaded', () => {
    const btnDemo = document.getElementById('btn-mode-demo');
    const btnLive = document.getElementById('btn-mode-live');
    if (!btnDemo || !btnLive) return;

    async function setSystemMode(mode) {
        try {
            const res = await fetch('/api/admin/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode })
            });
            const data = await res.json();
            
            btnDemo.classList.toggle('active', data.mode === 'demo');
            btnLive.classList.toggle('active', data.mode === 'live');
            
            if (data.mode === 'demo') {
                btnDemo.style.color = '#fff';
                btnLive.style.color = 'var(--text-secondary)';
            } else {
                btnDemo.style.color = 'var(--text-secondary)';
                btnLive.style.color = '#fff';
            }
            
            if (typeof window.loadDashboardData === 'function') {
                window.loadDashboardData();
            }
            if (typeof window.loadReportsData === 'function') {
                window.loadReportsData();
            }

            if (window.showToast) {
                window.showToast(`System switched to ${mode.toUpperCase()} mode!`, 'success');
            }
        } catch (err) {
            console.error(err);
            if (window.showToast) {
                window.showToast("Failed to update system mode.", "danger");
            }
        }
    }

    async function loadSystemMode() {
        try {
            const res = await fetch('/api/admin/mode');
            const data = await res.json();
            
            btnDemo.classList.toggle('active', data.mode === 'demo');
            btnLive.classList.toggle('active', data.mode === 'live');
            
            if (data.mode === 'demo') {
                btnDemo.style.color = '#fff';
                btnLive.style.color = 'var(--text-secondary)';
            } else {
                btnDemo.style.color = 'var(--text-secondary)';
                btnLive.style.color = '#fff';
            }
        } catch (err) {
            console.error(err);
        }
    }

    btnDemo.onclick = () => setSystemMode('demo');
    btnLive.onclick = () => setSystemMode('live');

    loadSystemMode();
});
