window.renderCycleSpeedVarianceChart = async () => {
    const container = document.getElementById('cycle-speed-variance-chart');
    if (!container) return;

    try {
        const res = await fetch('/api/reports/cycle-duration-scatter');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        
        if (!data || !data.cycles || !data.cycles.length) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No cycle duration data available to calculate variance.</div>';
            return;
        }

        const cycles = data.cycles;
        
        // Group by contractor
        const contractorGroups = {};
        cycles.forEach(c => {
            const contractor = c.contractor || "Ad-hoc Contractor";
            if (!contractorGroups[contractor]) contractorGroups[contractor] = [];
            contractorGroups[contractor].push(c.duration);
        });

        const stats = [];
        Object.keys(contractorGroups).forEach(contractor => {
            const durations = contractorGroups[contractor];
            const count = durations.length;
            if (count < 2) return; // Need at least 2 trips to compute SD
            
            const mean = durations.reduce((a, b) => a + b, 0) / count;
            const variance = durations.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count;
            const stdDev = Math.sqrt(variance);
            const coeffVar = mean > 0 ? (stdDev / mean) : 0; // Coefficient of variation
            
            stats.push({
                contractor,
                count,
                mean,
                stdDev,
                coeffVar,
                min: Math.min(...durations),
                max: Math.max(...durations)
            });
        });

        if (stats.length === 0) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">Insufficient cycle data per subcontractor to calculate variance.</div>';
            return;
        }

        // Setup SVG properties
        const width = 600;
        const rowHeight = 50;
        const paddingLeft = 140;
        const paddingRight = 30;
        const paddingTop = 30;
        const paddingBottom = 40;
        
        const height = rowHeight * stats.length + paddingTop + paddingBottom;
        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;
        
        // Find scale max
        const maxVal = Math.max(...stats.map(s => s.mean + s.stdDev * 1.5), 60);
        const xMax = Math.ceil(maxVal / 10) * 10;
        
        const getX = (val) => paddingLeft + (val / xMax) * chartWidth;
        
        // Grid lines HTML
        let gridHtml = '';
        const xDivisions = 6;
        for (let i = 0; i <= xDivisions; i++) {
            const val = (i / xDivisions) * xMax;
            const x = getX(val);
            gridHtml += `
                <line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                <text x="${x}" y="${height - paddingBottom + 16}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${Math.round(val)}m</text>
            `;
        }
        
        let rowsHtml = '';
        stats.forEach((s, idx) => {
            const y = paddingTop + idx * rowHeight + rowHeight / 2;
            
            // Define colors based on speed volatility coefficient of variation
            let color = '#10b981'; // Green (Stable/Consistent)
            let status = 'Low Volatility';
            
            if (s.coeffVar > 0.35) {
                color = '#f43f5e'; // Red/Rose (High Volatility)
                status = 'High Volatility';
            } else if (s.coeffVar > 0.18) {
                color = '#f59e0b'; // Amber/Orange (Moderate Volatility)
                status = 'Moderate Volatility';
            }
            
            const meanX = getX(s.mean);
            const sdMinusX = getX(Math.max(0, s.mean - s.stdDev));
            const sdPlusX = getX(s.mean + s.stdDev);
            const minX = getX(s.min);
            const maxX = getX(s.max);
            
            rowsHtml += `
                <g style="cursor: pointer;" class="variance-row">
                    <!-- Contractor Label -->
                    <text x="10" y="${y + 4}" fill="var(--text-primary)" font-size="10.5" font-weight="600">${s.contractor}</text>
                    
                    <!-- Min-Max Range Track Line (T-bars) -->
                    <line x1="${minX}" y1="${y}" x2="${maxX}" y2="${y}" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" />
                    <line x1="${minX}" y1="${y - 4}" x2="${minX}" y2="${y + 4}" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" />
                    <line x1="${maxX}" y1="${y - 4}" x2="${maxX}" y2="${y + 4}" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" />
                    
                    <!-- Standard Deviation Range Bar -->
                    <rect x="${sdMinusX}" y="${y - 5}" width="${sdPlusX - sdMinusX}" height="10" rx="3" fill="${color}" opacity="0.65">
                        <title>Volatility Range (1 SD): ${Math.round(s.mean - s.stdDev)}m to ${Math.round(s.mean + s.stdDev)}m</title>
                    </rect>
                    
                    <!-- Mean Marker -->
                    <circle cx="${meanX}" cy="${y}" r="5" fill="#fff" stroke="${color}" stroke-width="2">
                        <title>Mean Trip Duration: ${s.mean.toFixed(1)} mins</title>
                    </circle>
                    
                    <!-- Stat details label text -->
                    <text x="${width - paddingRight}" y="${y - 8}" fill="${color}" font-size="8.5" font-weight="700" text-anchor="end">${status} (SD: ±${s.stdDev.toFixed(1)}m)</text>
                    <text x="${width - paddingRight}" y="${y + 9}" fill="var(--text-secondary)" font-size="8" text-anchor="end">${s.count} trips | Avg: ${s.mean.toFixed(1)}m</text>
                </g>
            `;
        });
        
        container.innerHTML = `
            <div style="width: 100%; padding: 0.5rem; background: var(--bg-card); border-radius: 8px;">
                <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; display: block; overflow: visible; font-family: 'Outfit', sans-serif;">
                    ${gridHtml}
                    <!-- Chart boundaries -->
                    <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
                    <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
                    
                    ${rowsHtml}
                </svg>
            </div>
            
            <div style="display: flex; gap: 1.25rem; margin-top: 1rem; font-size: 0.75rem; justify-content: flex-end; color: var(--text-secondary); align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 10px; height: 8px; border-radius: 2px; background: #10b981; opacity: 0.7;"></span> Low Volatility (&lt;18%)
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 10px; height: 8px; border-radius: 2px; background: #f59e0b; opacity: 0.7;"></span> Moderate Volatility (18-35%)
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 10px; height: 8px; border-radius: 2px; background: #f43f5e; opacity: 0.7;"></span> High Volatility (&gt;35%)
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem; margin-left: auto;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #fff; border: 1.5px solid var(--border);"></span> Mean
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 12px; height: 1.5px; background: rgba(255,255,255,0.35);"></span> Range [Min, Max]
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Failed to load cycle speed variance chart:', err);
        container.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 2rem;">Error: ${err.message}</div>`;
    }
};
