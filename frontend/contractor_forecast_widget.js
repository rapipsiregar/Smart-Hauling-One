window.renderContractorForecastWidget = async () => {
    const container = document.getElementById('subcontractor-forecast-widget');
    if (!container) return;

    try {
        const res = await fetch('/api/reports/contractor-forecast');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        if (!data || !data.predictions) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 1rem; grid-column: 1/-1;">No forecast predictions available.</div>';
            return;
        }

        const predictions = data.predictions;
        const contractors = Object.keys(predictions);

        if (contractors.length === 0) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 1rem; grid-column: 1/-1;">No contractors to forecast.</div>';
            return;
        }

        let cardsHtml = '';

        contractors.forEach(contractor => {
            const val = predictions[contractor];
            const completed = val.completed_ritase;
            const projected = val.projected_ritase;
            const target = val.shift_target;
            const fleet = val.active_fleet;
            const rate = val.current_rate;
            const status = val.status;
            
            let statusColor = 'var(--success)';
            let statusLabel = 'On Track';
            
            if (status === 'Behind') {
                statusColor = 'var(--danger)';
                statusLabel = 'Behind';
            } else if (status === 'At Risk') {
                statusColor = 'var(--warning)';
                statusLabel = 'At Risk';
            }

            cardsHtml += `
                <div class="kpi-card" style="flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 1rem; border: 1px solid var(--border); background: rgba(255,255,255,0.01);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: var(--primary); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;" title="${contractor}">${contractor}</span>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 6px ${statusColor};"></span>
                            <span style="font-size: 0.65rem; font-weight: 700; color: ${statusColor}; text-transform: uppercase;">${statusLabel}</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-top: 0.25rem;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.7rem; color: var(--text-secondary);">Projected / Target</span>
                            <span style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); font-family: 'JetBrains Mono', monospace;">
                                ${projected} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-secondary);">/ ${target}</span>
                            </span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="font-size: 0.7rem; color: var(--text-secondary);">Current Completed</span>
                            <span style="font-size: 1.15rem; font-weight: 700; color: var(--text-secondary); font-family: 'JetBrains Mono', monospace;">${completed} rit</span>
                        </div>
                    </div>

                    <div style="font-size: 0.72rem; color: var(--text-secondary); display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.4rem; margin-top: 0.25rem;">
                        <span>Fleet Size: <strong>${fleet} active</strong></span>
                        <span>Rate: <strong>${rate} rit/hr</strong></span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = cardsHtml;
    } catch (err) {
        console.error('Failed to load contractor forecast widget:', err);
        container.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 1rem; grid-column: 1/-1;">Error: ${err.message}</div>`;
    }
};
