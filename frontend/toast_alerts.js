window.showToast = (msg) => {
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
    t.style.minWidth = '280px';
    t.style.maxWidth = '360px';
    t.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.5)';
    t.style.backdropFilter = 'blur(12px)';
    t.style.border = '1px solid rgba(255,255,255,0.1)';
    t.style.transform = 'translateX(120%)';
    t.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s';
    t.style.display = 'flex';
    t.style.alignItems = 'center';
    t.style.gap = '0.75rem';
    t.style.color = '#fff';
    
    const text = msg.toLowerCase();
    let bg = 'rgba(30, 41, 59, 0.85)';
    let border = 'rgba(255, 255, 255, 0.1)';
    let icon = 'ℹ️';
    
    if (text.includes('success') || text.includes('applied') || text.includes('synced') || text.includes('sent')) {
        bg = 'rgba(16, 185, 129, 0.9)';
        border = 'rgba(16, 185, 129, 0.2)';
        icon = '✅';
    } else if (text.includes('low confidence') || text.includes('warning') || text.includes('discrepancy') || text.includes('mismatch')) {
        bg = 'rgba(239, 68, 68, 0.9)';
        border = 'rgba(239, 68, 68, 0.2)';
        icon = '⚠️';
    } else if (text.includes('disconnect') || text.includes('lost') || text.includes('reconnect')) {
        bg = 'rgba(245, 158, 11, 0.9)';
        border = 'rgba(245, 158, 11, 0.2)';
        icon = '⚡';
    }
    
    t.style.backgroundColor = bg;
    t.style.borderColor = border;
    
    t.innerHTML = `
        <span style="font-size:1.15rem; line-height:1;">${icon}</span>
        <div style="flex:1; line-height:1.4;">${msg}</div>
        <button style="background:none; border:none; color:rgba(255,255,255,0.6); cursor:pointer; font-size:1.1rem; padding:0; display:flex; align-items:center;">×</button>
    `;
    
    c.appendChild(t);
    
    requestAnimationFrame(() => {
        t.style.transform = 'translateX(0)';
    });
    
    let timeLeft = 4000;
    let timerId = null;
    let startTime = null;

    const dismiss = () => {
        t.style.transform = 'translateX(120%)';
        t.style.opacity = '0';
        setTimeout(() => {
            t.remove();
        }, 300);
    };

    const startTimer = () => {
        startTime = Date.now();
        timerId = setTimeout(dismiss, timeLeft);
    };

    const pauseTimer = () => {
        clearTimeout(timerId);
        timeLeft -= (Date.now() - startTime);
        if (timeLeft < 0) timeLeft = 0;
    };

    t.addEventListener('mouseenter', pauseTimer);
    t.addEventListener('mouseleave', () => {
        if (timeLeft > 0) startTimer();
    });

    const closeBtn = t.querySelector('button');
    if (closeBtn) {
        closeBtn.onclick = () => {
            clearTimeout(timerId);
            dismiss();
        };
    }

    startTimer();
};
