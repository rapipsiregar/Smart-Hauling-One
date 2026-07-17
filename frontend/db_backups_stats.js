window.renderBackupStats = (backups) => {
    const growthEl = document.getElementById('backup-stat-growth');
    const avgEl = document.getElementById('backup-stat-avg');
    const totalEl = document.getElementById('backup-stat-total');

    if (!growthEl || !avgEl || !totalEl) return;

    if (!backups || backups.length === 0) {
        growthEl.textContent = 'N/A';
        avgEl.textContent = 'N/A';
        totalEl.textContent = 'N/A';
        return;
    }

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Sort chronologically
    const sorted = [...backups].sort((a, b) => a.created_at - b.created_at);
    
    // Average size
    const sum = sorted.reduce((acc, b) => acc + b.size_bytes, 0);
    const avg = sum / sorted.length;

    // Growth rate (comparing first and last backup)
    let growthLabel = '0 B (0%)';
    if (sorted.length > 1) {
        const first = sorted[0].size_bytes;
        const last = sorted[sorted.length - 1].size_bytes;
        const diff = last - first;
        const percent = first > 0 ? (diff / first) * 100 : 0;
        const sign = diff >= 0 ? '+' : '';
        growthLabel = `${sign}${formatBytes(diff)} (${sign}${percent.toFixed(1)}%)`;
    }

    growthEl.textContent = growthLabel;
    avgEl.textContent = formatBytes(avg);
    totalEl.textContent = formatBytes(sum);
};
