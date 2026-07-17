window.renderSubcontractorComplianceWidget = async () => {
    const container = document.getElementById('subcontractor-compliance-summary-widget');
    const overallLight = document.getElementById('compliance-overall-light');
    if (!container) return;

    try {
        const res = await fetch('/api/reports/shift-summary');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        if (!data || !data.compliance) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 1rem; grid-column: 1/-1;">No compliance data.</div>';
            return;
        }

        const compliance = data.compliance;
        const contractors = Object.keys(compliance);

        if (contractors.length === 0) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 1rem; grid-column: 1/-1;">No registered subcontractors.</div>';
            return;
        }

        let overallStatus = 'success';
        let cardsHtml = '';

        contractors.forEach(contractor => {
            const val = compliance[contractor];
            const target = val.target_threshold;
            const capacity = val.hourly_capacity;
            const pct = val.compliance_pct;
            const completed = val.completed_cycles;
            
            let statusColor = 'var(--success)';
            let statusLabel = 'Optimal';
            
            if (pct < 50) {
                statusColor = 'var(--danger)';
                statusLabel = 'Critical';
                overallStatus = 'danger';
            } else if (pct < 80) {
                statusColor = 'var(--warning)';
                statusLabel = 'Warning';
                if (overallStatus !== 'danger') {
                    overallStatus = 'warning';
                }
            }

            cardsHtml += `
                <div class="kpi-card" style="flex-direction: column; align-items: stretch; gap: 0.5rem; padding: 1rem; border: 1px solid var(--border); background: rgba(255,255,255,0.01);">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; color: var(--primary); font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px;" title="${contractor}">${contractor}</span>
                        <div style="display: flex; align-items: center; gap: 4px;">
                            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${statusColor}; box-shadow: 0 0 6px ${statusColor};"></span>
                            <span style="font-size: 0.65rem; font-weight: 700; color: ${statusColor}; text-transform: uppercase;">${statusLabel}</span>
                        </div>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin-top: 0.25rem;">
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-size: 0.7rem; color: var(--text-secondary);">Completed Ritase</span>
                            <span style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary); font-family: 'JetBrains Mono', monospace;">${completed}</span>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end;">
                            <span style="font-size: 0.7rem; color: var(--text-secondary);">Compliance</span>
                            <span style="font-size: 1.15rem; font-weight: 700; color: ${statusColor}; font-family: 'JetBrains Mono', monospace;">${pct}%</span>
                        </div>
                    </div>

                    <div style="font-size: 0.72rem; color: var(--text-secondary); display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.4rem; margin-top: 0.25rem;">
                        <span>Actual: <strong>${capacity}</strong> rit/hr</span>
                        <span>Target: <strong>${target}</strong> rit/hr</span>
                    </div>
                </div>
            `;
        });

        container.innerHTML = cardsHtml;

        if (overallLight) {
            let overallColor = 'var(--success)';
            if (overallStatus === 'danger') overallColor = 'var(--danger)';
            else if (overallStatus === 'warning') overallColor = 'var(--warning)';
            
            overallLight.style.background = overallColor;
            overallLight.style.boxShadow = `0 0 8px ${overallColor}`;
        }
    } catch (err) {
        console.error('Failed to load subcontractor compliance widget:', err);
        container.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 1rem; grid-column: 1/-1;">Error: ${err.message}</div>`;
    }
};
