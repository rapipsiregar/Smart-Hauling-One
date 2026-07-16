window.renderShiftCards = (shift_distribution) => {
    const container = document.getElementById('shift-distribution-container');
    if (!container || !shift_distribution) return;

    const values = Object.values(shift_distribution);
    const maxVal = Math.max(...values, 1);

    container.innerHTML = `
        <div class="shift-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem;">
            ${Object.entries(shift_distribution).map(([slot, count]) => `
                <div class="shift-summary-card" style="border: 1px solid var(--border); border-radius: 8px; padding: 1rem; background: var(--bg-card); display: flex; flex-direction: column; gap: 0.5rem; break-inside: avoid; page-break-inside: avoid;">
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
                        <span>🕒 Shift Block</span>
                        <span style="background: rgba(14, 165, 233, 0.1); color: var(--primary); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem;">Active</span>
                    </div>
                    <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-top: 0.25rem;">${slot}</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: var(--primary); margin: 0.25rem 0;">
                        ${count} <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-secondary);">Passages</span>
                    </div>
                    <div class="dist-bar-bg" style="margin-top: auto; height: 6px; background-color: #1e293b; border-radius: 3px; overflow: hidden;">
                        <div class="dist-bar-fill" style="height: 100%; background: linear-gradient(90deg, var(--primary), var(--secondary)); border-radius: 3px; width: ${((count / maxVal) * 100).toFixed(0)}%"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
};
