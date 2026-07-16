document.addEventListener('DOMContentLoaded', () => {
    const tooltip = document.getElementById('map-tooltip');
    if (!tooltip) return;

    document.querySelectorAll('.map-zone').forEach(zone => {
        zone.onmouseenter = (e) => {
            const z = zone.dataset.zone;
            const currentCrossings = typeof window.getCurrentCrossings === 'function' ? window.getCurrentCrossings() : [];
            const limit = 15 * 60 * 1000, now = new Date();
            const recent = currentCrossings.filter(c => (now - new Date(c.timestamp)) <= limit);
            let cnt = 0, dir = '';
            
            if (z === 'loading') {
                cnt = recent.filter(c => c.lane === 'North Checkpoint' || c.direction === 'inbound').length;
                dir = 'Inbound (Loading Site)';
            } else if (z === 'dumping') {
                cnt = recent.filter(c => c.lane === 'South Gate' || c.direction === 'outbound').length;
                dir = 'Outbound (Dumping Site)';
            } else {
                cnt = recent.filter(c => c.lane === 'Main Portal').length;
                dir = 'Bi-directional (Haul Road)';
            }
            
            tooltip.innerHTML = `
                <div style="font-weight:700;margin-bottom:0.25rem;color:var(--text-primary);">📍 ${zone.textContent.trim()}</div>
                <div style="color:var(--text-secondary);"><strong>Passages (15m):</strong> ${cnt}</div>
                <div style="color:var(--text-secondary);"><strong>Direction:</strong> ${dir}</div>
                ${cnt > 2 ? '<div style="color:var(--danger);font-weight:600;margin-top:0.25rem;">⚠️ Heavy Traffic</div>' : ''}
            `;
            tooltip.classList.remove('hidden');
        };
        
        zone.onmousemove = (e) => {
            const wrapper = zone.closest('.map-view-wrapper');
            if (wrapper) {
                const rect = wrapper.getBoundingClientRect();
                tooltip.style.left = `${e.clientX - rect.left + 15}px`;
                tooltip.style.top = `${e.clientY - rect.top + 15}px`;
            }
        };
        
        zone.onmouseleave = () => tooltip.classList.add('hidden');
    });
});
