window.renderDispatchDiscrepancyGrid = async () => {
    const container = document.getElementById('subcontractor-dispatch-discrepancy-grid');
    if (!container) return;

    try {
        const res = await fetch('/api/reports/dispatch-discrepancy-grid');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        if (!data || !data.grid || !data.grid.length) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No dispatch discrepancy data available.</div>';
            return;
        }

        const getHeatColor = (ratio) => {
            if (ratio === 0) return 'rgba(30, 41, 59, 0.4)';
            if (ratio < 0.5) return 'rgba(239, 68, 68, 0.25)'; // High Discrepancy / Poor Utilization
            if (ratio < 0.9) return 'rgba(245, 158, 11, 0.25)'; // Moderate Discrepancy
            return 'rgba(16, 185, 129, 0.25)'; // Excellent Utilization
        };

        const getBorderColor = (ratio) => {
            if (ratio === 0) return 'rgba(255, 255, 255, 0.05)';
            if (ratio < 0.5) return 'rgba(239, 68, 68, 0.6)';
            if (ratio < 0.9) return 'rgba(245, 158, 11, 0.6)';
            return 'rgba(16, 185, 129, 0.6)';
        };

        let html = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 6px; font-family: 'Outfit', sans-serif; font-size: 0.85rem; color: var(--text-primary);">
                    <thead>
                        <tr>
                            <th style="padding: 0.5rem; text-align: left; color: var(--text-secondary); font-weight: 600;">Subcontractor</th>
        `;

        data.blocks.forEach(block => {
            html += `<th style="padding: 0.5rem; text-align: center; color: var(--text-secondary); font-weight: 600; min-width: 100px;">${block}</th>`;
        });

        html += `
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.grid.forEach(row => {
            html += `
                <tr>
                    <td style="padding: 0.5rem; font-weight: 600; color: var(--primary); white-space: nowrap;">${row.contractor}</td>
            `;

            data.blocks.forEach(block => {
                const val = row.blocks[block] || { active_fleet: 0, completed_ritase: 0, utilization: 0.0 };
                const heatColor = getHeatColor(val.utilization);
                const borderColor = getBorderColor(val.utilization);
                const percentage = Math.round(val.utilization * 100);

                html += `
                    <td style="background: ${heatColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 0.75rem 0.5rem; text-align: center; transition: all 0.2s;" title="${row.contractor} - ${block}: Fleet: ${val.active_fleet} trucks, Ritase: ${val.completed_ritase} cycles, Utilization: ${percentage}%">
                        <div style="font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 0.95rem;">${val.completed_ritase} rit</div>
                        <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px;">🚚 ${val.active_fleet} active</div>
                    </td>
                `;
            });

            html += `
                </tr>
            `;
        });

        html += `
                    </tbody>
                </table>
            </div>
        `;

        container.innerHTML = html;
    } catch (err) {
        console.error('Failed to render dispatch discrepancy grid:', err);
        container.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 2rem;">Error: ${err.message}</div>`;
    }
};
