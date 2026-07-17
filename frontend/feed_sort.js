document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-feed-sort-toggle');
    if (!btn) return;

    const updateButtonLabel = (order) => {
        btn.textContent = order === 'desc' ? '⇣ Newest' : '⇡ Oldest';
    };

    const initialOrder = localStorage.getItem('feedSortOrder') || 'desc';
    updateButtonLabel(initialOrder);

    btn.addEventListener('click', () => {
        const currentOrder = localStorage.getItem('feedSortOrder') || 'desc';
        const nextOrder = currentOrder === 'desc' ? 'asc' : 'desc';
        localStorage.setItem('feedSortOrder', nextOrder);
        updateButtonLabel(nextOrder);

        if (typeof window.updateDashboardUI === 'function') {
            window.updateDashboardUI();
        }
    });
});
