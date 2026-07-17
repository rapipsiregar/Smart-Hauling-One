document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-db-vacuum');
    const status = document.getElementById('vacuum-status');
    const timerText = document.getElementById('vacuum-timer');
    if (!btn || !status || !timerText) return;

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        status.classList.remove('hidden');
        
        const startTime = Date.now();
        timerText.textContent = '0.0s';
        
        const timerInterval = setInterval(() => {
            const duration = ((Date.now() - startTime) / 1000).toFixed(1);
            timerText.textContent = `${duration}s`;
        }, 100);

        try {
            const res = await fetch('/api/admin/db-vacuum', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                if (window.showToast) {
                    const sizeMB = (data.database_size_bytes / (1024 * 1024)).toFixed(2);
                    window.showToast(`Database optimized! New size: ${sizeMB} MB`, 'success');
                }
            } else {
                throw new Error(data.detail || 'Optimization failed');
            }
        } catch (err) {
            console.error(err);
            if (window.showToast) {
                window.showToast(err.message || 'Failed to optimize database.', 'danger');
            }
        } finally {
            clearInterval(timerInterval);
            status.classList.add('hidden');
            btn.disabled = false;
        }
    });
});
