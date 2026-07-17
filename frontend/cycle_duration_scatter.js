window.renderCycleDurationScatter = async () => {
    const container = document.getElementById('cycle-duration-scatter-plot');
    if (!container) return;

    try {
        const res = await fetch('/api/reports/cycle-duration-scatter');
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        
        if (!data || !data.cycles || !data.cycles.length) {
            container.innerHTML = '<div style="color: var(--text-secondary); text-align: center; padding: 2rem;">No cycle duration data available in the last 24 hours.</div>';
            return;
        }

        const cycles = data.cycles;
        const mean = data.mean;
        const stdDev = data.std_dev;
        const thresholdHigh = data.threshold_high;
        const thresholdLow = data.threshold_low;

        const maxDuration = Math.max(...cycles.map(c => c.duration), 60);
        const yMax = maxDuration * 1.15;

        const width = 600;
        const height = 280;
        const paddingLeft = 45;
        const paddingRight = 20;
        const paddingTop = 25;
        const paddingBottom = 40;

        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        const getX = (timeDec) => paddingLeft + (timeDec / 24.0) * chartWidth;
        const getY = (duration) => paddingTop + chartHeight - (duration / yMax) * chartHeight;

        let gridLinesHtml = '';
        const yDivisions = 5;
        for (let i = 0; i <= yDivisions; i++) {
            const val = (i / yDivisions) * yMax;
            const y = getY(val);
            gridLinesHtml += `
                <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                <text x="${paddingLeft - 8}" y="${y + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end">${Math.round(val)}m</text>
            `;
        }

        const xDivisions = 6;
        for (let i = 0; i <= xDivisions; i++) {
            const hour = (i / xDivisions) * 24;
            const x = getX(hour);
            const label = `${String(Math.floor(hour)).padStart(2, '0')}:00`;
            gridLinesHtml += `
                <line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
                <text x="${x}" y="${height - paddingBottom + 16}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${label}</text>
            `;
        }

        let refLinesHtml = '';
        if (cycles.length > 1) {
            const yMean = getY(mean);
            const yHigh = getY(thresholdHigh);

            refLinesHtml += `
                <line x1="${paddingLeft}" y1="${yMean}" x2="${width - paddingRight}" y2="${yMean}" stroke="var(--primary)" stroke-width="1" stroke-dasharray="3, 3" opacity="0.8" />
                <text x="${width - paddingRight - 5}" y="${yMean - 4}" fill="var(--primary)" font-size="9" text-anchor="end" font-weight="600">Mean: ${mean}m</text>
            `;

            if (thresholdHigh < yMax) {
                refLinesHtml += `
                    <line x1="${paddingLeft}" y1="${yHigh}" x2="${width - paddingRight}" y2="${yHigh}" stroke="var(--danger)" stroke-width="1.2" stroke-dasharray="4, 4" opacity="0.8" />
                    <text x="${paddingLeft + 10}" y="${yHigh - 4}" fill="var(--danger)" font-size="9" text-anchor="start" font-weight="600">+2.0 SD limit (${thresholdHigh}m)</text>
                `;
            }
        }

        let pointsHtml = '';
        cycles.forEach(c => {
            const cx = getX(c.time_of_day);
            const cy = getY(c.duration);
            
            if (c.is_outlier) {
                pointsHtml += `
                    <g style="cursor: pointer;">
                        <circle cx="${cx}" cy="${cy}" r="9" fill="var(--danger)" opacity="0.3">
                            <animate attributeName="r" values="7;11;7" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="${cx}" cy="${cy}" r="5.5" fill="var(--danger)" stroke="#fff" stroke-width="1.5">
                            <title>🚨 OUTLIER - ${c.hull_id}\nTime: ${c.time_str}\nDuration: ${c.duration} mins\nContractor: ${c.contractor}</title>
                        </circle>
                    </g>
                `;
            } else {
                pointsHtml += `
                    <circle cx="${cx}" cy="${cy}" r="4" fill="var(--secondary)" stroke="var(--bg-card)" stroke-width="1" opacity="0.85" style="transition: all 0.2s; cursor: pointer;">
                        <title>${c.hull_id}\nTime: ${c.time_str}\nDuration: ${c.duration} mins\nContractor: ${c.contractor}</title>
                    </circle>
                `;
            }
        });

        container.innerHTML = `
            <div class="scatter-wrapper" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border-radius: 8px;">
                <svg viewBox="0 0 ${width} ${height}" style="width: 100%; height: auto; display: block; overflow: visible; font-family: 'Outfit', sans-serif;">
                    ${gridLinesHtml}
                    <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${width - paddingRight}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
                    <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
                    
                    ${refLinesHtml}
                    ${pointsHtml}
                </svg>
            </div>
            
            <div style="display: flex; gap: 1.5rem; margin-top: 1rem; font-size: 0.75rem; justify-content: flex-end; color: var(--text-secondary); align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem;">
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--secondary);"></span> Normal Cycle
                </div>
                <div style="display: flex; align-items: center; gap: 0.25rem;">
                    <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--danger); border: 1.5px solid #fff;"></span> Outlier (&gt;2.0 SD)
                </div>
                <div style="font-size: 0.7rem; color: var(--text-secondary); margin-left: auto;">
                    Mean: <strong>${mean}m</strong> | SD: <strong>${stdDev}m</strong>
                </div>
            </div>
        `;

    } catch (err) {
        console.error('Failed to load daily cycle scatter plot:', err);
        container.innerHTML = `<div style="color: var(--danger); text-align: center; padding: 2rem;">Error: ${err.message}</div>`;
    }
};
