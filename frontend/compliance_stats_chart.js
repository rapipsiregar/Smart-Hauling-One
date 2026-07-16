window.renderComplianceStatsChart = (complianceData) => {
    const container = document.getElementById('compliance-stats-chart');
    if (!container) return;
    
    const contractors = Object.entries(complianceData || {});
    if (!contractors.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:0.8rem;padding:0.5rem;">No stats available.</div>';
        return;
    }
    
    const rowHeight = 45;
    const padding = 5;
    const svgHeight = rowHeight * contractors.length + padding * 2;
    const svgWidth = 400;
    
    let svgHtml = `<svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width:100%; height:auto; font-family:'Outfit', sans-serif; overflow:visible;">`;
    
    contractors.forEach(([name, data], idx) => {
        const y = padding + idx * rowHeight;
        
        const completed = data.completed_cycles || 0;
        const compliancePct = data.compliance_pct || 0;
        const goal = compliancePct > 0 ? Math.round(completed / (compliancePct / 100)) : 0;
        
        const maxVal = Math.max(10, completed * 1.3, goal * 1.3);
        
        const completedWidth = (completed / maxVal) * 220;
        const goalWidth = (goal / maxVal) * 220;
        
        svgHtml += `
            <text x="0" y="${y + 18}" fill="var(--text-primary)" font-size="9.5" font-weight="600">${name}</text>
            
            <!-- Completed bar -->
            <rect x="130" y="${y}" width="${completedWidth}" height="8" rx="2.5" fill="#38bdf8"/>
            <text x="${130 + completedWidth + 6}" y="${y + 8}" fill="#38bdf8" font-size="8.5" font-weight="600">${completed} rit</text>
            
            <!-- Goal bar -->
            <rect x="130" y="${y + 12}" width="${goalWidth}" height="8" rx="2.5" fill="none" stroke="#64748b" stroke-width="1.25" stroke-dasharray="2,2"/>
            <rect x="130" y="${y + 12}" width="${goalWidth}" height="8" rx="2.5" fill="rgba(100, 116, 139, 0.15)"/>
            <text x="${130 + goalWidth + 6}" y="${y + 20}" fill="#94a3b8" font-size="8.5" font-weight="600">${goal} goal</text>
        `;
    });
    
    svgHtml += '</svg>';
    
    container.innerHTML = `
        <div style="font-size:0.75rem; font-weight:600; color:var(--text-secondary); margin-bottom:0.6rem; display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.05); padding-top:0.75rem;">
            <span>Shift Target vs Completed Ritase</span>
            <span><span style="color:#38bdf8; margin-right:0.5rem;">● Completed</span><span style="color:#94a3b8;">⬚ Goal</span></span>
        </div>
        ${svgHtml}
    `;
};
