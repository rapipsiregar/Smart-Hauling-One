let lastComplianceData = null;
let activeFilters = {};

window.onReportsRendered = (complianceData) => {
    lastComplianceData = complianceData;
    const container = document.getElementById('contractor-comparison-chart');
    if (!container) return;

    if (!complianceData || !Object.keys(complianceData).length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:0.85rem;padding:1rem;">No contractor compliance metrics available.</div>';
        return;
    }

    const allContractors = Object.keys(complianceData).sort();
    allContractors.forEach(name => {
        if (activeFilters[name] === undefined) {
            activeFilters[name] = true;
        }
    });

    renderChartWithFilters(container, complianceData);
};

function renderChartWithFilters(container, complianceData) {
    const allContractors = Object.keys(complianceData).sort();
    
    let filtersHtml = `
        <div class="chart-filters-bar" style="display: flex; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem; color: var(--text-secondary);">
            <strong style="color: var(--text-primary); margin-right: 0.25rem;">Show Contractors:</strong>
    `;
    
    allContractors.forEach(name => {
        const isChecked = activeFilters[name] ? 'checked' : '';
        filtersHtml += `
            <label style="display: flex; align-items: center; gap: 0.25rem; cursor: pointer; user-select: none; margin-right: 0.5rem;">
                <input type="checkbox" class="chart-contractor-cb" value="${name}" ${isChecked}>
                ${name}
            </label>
        `;
    });
    filtersHtml += `</div>`;

    const filteredContractors = Object.entries(complianceData).filter(([name]) => activeFilters[name]);

    if (!filteredContractors.length) {
        container.innerHTML = filtersHtml + '<div style="text-align:center;color:var(--text-secondary);font-size:0.85rem;padding:2rem;">All contractors filtered out. Check at least one filter above.</div>';
        bindFilterEvents(container, complianceData);
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

    const parsedData = filteredContractors.map(([name, data]) => {
        const completed = data.completed_cycles || 0;
        const compliancePct = data.compliance_pct || 0;
        const goal = compliancePct > 0 ? Math.round(completed / (compliancePct / 100)) : 0;
        return { name, completed, goal };
    });

    const maxVal = Math.max(10, ...parsedData.map(d => Math.max(d.completed, d.goal))) * 1.15;

    let gridLinesHtml = '';
    const divisions = 4;
    for (let i = 0; i <= divisions; i++) {
        const yVal = paddingTop + chartHeight - (i / divisions) * chartHeight;
        const labelVal = Math.round((i / divisions) * maxVal);
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
        const xCompleted = paddingLeft + idx * slotWidth + (slotWidth - 2 * barWidth - barSpacing) / 2;
        const hCompleted = (d.completed / maxVal) * chartHeight;
        const yCompleted = paddingTop + chartHeight - hCompleted;

        const xGoal = xCompleted + barWidth + barSpacing;
        const hGoal = (d.goal / maxVal) * chartHeight;
        const yGoal = paddingTop + chartHeight - hGoal;

        barsHtml += `
            <rect x="${xCompleted}" y="${yCompleted}" width="${barWidth}" height="${hCompleted}" rx="3" fill="url(#compBarGrad)" style="transition: all 0.3s ease; cursor: pointer;">
                <title>${d.name} Completed: ${d.completed} ritase</title>
            </rect>
            <text x="${xCompleted + barWidth / 2}" y="${yCompleted - 6}" fill="var(--primary)" font-size="9.5" font-weight="700" text-anchor="middle">${d.completed}</text>

            <rect x="${xGoal}" y="${yGoal}" width="${barWidth}" height="${hGoal}" rx="3" fill="none" stroke="#64748b" stroke-width="1.25" stroke-dasharray="2,2"/>
            <rect x="${xGoal}" y="${yGoal}" width="${barWidth}" height="${hGoal}" rx="3" fill="rgba(100, 116, 139, 0.15)"/>
            <text x="${xGoal + barWidth / 2}" y="${yGoal - 6}" fill="#94a3b8" font-size="9.5" font-weight="600" text-anchor="middle">${d.goal}</text>

            <text x="${paddingLeft + idx * slotWidth + slotWidth / 2}" y="${svgHeight - paddingBottom + 18}" fill="var(--text-primary)" font-size="10" font-weight="600" text-anchor="middle">${d.name}</text>
        `;
    });

    const svgHtml = `
        <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%; height:auto; overflow:visible; font-family:'Outfit', sans-serif;">
            <defs>
                <linearGradient id="compBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--primary)" />
                    <stop offset="100%" stop-color="var(--secondary)" stop-opacity="0.6" />
                </linearGradient>
            </defs>
            <g transform="translate(${svgWidth - 250}, 15)" font-size="10" font-weight="600">
                <rect x="0" y="0" width="10" height="10" rx="2" fill="var(--primary)" />
                <text x="15" y="9" fill="var(--text-secondary)">Completed Ritase</text>
                <rect x="120" y="0" width="10" height="10" rx="2" fill="rgba(100,116,139,0.2)" stroke="#64748b" stroke-dasharray="1.5,1.5" />
                <text x="135" y="9" fill="var(--text-secondary)">Shift Target Goal</text>
            </g>
            ${gridLinesHtml}
            <line x1="${paddingLeft}" y1="${paddingTop + chartHeight}" x2="${svgWidth - paddingRight}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" />
            ${barsHtml}
        </svg>
    `;

    container.innerHTML = filtersHtml + svgHtml;
    bindFilterEvents(container, complianceData);
}

function bindFilterEvents(container, complianceData) {
    container.querySelectorAll('.chart-contractor-cb').forEach(cb => {
        cb.onchange = (e) => {
            const name = e.target.value;
            activeFilters[name] = e.target.checked;
            renderChartWithFilters(container, complianceData);
        };
    });
}
