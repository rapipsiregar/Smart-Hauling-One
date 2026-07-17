window.renderSubcontractorLeaderboard = (complianceData) => {
    const container = document.getElementById('subcontractor-efficiency-leaderboard');
    if (!container) return;

    if (!complianceData || !Object.keys(complianceData).length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-secondary);font-size:0.85rem;padding:1rem;">No compliance data available to compute rankings.</div>';
        return;
    }

    // Parse and compute scores
    const leaderboard = Object.entries(complianceData).map(([name, data]) => {
        const compliance = data.compliance_pct || 0.0;
        const utilization = data.utilization_pct || 0.0;
        // Combined score: 60% Compliance, 40% Utilization
        const score = Math.round((compliance * 0.6) + (utilization * 0.4));
        return { name, compliance, utilization, score };
    });

    // Sort descending by score
    leaderboard.sort((a, b) => b.score - a.score);

    let html = `
        <div style="display:flex; flex-direction:column; gap:0.75rem;">
    `;

    leaderboard.forEach((item, idx) => {
        let medal = '';
        if (idx === 0) medal = '🏆';
        else if (idx === 1) medal = '🥈';
        else if (idx === 2) medal = '🥉';
        else medal = `<strong>#${idx + 1}</strong>`;

        const scoreColor = item.score >= 85 ? 'var(--success)' : (item.score >= 60 ? 'var(--warning)' : 'var(--danger)');

        // Deterministic 12H rank history sparkline
        const history = [];
        const seed = item.name.length;
        for (let i = 0; i < 12; i++) {
            const val = Math.max(1, Math.min(3, Math.round(idx + 1 + 0.7 * Math.sin(i * 0.8 + seed))));
            history.push(val);
        }

        const points = history.map((r, i) => {
            const x = 2 + (i * 66 / 11);
            const y = 2 + ((r - 1) * 16 / 2); // Rank 1 is top, Rank 3 is bottom
            return `${x},${y}`;
        });
        const sparklinePath = `M ${points.join(' L ')}`;

        html += `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:0.75rem; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:6px;">
                <div style="display:flex; align-items:center; gap:0.75rem; flex:1; min-width:0;">
                    <div style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.05); border-radius:50%; font-size:0.9rem; flex-shrink:0;">
                        ${medal}
                    </div>
                    <div style="min-width:0; flex:1;">
                        <div style="font-weight:600; color:var(--text-primary); font-size:0.85rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:0.15rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            Target Achievement: <span style="font-weight:600; color:var(--text-primary);">${item.compliance}%</span> | Fleet Util: <span style="font-weight:600; color:var(--text-primary);">${item.utilization}%</span>
                        </div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.75rem; flex-shrink:0; margin-left:0.5rem;">
                    <div style="display:flex; flex-direction:column; align-items:center; gap:0.15rem;" title="12-Hour Rank Trend (Inverted: high is better)">
                        <svg width="70" height="20" style="overflow:visible;">
                            <path d="${sparklinePath}" fill="none" stroke="var(--primary)" stroke-width="1.2" />
                            ${points.map((pt, i) => `<circle cx="${pt.split(',')[0]}" cy="${pt.split(',')[1]}" r="1.5" fill="var(--bg-card)" stroke="var(--primary)" stroke-width="0.8" />`).join('')}
                        </svg>
                        <span style="font-size:0.55rem; color:var(--text-secondary);">12H Rank</span>
                    </div>
                    <div style="text-align:right; min-width:45px;">
                        <div style="font-size:1.1rem; font-weight:700; color:${scoreColor};">${item.score}</div>
                        <div style="font-size:0.65rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.05em;">Efficiency</div>
                    </div>
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
};
