window.onReportsRendered = (complianceData) => {
    const container = document.getElementById('contractor-comparison-chart');
    if (!container) return;

    const contractors = Object.entries(complianceData || {});
    if (!contractors.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:0.85rem;padding:1rem;">No contractor compliance metrics available.</div>';
        return;
    }

    const rowHeight = 45;
    const padding = 15;
    const svgHeight = rowHeight * contractors.length + padding * 2;
    const svgWidth = 600;

    let svgHtml = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%; height:auto; font-family:'Outfit', sans-serif;">`;
    
    // Middle vertical dotted divider
    svgHtml += `
        <text x="150" y="20" fill="var(--primary)" font-size="11" font-weight="700" text-anchor="middle">Compliance Rate (%)</text>
        <text x="450" y="20" fill="var(--secondary)" font-size="11" font-weight="700" text-anchor="middle">Hourly Capacity (rit/hr)</text>
        <line x1="300" y1="10" x2="300" y2="${svgHeight - 10}" stroke="var(--border)" stroke-dasharray="3"/>
    `;

    contractors.forEach(([name, data], idx) => {
        const y = 35 + idx * rowHeight;
        
        // Left Side: Compliance Bar
        const compPct = data.compliance_pct || 0;
        const compWidth = (compPct / 100) * 260;
        const compColor = compPct < 50 ? '#ef4444' : (compPct < 85 ? '#f59e0b' : '#10b981');
        
        // Right Side: Capacity Bar
        const cap = data.hourly_capacity || 0;
        const target = data.target_threshold || 1.0;
        const maxCap = Math.max(3.0, target * 1.5);
        const capWidth = Math.min(260, (cap / maxCap) * 260);
        const capColor = '#6366f1';

        svgHtml += `
            <!-- Left Side: Compliance -->
            <text x="10" y="${y + 12}" fill="var(--text-primary)" font-size="9" font-weight="600">${name}</text>
            <rect x="10" y="${y + 18}" width="260" height="12" rx="4" fill="#1e293b"/>
            <rect x="10" y="${y + 18}" width="${compWidth}" height="12" rx="4" fill="${compColor}"/>
            <text x="${Math.max(20, compWidth - 5)}" y="${y + 27}" fill="#fff" font-size="8" font-weight="700" text-anchor="end">${compPct.toFixed(1)}%</text>

            <!-- Right Side: Capacity -->
            <text x="320" y="${y + 12}" fill="var(--text-primary)" font-size="9" font-weight="600">${name} (Target: ${target})</text>
            <rect x="320" y="${y + 18}" width="260" height="12" rx="4" fill="#1e293b"/>
            <rect x="320" y="${y + 18}" width="${capWidth}" height="12" rx="4" fill="${capColor}"/>
            <text x="${Math.max(330, 320 + capWidth - 5)}" y="${y + 27}" fill="#fff" font-size="8" font-weight="700" text-anchor="end">${cap.toFixed(2)} rit/hr</text>
        `;
    });

    svgHtml += '</svg>';
    container.innerHTML = svgHtml;
};
