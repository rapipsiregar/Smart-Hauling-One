window.renderContractorEfficiencyGrid = async () => {
    const container = document.getElementById('contractor-efficiency-heat-grid');
    if (!container) return;

    try {
        const res = await fetch('/api/reports/contractor-efficiency-grid');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        
        if (!data || !data.grid || !data.grid.length) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No efficiency data available.</div>';
            return;
        }
        
        const getHeatColor = (efficiency) => {
            if (efficiency === 0) return 'rgba(30, 41, 59, 0.4)';
            if (efficiency <= 0.5) return 'rgba(239, 68, 68, 0.25)';
            if (efficiency <= 1.5) return 'rgba(245, 158, 11, 0.25)';
            return 'rgba(16, 185, 129, 0.25)';
        };

        const getBorderColor = (efficiency) => {
            if (efficiency === 0) return 'rgba(255, 255, 255, 0.05)';
            if (efficiency <= 0.5) return 'rgba(239, 68, 68, 0.6)';
            if (efficiency <= 1.5) return 'rgba(245, 158, 11, 0.6)';
            return 'rgba(16, 185, 129, 0.6)';
        };

        let html = `
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: separate; border-spacing: 6px; font-family: 'Outfit', sans-serif; font-size: 0.85rem; color: var(--text-primary);">
                    <thead>
                        <tr>
                            <th style="padding: 0.5rem; text-align: left; color: var(--text-secondary); font-weight: 600;">Contractor</th>
        `;

        data.blocks.forEach(block => {
            html += `<th style="padding: 0.5rem; text-align: center; color: var(--text-secondary); font-weight: 600; min-width: 90px;">${block}</th>`;
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
                const val = row.blocks[block] || { cycles: 0, efficiency: 0.0 };
                const heatColor = getHeatColor(val.efficiency);
                const borderColor = getBorderColor(val.efficiency);
                html += `
                    <td style="background: ${heatColor}; border: 1px solid ${borderColor}; border-radius: 6px; padding: 0.75rem 0.5rem; text-align: center; transition: all 0.2s;" title="${row.contractor} - ${block}: ${val.cycles} cycles, ${val.efficiency} rit/hr">
                        <div style="font-weight: 700; font-family: 'JetBrains Mono', monospace; font-size: 0.95rem;">${val.efficiency}</div>
                        <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 2px;">${val.cycles} ritase</div>
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
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.05);"></span> No cycles
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: rgba(239, 68, 68, 0.25); border: 1px solid rgba(239, 68, 68, 0.6);"></span> Low (&le;0.5 rit/hr)
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: rgba(245, 158, 11, 0.25); border: 1px solid rgba(245, 158, 11, 0.6);"></span> Moderate (&le;1.5 rit/hr)
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 12px; height: 12px; border-radius: 3px; background: rgba(16, 185, 129, 0.25); border: 1px solid rgba(16, 185, 129, 0.6);"></span> High (&gt;1.5 rit/hr)
                </div>
            </div>
        `;

        container.innerHTML = html;
    } catch (err) {
        console.error('Failed to load contractor efficiency grid:', err);
        container.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 2rem;">Error: ${err.message}</div>`;
    }
};
