window.drawBackupTimeline = (backups) => {
    const canvas = document.getElementById('backup-timeline-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!backups || backups.length === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', w/2, h/2);
        return;
    }
    const sorted = [...backups].sort((a, b) => a.created_at - b.created_at);
    const sizes = sorted.map(b => b.size_bytes);
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);
    const sizeRange = maxSize - minSize || 1;
    const padding = 15;
    const graphW = w - padding * 2;
    const graphH = h - padding * 2;
    const points = sorted.map((b, idx) => {
        const x = padding + (sorted.length > 1 ? (idx / (sorted.length - 1)) * graphW : graphW / 2);
        const y = padding + graphH - ((b.size_bytes - minSize) / sizeRange) * graphH;
        return { x, y, b };
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.stroke();
    if (points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, h - padding);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, h - padding);
        ctx.closePath();
        const areaGrad = ctx.createLinearGradient(0, 0, 0, h);
        areaGrad.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
        areaGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = areaGrad;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
    });
    if (points.length > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        const startDate = new Date(points[0].b.created_at * 1000).toLocaleDateString([], {month:'short', day:'numeric'});
        ctx.fillText(startDate, padding, h - 3);
        if (points.length > 1) {
            ctx.textAlign = 'right';
            const endDate = new Date(points[points.length - 1].b.created_at * 1000).toLocaleDateString([], {month:'short', day:'numeric'});
            ctx.fillText(endDate, w - padding, h - 3);
        }
    }
};
