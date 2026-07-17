document.addEventListener('DOMContentLoaded', () => {
    const btnSchematic = document.getElementById('btn-map-schematic');
    const btnOutline = document.getElementById('btn-map-outline');
    const btnHeatmap = document.getElementById('btn-map-heatmap');

    const gridLines = document.getElementById('map-grid-lines');
    const roadOuter = document.getElementById('map-road-outer');
    const roadInner = document.getElementById('map-road-inner');

    const heatLoading = document.getElementById('heat-loading');
    const heatDumping = document.getElementById('heat-dumping');
    const heatHaulroad = document.getElementById('heat-haulroad');

    if (!btnSchematic || !btnOutline || !btnHeatmap || !gridLines || !roadOuter || !roadInner) return;

    const getCrossingCounts = () => {
        const crossings = window.currentCrossings || [];
        const counts = { 'South Gate': 0, 'Main Portal': 0, 'North Checkpoint': 0 };
        crossings.forEach(c => {
            const lane = c.lane || '';
            if (counts[lane] !== undefined) {
                counts[lane]++;
            }
        });
        if (crossings.length === 0) {
            return { 'South Gate': 15, 'Main Portal': 12, 'North Checkpoint': 27 };
        }
        return counts;
    };

    const applyHeatmapStyles = () => {
        const counts = getCrossingCounts();
        const zones = [
            { el: heatLoading, count: counts['South Gate'] },
            { el: heatDumping, count: counts['Main Portal'] },
            { el: heatHaulroad, count: counts['North Checkpoint'] }
        ];

        zones.forEach(z => {
            if (!z.el) return;
            const r = 12 + Math.min(z.count * 0.8, 18);
            z.el.setAttribute('r', r);
            z.el.style.stroke = 'none';
            if (z.count < 10) {
                z.el.setAttribute('fill', 'rgba(56, 189, 248, 0.6)');
            } else if (z.count < 25) {
                z.el.setAttribute('fill', 'rgba(245, 158, 11, 0.65)');
            } else {
                z.el.setAttribute('fill', 'rgba(239, 68, 68, 0.75)');
            }
        });
    };

    const setMapStyle = (style) => {
        document.querySelectorAll('.map-header .btn').forEach(btn => btn.classList.remove('active'));

        if (style === 'schematic') {
            btnSchematic.classList.add('active');
            gridLines.style.opacity = '1';
            roadOuter.setAttribute('stroke', '#1e293b');
            roadOuter.setAttribute('stroke-width', '8');
            roadInner.setAttribute('stroke', 'rgba(56, 189, 248, 0.08)');
            roadInner.setAttribute('stroke-width', '14');

            [heatLoading, heatDumping, heatHaulroad].forEach(el => {
                if (!el) return;
                el.setAttribute('r', '16');
                el.setAttribute('fill', 'rgba(16, 185, 129, 0.15)');
                el.style.stroke = 'none';
            });
        } else if (style === 'outline') {
            btnOutline.classList.add('active');
            gridLines.style.opacity = '0';
            roadOuter.setAttribute('stroke', 'var(--border)');
            roadOuter.setAttribute('stroke-width', '6');
            roadInner.setAttribute('stroke', 'transparent');

            [heatLoading, heatDumping, heatHaulroad].forEach(el => {
                if (!el) return;
                el.setAttribute('r', '16');
                el.setAttribute('fill', 'none');
                el.style.stroke = 'var(--primary)';
                el.style.strokeWidth = '1.5px';
                el.style.strokeDasharray = '3 3';
            });
        } else if (style === 'heatmap') {
            btnHeatmap.classList.add('active');
            gridLines.style.opacity = '0.3';
            roadOuter.setAttribute('stroke', '#4c1d95');
            roadOuter.setAttribute('stroke-width', '8');
            roadInner.setAttribute('stroke', 'rgba(244, 63, 94, 0.3)');
            roadInner.setAttribute('stroke-width', '20');

            applyHeatmapStyles();
        }
    };

    btnSchematic.addEventListener('click', () => setMapStyle('schematic'));
    btnOutline.addEventListener('click', () => setMapStyle('outline'));
    btnHeatmap.addEventListener('click', () => setMapStyle('heatmap'));
});
