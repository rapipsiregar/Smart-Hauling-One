document.addEventListener('DOMContentLoaded', () => {
    window.activeDiscrepancyFilter = 'all';

    const container = document.getElementById('discrepancy-class-filters');
    if (!container) return;

    const pills = container.querySelectorAll('.btn-disc-filter-pill');
    pills.forEach(pill => {
        pill.onclick = () => {
            pills.forEach(p => {
                p.classList.remove('active');
                p.style.background = 'none';
                p.style.color = 'var(--text-secondary)';
            });

            pill.classList.add('active');
            
            // Set styles based on filter type
            const filter = pill.getAttribute('data-filter');
            window.activeDiscrepancyFilter = filter;

            if (filter === 'all') {
                pill.style.background = 'rgba(255,255,255,0.05)';
                pill.style.color = 'var(--text-secondary)';
            } else if (filter === 'speed') {
                pill.style.background = 'rgba(251,191,36,0.1)';
                pill.style.color = 'var(--warning)';
            } else if (filter === 'compliance') {
                pill.style.background = 'rgba(239,68,68,0.1)';
                pill.style.color = 'var(--danger)';
            } else if (filter === 'route') {
                pill.style.background = 'rgba(192,132,252,0.1)';
                pill.style.color = '#c084fc';
            }

            if (typeof window.renderReports === 'function') {
                window.renderReports();
            }
        };
    });
});
