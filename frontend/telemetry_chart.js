window.renderTelemetrySparklines = async (towers) => {
    try {
        const res = await fetch('/api/telemetry/history');
        if (!res.ok) return;
        const history = await res.json();
        
        towers.forEach(t => {
            const container = document.getElementById(`sparkline-${t.id}`);
            if (!container) return;
            
            const logs = history.filter(l => l.tower_id === t.id).reverse().slice(-10);
            if (logs.length < 2) {
                container.innerHTML = `
                    <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:0.5rem;margin-top:0.5rem;font-size:0.7rem;color:var(--text-secondary);text-align:center;">
                        Gathering history logs...
                    </div>
                `;
                return;
            }
            
            const w = container.clientWidth || 120;
            const h = 30;
            
            const getPointsPath = (dataValues, maxVal) => {
                const step = w / (dataValues.length - 1);
                return dataValues.map((val, idx) => {
                    const x = idx * step;
                    const y = h - 2 - ((val / maxVal) * (h - 4));
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                }).join(' L ');
            };
            
            const batteryVals = logs.map(l => l.battery);
            const solarVals = logs.map(l => l.solar_output);
            
            const bPath = getPointsPath(batteryVals, 100);
            const sPath = getPointsPath(solarVals, 150);
            
            container.innerHTML = `
                <div style="border-top:1px solid rgba(255,255,255,0.05);padding-top:0.5rem;margin-top:0.5rem;">
                    <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text-secondary);margin-bottom:0.2rem;">
                        <span>Trends (Last 10 cycles)</span>
                        <span><span style="color:#38bdf8;margin-right:0.4rem;">● Batt</span><span style="color:#fbbf24;">● Solar</span></span>
                    </div>
                    <svg width="100%" height="${h}" style="display:block;overflow:visible;">
                        <path d="M ${bPath}" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M ${sPath}" fill="none" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
            `;
        });
    } catch (e) {
        console.error('Error rendering telemetry sparklines:', e);
    }
};
