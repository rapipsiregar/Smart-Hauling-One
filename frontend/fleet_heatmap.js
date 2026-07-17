window.renderFleetHeatmap = async () => {
    const container = document.getElementById('fleet-utility-heatmap');
    if (!container) return;

    try {
        const res = await fetch('/api/reports/fleet-utility-heatmap');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        
        if (!data || !data.grid || !data.grid.length) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No fleet utility data available.</div>';
            return;
        }
        
        const getHeatColor = (count) => {
            if (count === 0) return 'rgba(30, 41, 59, 0.4)';
            if (count === 1) return 'rgba(14, 165, 233, 0.15)';
            if (count === 2) return 'rgba(14, 165, 233, 0.35)';
            return 'rgba(14, 165, 233, 0.65)';
        };

        const getBorderColor = (count) => {
            if (count === 0) return 'rgba(255, 255, 255, 0.05)';
            if (count === 1) return 'rgba(14, 165, 233, 0.3)';
            if (count === 2) return 'rgba(14, 165, 233, 0.6)';
            return 'rgba(14, 165, 233, 0.9)';
        };

        let html = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 6px; font-family: 'Outfit', sans-serif; font-size: 0.85rem; color: var(--text-primary);">
                    <thead>
                        <tr>
                            <th style="padding: 0.5rem; text-align: left; color: var(--text-secondary); font-weight: 600;">OHT Unit</th>
        `;

        data.hours.forEach(hour => {
            html += `<th style="padding: 0.5rem; text-align: center; color: var(--text-secondary); font-weight: 600; min-width: 60px;">${hour}</th>`;
        });

        html += `
                        </tr>
                    </thead>
                    <tbody>
        `;

        data.grid.forEach(row => {
            html += `
                <tr>
                    <td style="padding: 0.5rem; font-weight: 600; color: var(--primary); white-space: nowrap;">${row.truck}</td>
            `;

            data.hours.forEach(hour => {
                const count = row.hours[hour] || 0;
                const heatColor = getHeatColor(count);
                const borderColor = getBorderColor(count);
                html += `
                    <td style="background: ${heatColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 0.5rem; text-align: center; transition: all 0.2s;" title="${row.truck} at ${hour}: ${count} passages">
                        <div style="font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; color: ${count > 0 ? 'var(--text-primary)' : 'var(--text-secondary)'};">${count}</div>
                    </td>
                `;
            });

            html += `</tr>`;
        });

        html += `
                    </tbody>
                </table>
            </div>
            
            <div style="display: flex; gap: 1.5rem; margin-top: 1rem; font-size: 0.75rem; justify-content: flex-end; color: var(--text-secondary); align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05);"></span> Idle (0)
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: rgba(14, 165, 233, 0.15); border: 1px solid rgba(14, 165, 233, 0.3);"></span> Low (1)
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: rgba(14, 165, 233, 0.35); border: 1px solid rgba(14, 165, 233, 0.6);"></span> Medium (2)
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: rgba(14, 165, 233, 0.65); border: 1px solid rgba(14, 165, 233, 0.9);"></span> High (3+)
                </div>
            </div>
        `;

        container.innerHTML = html;
    } catch (err) {
        console.error('Failed to load fleet utility heatmap:', err);
        container.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 2rem;">Error: ${err.message}</div>`;
    }
};
