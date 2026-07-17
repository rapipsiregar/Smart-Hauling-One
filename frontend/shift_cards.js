window.renderShiftCards = (shift_distribution) => {
    const container = document.getElementById('shift-distribution-container');
    if (!container || !shift_distribution) return;

    const sortedShifts = Object.entries(shift_distribution).sort((a, b) => {
        const getHour = (str) => parseInt(str.split(':')[0]) || 0;
        return getHour(a[0]) - getHour(b[0]);
    });

    const values = sortedShifts.map(([_, v]) => v);
    const maxVal = Math.max(...values, 5);

    const svgWidth = 600;
    const svgHeight = 220;
    const paddingLeft = 45;
    const paddingRight = 15;
    const paddingTop = 25;
    const paddingBottom = 40;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;
    
    let gridLinesHtml = '';
    const gridDivisions = 4;
    for (let i = 0; i <= gridDivisions; i++) {
        const yVal = paddingTop + chartHeight - (i / gridDivisions) * chartHeight;
        const labelVal = Math.round((i / gridDivisions) * maxVal);
        gridLinesHtml += `
            <line x1="${paddingLeft}" y1="${yVal}" x2="${svgWidth - paddingRight}" y2="${yVal}" stroke="rgba(255,255,255,0.05)" stroke-width="1" />
            <text x="${paddingLeft - 8}" y="${yVal + 3}" fill="var(--text-secondary)" font-size="9" text-anchor="end">${labelVal}</text>
        `;
    }

    const numShifts = sortedShifts.length;
    const slotWidth = chartWidth / (numShifts || 1);
    const barWidth = slotWidth * 0.65;
    
    let barsHtml = '';
    sortedShifts.forEach(([slot, count], idx) => {
        const xVal = paddingLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
        const barHeight = (count / maxVal) * chartHeight;
        const yVal = paddingTop + chartHeight - barHeight;

        barsHtml += `
            <rect x="${xVal}" y="${yVal}" width="${barWidth}" height="${barHeight}" rx="4" fill="url(#shiftBarGrad)" style="transition: all 0.3s ease; cursor: pointer;">
                <title>${slot}: ${count} Passages</title>
            </rect>
            <text x="${xVal + barWidth / 2}" y="${yVal - 6}" fill="var(--primary)" font-size="10" font-weight="700" text-anchor="middle">${count}</text>
            <text x="${xVal + barWidth / 2}" y="${svgHeight - paddingBottom + 18}" fill="var(--text-secondary)" font-size="9" font-weight="600" text-anchor="middle">${slot}</text>
        `;
    });

    container.innerHTML = `
        <div class="histogram-wrapper" style="width: 100%; padding: 0.5rem; background: var(--bg-card); border-radius: 8px;">
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; display: block; overflow: visible; font-family: 'Outfit', sans-serif;">
                <defs>
                    <linearGradient id="shiftBarGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color="var(--primary)" />
                        <stop offset="100%" stop-color="var(--secondary)" stop-opacity="0.6" />
                    </linearGradient>
                </defs>
                ${gridLinesHtml}
                <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${svgWidth - paddingRight}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
                ${barsHtml}
            </svg>
        </div>
    `;
};
