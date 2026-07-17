window.showUndoToast = (msg, onUndo) => {
    let c = document.getElementById('toast-container');
    if (!c) {
        c = document.createElement('div');
        c.id = 'toast-container';
        c.style.position = 'fixed';
        c.style.top = '1.5rem';
        c.style.right = '1.5rem';
        c.style.zIndex = '9999';
        c.style.display = 'flex';
        c.style.flexDirection = 'column';
        c.style.gap = '0.5rem';
        c.style.pointerEvents = 'none';
        document.body.appendChild(c);
    }
    
    const t = document.createElement('div');
    t.style.pointerEvents = 'auto';
    t.style.padding = '0.75rem 1.25rem';
    t.style.borderRadius = '8px';
    t.style.fontSize = '0.85rem';
    t.style.fontWeight = '500';
    t.style.minWidth = '300px';
    t.style.maxWidth = '380px';
    t.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.5)';
    t.style.backdropFilter = 'blur(12px)';
    t.style.border = '1px solid rgba(255,255,255,0.1)';
    t.style.transform = 'translateX(120%)';
    t.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s';
    t.style.display = 'flex';
    t.style.alignItems = 'center';
    t.style.justifyContent = 'space-between';
    t.style.gap = '0.75rem';
    t.style.color = '#fff';
    t.style.backgroundColor = 'rgba(30, 41, 59, 0.9)';
    t.style.borderColor = 'rgba(255, 255, 255, 0.15)';

    const contentDiv = document.createElement('div');
    contentDiv.style.flex = '1';
    contentDiv.style.display = 'flex';
    contentDiv.style.alignItems = 'center';
    contentDiv.style.gap = '0.5rem';
    contentDiv.innerHTML = `<span>↩️</span> <div>${msg}</div>`;
    t.appendChild(contentDiv);

    const undoBtn = document.createElement('button');
    undoBtn.textContent = 'Undo';
    undoBtn.style.cssText = 'background:var(--primary); color:white; border:none; border-radius:4px; padding:0.25rem 0.5rem; font-size:0.75rem; font-weight:600; cursor:pointer; transition: opacity 0.2s;';
    undoBtn.onmouseover = () => undoBtn.style.opacity = '0.8';
    undoBtn.onmouseout = () => undoBtn.style.opacity = '1';
    
    let isUndone = false;
    undoBtn.onclick = async () => {
        if (isUndone) return;
        isUndone = true;
        undoBtn.disabled = true;
        undoBtn.textContent = 'Undone';
        undoBtn.style.background = 'rgba(255,255,255,0.1)';
        undoBtn.style.color = 'rgba(255,255,255,0.4)';
        try {
            await onUndo();
            contentDiv.querySelector('div').textContent = 'Action undone successfully';
        } catch (err) {
            console.error('Undo failed:', err);
        }
        setTimeout(() => {
            t.style.transform = 'translateX(120%)';
            t.style.opacity = '0';
            setTimeout(() => t.remove(), 300);
        }, 1000);
    };
    t.appendChild(undoBtn);

    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText = 'background:none; border:none; color:rgba(255,255,255,0.6); cursor:pointer; font-size:1.1rem; padding:0; display:flex; align-items:center;';
    closeBtn.onclick = () => {
        t.style.transform = 'translateX(120%)';
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    };
    t.appendChild(closeBtn);

    c.appendChild(t);
    
    // Slide in
    setTimeout(() => {
        t.style.transform = 'translateX(0)';
    }, 50);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
        if (!isUndone && t.parentNode) {
            t.style.transform = 'translateX(120%)';
            t.style.opacity = '0';
            setTimeout(() => t.remove(), 300);
        }
    }, 5000);
};
