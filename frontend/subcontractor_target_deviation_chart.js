window.onDeviationChartRendered = (complianceData) => {
    const container = document.getElementById('subcontractor-target-deviation-chart');
    if (!container) return;

    if (!complianceData || !Object.keys(complianceData).length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:0.85rem;padding:1rem;">No target deviation metrics available.</div>';
        return;
    }

    const svgWidth = 600;
    const svgHeight = 280;
    const paddingLeft = 50;
    const paddingRight = 15;
    const paddingTop = 45;
    const paddingBottom = 40;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    const parsedData = Object.entries(complianceData).map(([name, data]) => {
        const actual = data.hourly_capacity || 0.0;
        const target = data.target_threshold || 1.0;
        const deviation = actual - target;
        return { name, actual, target, deviation };
    });

    const maxVal = Math.max(2.0, ...parsedData.map(d => Math.max(d.actual, d.target))) * 1.15;

    let gridLinesHtml = '';
    const divisions = 4;
    for (let i = 0; i <= divisions; i++) {
        const yVal = paddingTop + chartHeight - (i / divisions) * chartHeight;
        const labelVal = ((i / divisions) * maxVal).toFixed(1);
        gridLinesHtml += `
            <line x1="${paddingLeft}" y1="${yVal}" x2="${svgWidth - paddingRight}" y2="${yVal}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
            <text x="${paddingLeft - 8}" y="${yVal + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end">${labelVal}</text>
        `;
    }

    const numContractors = parsedData.length;
    const slotWidth = chartWidth / (numContractors || 1);
    const barWidth = slotWidth * 0.32;
    const barSpacing = slotWidth * 0.05;

    let barsHtml = '';
    parsedData.forEach((d, idx) => {
        const xActual = paddingLeft + idx * slotWidth + (slotWidth - 2 * barWidth - barSpacing) / 2;
        const hActual = (d.actual / maxVal) * chartHeight;
        const yActual = paddingTop + chartHeight - hActual;

        const xTarget = xActual + barWidth + barSpacing;
        const hTarget = (d.target / maxVal) * chartHeight;
        const yTarget = paddingTop + chartHeight - hTarget;

        const devColor = d.deviation >= 0 ? '#10b981' : '#ef4444';
        const devSign = d.deviation >= 0 ? '+' : '';
        const devLabel = `${devSign}${d.deviation.toFixed(2)} rit/hr`;

        barsHtml += `
            <!-- Actual bar -->
            <rect x="${xActual}" y="${yActual}" width="${barWidth}" height="${hActual}" rx="3" fill="url(#actualBarGrad)" style="transition: all 0.3s ease;">
                <title>${d.name} Actual: ${d.actual.toFixed(2)} rit/hr</title>
            </rect>
            <text x="${xActual + barWidth / 2}" y="${yActual - 6}" fill="#38bdf8" font-size="9" font-weight="700" text-anchor="middle">${d.actual.toFixed(1)}</text>

            <!-- Target bar -->
            <rect x="${xTarget}" y="${yTarget}" width="${barWidth}" height="${hTarget}" rx="3" fill="url(#targetBarGrad)" style="transition: all 0.3s ease;">
                <title>${d.name} Target: ${d.target.toFixed(2)} rit/hr</title>
            </rect>
            <text x="${xTarget + barWidth / 2}" y="${yTarget - 6}" fill="#818cf8" font-size="9" font-weight="700" text-anchor="middle">${d.target.toFixed(1)}</text>

            <!-- X Axis Label -->
            <text x="${paddingLeft + idx * slotWidth + slotWidth / 2}" y="${svgHeight - 22}" fill="var(--text-secondary)" font-size="9" text-anchor="middle">${d.name.length > 15 ? d.name.substring(0, 12) + '...' : d.name}</text>
            
            <!-- Deviation Label -->
            <text x="${paddingLeft + idx * slotWidth + slotWidth / 2}" y="${svgHeight - 8}" fill="${devColor}" font-size="8.5" font-weight="600" text-anchor="middle">${devLabel}</text>
        `;
    });

    container.innerHTML = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; display: block; overflow: visible;">
            <defs>
                <linearGradient id="actualBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.85" />
                    <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.2" />
                </linearGradient>
                <linearGradient id="targetBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#818cf8" stop-opacity="0.85" />
                    <stop offset="100%" stop-color="#818cf8" stop-opacity="0.2" />
                </linearGradient>
            </defs>

            <!-- Grid & Axes -->
            ${gridLinesHtml}
            <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${svgHeight - paddingBottom}" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" />
            <line x1="${paddingLeft}" y1="${svgHeight - paddingBottom}" x2="${svgWidth - paddingRight}" y2="${svgHeight - paddingBottom}" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" />

            <!-- Bars and Labels -->
            ${barsHtml}

            <!-- Legend -->
            <g transform="translate(${paddingLeft}, 15)" font-size="9.5" fill="var(--text-secondary)">
                <circle cx="5" cy="5" r="4.5" fill="#38bdf8" />
                <text x="15" y="8" fill="var(--text-primary)">Actual Completed (ritase/hr)</text>
                <circle cx="180" cy="5" r="4.5" fill="#818cf8" />
                <text x="190" y="8" fill="var(--text-primary)">Expected Target (ritase/hr)</text>
            </g>
        </svg>
    `;
};
