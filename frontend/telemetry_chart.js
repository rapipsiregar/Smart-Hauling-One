document.addEventListener('DOMContentLoaded', () => {
    const telemetryModal = document.getElementById('telemetry-modal');
    if (!telemetryModal) return;

    let activeTelemetryTowerId = 'Tower-Alpha';

    const getWindowParam = (hrs) => {
        if (hrs === 1) return '1h';
        if (hrs === 6) return '6h';
        if (hrs === 24) return '24h';
        return '7d';
    };

    const drawCorrelationChart = (historyData) => {
        const width = 600;
        const height = 220;
        
        let batteryPts = [];
        let solarPts = [];
        if (historyData && historyData.length > 0) {
            const sorted = [...historyData].reverse();
            batteryPts = sorted.map(d => d.battery);
            solarPts = sorted.map(d => d.solar_output);
        } else {
            batteryPts = [80, 82, 81, 83, 84, 85];
            solarPts = [110, 115, 105, 120, 125, 130];
        }

        const len = batteryPts.length;
        
        const getLineX = (i) => 30 + (i / Math.max(1, len - 1)) * 240;
        const getLineY = (val, max) => 180 - (val / max) * 130;
        
        let batPath = '';
        let solarPath = '';
        if (len > 0) {
            batPath = `M ${getLineX(0)} ${getLineY(batteryPts[0], 100)}`;
            solarPath = `M ${getLineX(0)} ${getLineY(solarPts[0], 150)}`;
            for (let i = 1; i < len; i++) {
                batPath += ` L ${getLineX(i)} ${getLineY(batteryPts[i], 100)}`;
                solarPath += ` L ${getLineX(i)} ${getLineY(solarPts[i], 150)}`;
            }
        }
        
        const getScatterX = (solar) => 340 + (solar / 150) * 240;
        const getScatterY = (bat) => 180 - (bat / 100) * 130;
        
        let scatterCircles = '';
        for (let i = 0; i < len; i++) {
            const cx = getScatterX(solarPts[i]);
            const cy = getScatterY(batteryPts[i]);
            scatterCircles += `<circle cx="${cx}" cy="${cy}" r="4" fill="#a855f7" opacity="0.8" stroke="var(--border)" stroke-width="0.5" />`;
        }
        
        let regressionLine = '';
        if (len > 1) {
            let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
            for (let i = 0; i < len; i++) {
                sumX += solarPts[i];
                sumY += batteryPts[i];
                sumXY += solarPts[i] * batteryPts[i];
                sumXX += solarPts[i] * solarPts[i];
            }
            const slope = (len * sumXY - sumX * sumY) / (len * sumXX - sumX * sumX || 1);
            const intercept = (sumY - slope * sumX) / len;
            
            const yStart = Math.max(0, Math.min(100, slope * 0 + intercept));
            const yEnd = Math.max(0, Math.min(100, slope * 150 + intercept));
            
            regressionLine = `<line x1="${getScatterX(0)}" y1="${getScatterY(yStart)}" x2="${getScatterX(150)}" y2="${getScatterY(yEnd)}" stroke="#f43f5e" stroke-width="1.5" stroke-dasharray="4" />`;
        }

        return `
        <svg viewBox="0 0 ${width} ${height}" style="width:100%">
            <line x1="30" y1="40" x2="270" y2="40" stroke="#1e293b" stroke-dasharray="3"/>
            <line x1="30" y1="110" x2="270" y2="110" stroke="#1e293b" stroke-dasharray="3"/>
            <line x1="30" y1="180" x2="270" y2="180" stroke="#1e293b"/>
            
            ${batPath ? `<path d="${batPath}" fill="none" stroke="#38bdf8" stroke-width="2.5" />` : ''}
            ${solarPath ? `<path d="${solarPath}" fill="none" stroke="#fbbf24" stroke-width="2.5" />` : ''}
            
            <text x="30" y="25" fill="#38bdf8" font-size="10" font-family="sans-serif" font-weight="600">🔋 Battery (%)</text>
            <text x="140" y="25" fill="#fbbf24" font-size="10" font-family="sans-serif" font-weight="600">☀️ Solar (W)</text>
            <text x="30" y="195" fill="var(--text-secondary)" font-size="9" font-family="sans-serif">← Time (Older)</text>
            <text x="220" y="195" fill="var(--text-secondary)" font-size="9" font-family="sans-serif">(Newer) →</text>
            
            <line x1="340" y1="40" x2="580" y2="40" stroke="#1e293b" stroke-dasharray="3"/>
            <line x1="340" y1="110" x2="580" y2="110" stroke="#1e293b" stroke-dasharray="3"/>
            <line x1="340" y1="180" x2="580" y2="180" stroke="#1e293b"/>
            <line x1="340" y1="40" x2="340" y2="180" stroke="#1e293b"/>
            
            ${scatterCircles}
            ${regressionLine}
            
            <text x="340" y="25" fill="#a855f7" font-size="10" font-family="sans-serif" font-weight="600">⚡ Solar vs Battery Correlation</text>
            <text x="440" y="195" fill="var(--text-secondary)" font-size="9" font-family="sans-serif">Solar Output (W)</text>
            <text x="315" y="115" fill="var(--text-secondary)" font-size="9" font-family="sans-serif" transform="rotate(-90 315 115)" text-anchor="middle">Battery (%)</text>
        </svg>`;
    };

    const openTelemetryTrends = async (id) => {
        activeTelemetryTowerId = id || activeTelemetryTowerId;
        document.getElementById('telemetry-modal-title').textContent = `${activeTelemetryTowerId} Telemetry Trends`;
        
        const activeSel = document.querySelector('.time-selector.active');
        const hrs = activeSel ? parseInt(activeSel.dataset.hours) : 6;
        const windowParam = getWindowParam(hrs);
        
        try {
            const res = await fetch(`/api/admin/telemetry-history?window=${windowParam}&tower_id=${activeTelemetryTowerId}`);
            if (!res.ok) throw new Error("Failed to fetch telemetry history");
            
            const data = await res.json();
            const historyList = data.history[activeTelemetryTowerId] || [];
            
            document.getElementById('telemetry-chart-container').innerHTML = drawCorrelationChart(historyList);
            telemetryModal.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            document.getElementById('telemetry-chart-container').innerHTML = drawCorrelationChart([]);
            telemetryModal.classList.remove('hidden');
        }
    };

    const telemetryContainer = document.getElementById('telemetry-container');
    if (telemetryContainer) {
        telemetryContainer.onclick = (e) => {
            const item = e.target.closest('.telemetry-item');
            if (item) openTelemetryTrends(item.dataset.id);
        };
    }

    const mapContainer = document.getElementById('map-pins-container');
    if (mapContainer) {
        mapContainer.onclick = (e) => {
            const pin = e.target.closest('.map-marker-pin');
            if (pin) openTelemetryTrends(pin.dataset.id);
        };
    }

    document.querySelectorAll('.time-selector').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.time-selector').forEach(b => b.classList.toggle('active', b === btn));
            openTelemetryTrends();
        };
    });
});
