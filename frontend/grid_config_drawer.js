document.addEventListener('DOMContentLoaded', () => {
    const btnOpen = document.getElementById('btn-configure-grid');
    const btnClose = document.getElementById('btn-close-grid-config');
    const drawer = document.getElementById('grid-config-drawer');
    const container = document.getElementById('grid-cards-list-container');
    const btnSave = document.getElementById('btn-save-grid-config');
    const btnReset = document.getElementById('btn-reset-grid-config');
    const cardsParent = document.getElementById('reports-cards-container');

    if (!btnOpen || !drawer || !cardsParent) return;

    const DEFAULT_CARDS = [
        { id: 'card-ritase', name: 'Haulage Cycle Records (Ritase)' },
        { id: 'card-shift-dist', name: 'Shift Distribution' },
        { id: 'card-allocation', name: 'Contractor Allocation Summary' },
        { id: 'card-compliance', name: 'Shift-Target Compliance Gauge' },
        { id: 'card-comparison', name: 'Performance Comparison Chart' },
        { id: 'card-target-deviation', name: 'Subcontractor Hourly Target Deviation' },
        { id: 'card-leaderboard', name: 'Subcontractor Dispatch Efficiency Leaderboard' },
        { id: 'card-timeline', name: 'Subcontractor Compliance Timeline' },
        { id: 'card-efficiency', name: 'Contractor Efficiency Heat Grid' },
        { id: 'card-scatter', name: 'Cycle Duration Scatter Plot' },
        { id: 'card-discrepancy', name: 'Subcontractor Dispatch Discrepancy Heat Grid' },
        { id: 'card-speed', name: 'Cycle Speed Variance' }
    ];

    let currentConfig = [];

    function loadConfig() {
        const stored = localStorage.getItem('dashboard-grid-config');
        if (stored) {
            try {
                currentConfig = JSON.parse(stored);
                // Ensure all default cards are present in stored config (for backward compatibility)
                DEFAULT_CARDS.forEach(def => {
                    if (!currentConfig.some(c => c.id === def.id)) {
                        currentConfig.push({ ...def, visible: true });
                    }
                });
            } catch (e) {
                currentConfig = DEFAULT_CARDS.map(c => ({ ...c, visible: true }));
            }
        } else {
            currentConfig = DEFAULT_CARDS.map(c => ({ ...c, visible: true }));
        }
    }

    function applyLayout() {
        currentConfig.forEach(item => {
            const el = document.getElementById(item.id);
            if (el) {
                el.classList.toggle('hidden', !item.visible);
                // Re-append to change DOM order
                cardsParent.appendChild(el);
            }
        });
    }

    function renderList() {
        container.innerHTML = '';
        currentConfig.forEach((item, index) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:0.5rem; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:4px; gap:0.5rem;';
            
            const left = document.createElement('div');
            left.style.cssText = 'display:flex; align-items:center; gap:0.5rem; flex:1;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = item.visible;
            checkbox.onchange = (e) => {
                item.visible = e.target.checked;
            };
            
            const label = document.createElement('span');
            label.textContent = item.name;
            label.style.fontSize = '0.8rem';
            
            left.appendChild(checkbox);
            left.appendChild(label);
            row.appendChild(left);
            
            const right = document.createElement('div');
            right.style.cssText = 'display:flex; gap:0.25rem;';
            
            const upBtn = document.createElement('button');
            upBtn.innerHTML = '▲';
            upBtn.style.cssText = 'background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:0.75rem;';
            upBtn.disabled = index === 0;
            upBtn.onclick = () => {
                const temp = currentConfig[index];
                currentConfig[index] = currentConfig[index - 1];
                currentConfig[index - 1] = temp;
                renderList();
            };
            
            const downBtn = document.createElement('button');
            downBtn.innerHTML = '▼';
            downBtn.style.cssText = 'background:none; border:none; color:var(--text-secondary); cursor:pointer; font-size:0.75rem;';
            downBtn.disabled = index === currentConfig.length - 1;
            downBtn.onclick = () => {
                const temp = currentConfig[index];
                currentConfig[index] = currentConfig[index + 1];
                currentConfig[index + 1] = temp;
                renderList();
            };
            
            right.appendChild(upBtn);
            right.appendChild(downBtn);
            row.appendChild(right);
            container.appendChild(row);
        });
    }

    btnOpen.onclick = () => {
        loadConfig();
        renderList();
        drawer.classList.remove('hidden');
    };

    btnClose.onclick = () => {
        drawer.classList.add('hidden');
    };

    btnSave.onclick = () => {
        const prevConfig = localStorage.getItem('dashboard-grid-config');
        localStorage.setItem('dashboard-grid-config', JSON.stringify(currentConfig));
        applyLayout();
        drawer.classList.add('hidden');

        if (window.showUndoToast) {
            window.showUndoToast('Grid layout preferences saved', () => {
                if (prevConfig) {
                    localStorage.setItem('dashboard-grid-config', prevConfig);
                } else {
                    localStorage.removeItem('dashboard-grid-config');
                }
                loadConfig();
                applyLayout();
            });
        } else if (window.showToast) {
            window.showToast('Grid layout preferences saved successfully.');
        }
    };

    btnReset.onclick = () => {
        const prevConfig = localStorage.getItem('dashboard-grid-config');
        localStorage.removeItem('dashboard-grid-config');
        loadConfig();
        applyLayout();
        renderList();

        if (window.showUndoToast) {
            window.showUndoToast('Grid layout reset to default', () => {
                if (prevConfig) {
                    localStorage.setItem('dashboard-grid-config', prevConfig);
                    loadConfig();
                    applyLayout();
                    renderList();
                }
            });
        }
    };

    // Load initial config and apply layout at startup
    loadConfig();
    applyLayout();
});
