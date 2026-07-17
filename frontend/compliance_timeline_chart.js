const deselectedContractors = new Set();
let lastHourlyComplianceData = null;

window.renderComplianceTimelineChart = (hourlyCompliance) => {
    if (hourlyCompliance) {
        lastHourlyComplianceData = hourlyCompliance;
    } else {
        hourlyCompliance = lastHourlyComplianceData;
    }

    const container = document.getElementById('contractor-compliance-timeline');
    if (!container) return;

    if (!hourlyCompliance || !hourlyCompliance.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:0.8rem;padding:1rem;">No compliance history available.</div>';
        return;
    }

    const timelineData = hourlyCompliance.slice(-12);

    const contractors = [];
    timelineData.forEach(item => {
        Object.keys(item.rates || {}).forEach(c => {
            if (!contractors.includes(c)) contractors.push(c);
        });
    });
    contractors.sort();

    if (!contractors.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:0.8rem;padding:1rem;">No contractors found in timeline.</div>';
        return;
    }

    const rowHeight = 36;
    const paddingLeft = 110;
    const paddingRight = 15;
    const paddingTop = 45;
    const paddingBottom = 35;

    const svgWidth = 600;
    const svgHeight = rowHeight * contractors.length + paddingTop + paddingBottom;

    const chartWidth = svgWidth - paddingLeft - paddingRight;
    const chartHeight = svgHeight - paddingTop - paddingBottom;

    let elementsHtml = '';

    const numSlots = timelineData.length;
    const slotWidth = chartWidth / (numSlots || 1);

    timelineData.forEach((item, idx) => {
        const x = paddingLeft + idx * slotWidth + slotWidth / 2;
        elementsHtml += `
            <line x1="${x}" y1="${paddingTop - 10}" x2="${x}" y2="${paddingTop + chartHeight}" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
            <text x="${x}" y="${svgHeight - paddingBottom + 18}" fill="var(--text-secondary)" font-size="8.5" font-weight="600" text-anchor="middle">${item.hour}</text>
        `;
    });

    contractors.forEach((contractor, cIdx) => {
        const y = paddingTop + cIdx * rowHeight;
        const isDeselected = deselectedContractors.has(contractor);
        const opacity = isDeselected ? 0.25 : 1.0;

        // Detect consecutive low compliance segments (< 50% for 3+ consecutive hours)
        const isAnomalySlot = new Array(numSlots).fill(false);
        let hasAnomaly = false;
        let count = 0;
        let startIdx = -1;
        for (let i = 0; i < numSlots; i++) {
            const rate = timelineData[i].rates[contractor];
            if (rate !== undefined && rate !== null && rate < 50.0) {
                if (count === 0) startIdx = i;
                count++;
                if (count >= 3) {
                    hasAnomaly = true;
                    for (let j = startIdx; j <= i; j++) {
                        isAnomalySlot[j] = true;
                    }
                }
            } else {
                count = 0;
            }
        }

        const labelText = (hasAnomaly && !isDeselected) ? `⚠️ ${contractor}` : contractor;
        const labelColor = (hasAnomaly && !isDeselected) ? '#f43f5e' : (isDeselected ? 'var(--text-secondary)' : 'var(--text-primary)');

        elementsHtml += `
            <text x="10" y="${y + 12}" fill="${labelColor}" font-size="10" font-weight="700" style="opacity:${opacity}; text-decoration:${isDeselected ? 'line-through' : 'none'};">${labelText}</text>
        `;

        if (isDeselected) {
            elementsHtml += `
                <rect x="${paddingLeft}" y="${y}" width="${chartWidth - 4}" height="18" rx="3" fill="rgba(255,255,255,0.02)" style="opacity:0.2;" />
            `;
            return;
        }

        timelineData.forEach((item, idx) => {
            const x = paddingLeft + idx * slotWidth + 2;
            const rate = item.rates[contractor] !== undefined ? item.rates[contractor] : null;

            let fillColor = 'rgba(255, 255, 255, 0.05)';
            let statusText = 'No Data';

            if (rate !== null) {
                if (rate >= 100.0) {
                    fillColor = '#10b981';
                    statusText = `Exceeded Target (${rate.toFixed(1)}%)`;
                } else if (rate >= 80.0) {
                    fillColor = '#38bdf8';
                    statusText = `Met Target (${rate.toFixed(1)}%)`;
                } else {
                    fillColor = '#ef4444';
                    statusText = `Below Target (${rate.toFixed(1)}%)`;
                }
            }

            const isAnom = isAnomalySlot[idx];
            let borderStyle = '';
            if (isAnom) {
                borderStyle = 'stroke="#f43f5e" stroke-width="2" stroke-dasharray="2,1"';
                statusText += ' [CONSECUTIVE LOW COMPLIANCE ANOMALY]';
            }

            elementsHtml += `
                <rect x="${x}" y="${y}" width="${slotWidth - 4}" height="18" rx="3" fill="${fillColor}" ${borderStyle} style="cursor: pointer; transition: filter 0.2s;" onmouseover="this.style.filter='brightness(1.15)'" onmouseout="this.style.filter='none'">
                    <title>${contractor} @ ${item.hour}: ${statusText}</title>
                </rect>
            `;
        });
    });

    let legendHtml = '<div style="display:flex; flex-wrap:wrap; gap:0.75rem; font-size:0.8rem; margin-top:0.6rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.5rem; justify-content:center;">';
    contractors.forEach(contractor => {
        const isDeselected = deselectedContractors.has(contractor);
        const legendOpacity = isDeselected ? 0.3 : 1.0;
        const textDecoration = isDeselected ? 'line-through' : 'none';
        legendHtml += `
            <div class="timeline-legend-item" data-contractor="${contractor}" style="display:flex; align-items:center; gap:0.25rem; cursor:pointer; opacity:${legendOpacity}; text-decoration:${textDecoration}; transition:opacity 0.2s;">
                <span style="width:10px; height:8px; background:rgba(255,255,255,0.15); display:inline-block; border-radius:2px;"></span>
                <strong style="color:var(--text-primary);">${contractor}</strong>
            </div>
        `;
    });
    legendHtml += '</div>';

    let svgHtml = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%; height:auto; overflow:visible; font-family:'Outfit', sans-serif;">`;
    svgHtml += `
        <g transform="translate(${svgWidth - 425}, 20)" font-size="8.5" font-weight="600">
            <rect x="0" y="0" width="8" height="8" rx="1.5" fill="#10b981" />
            <text x="12" y="8" fill="var(--text-secondary)">Exceeded (>=100%)</text>
            <rect x="105" y="0" width="8" height="8" rx="1.5" fill="#38bdf8" />
            <text x="117" y="8" fill="var(--text-secondary)">Met (80-99%)</text>
            <rect x="185" y="0" width="8" height="8" rx="1.5" fill="#ef4444" />
            <text x="197" y="8" fill="var(--text-secondary)">Below (<80%)</text>
            <rect x="265" y="0" width="8" height="8" rx="1.5" fill="#ef4444" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="2,1" />
            <text x="277" y="8" fill="var(--text-secondary)">⚠️ Anomaly (<50% 3h)</text>
        </g>
        <text x="10" y="27" fill="var(--text-primary)" font-size="11" font-weight="700">Subcontractor Compliance Gantt (Last 12 Hours)</text>
    `;

    svgHtml += elementsHtml;
    svgHtml += '</svg>';

    container.innerHTML = svgHtml + legendHtml;

    container.querySelectorAll('.timeline-legend-item').forEach(item => {
        item.addEventListener('click', () => {
            const contractor = item.getAttribute('data-contractor');
            if (deselectedContractors.has(contractor)) {
                deselectedContractors.delete(contractor);
            } else {
                deselectedContractors.add(contractor);
            }
            window.renderComplianceTimelineChart();
        });
    });
};
