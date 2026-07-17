document.addEventListener('DOMContentLoaded', () => {
    const btnToggle = document.getElementById('btn-toggle-camera-feeds');
    const header = document.getElementById('camera-feeds-header');
    const grid = document.getElementById('camera-feeds-grid');

    if (!btnToggle || !grid) return;

    let isExpanded = false;
    let animationFrameId = null;

    const toggleFeeds = () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
            grid.classList.remove('hidden');
            btnToggle.textContent = '▼ Collapse';
            startFeedsAnimation();
        } else {
            grid.classList.add('hidden');
            btnToggle.textContent = '▲ Expand';
            stopFeedsAnimation();
        }
    };

    header.onclick = toggleFeeds;
    btnToggle.onclick = (e) => {
        e.stopPropagation();
        toggleFeeds();
    };

    const lanes = ['North Checkpoint', 'South Gate', 'Main Portal'];
    
    // Create elements
    grid.innerHTML = '';
    const canvases = [];

    lanes.forEach((lane, idx) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'background:rgba(0,0,0,0.4); border:1px solid var(--border); border-radius:6px; overflow:hidden; display:flex; flex-direction:column;';
        
        const title = document.createElement('div');
        title.style.cssText = 'padding:0.4rem 0.6rem; font-size:0.75rem; font-weight:600; background:rgba(255,255,255,0.03); border-bottom:1px solid var(--border); color:var(--text-primary); display:flex; justify-content:space-between;';
        title.innerHTML = `<span>LANE FEED: ${lane.toUpperCase()}</span><span style="color:#ef4444; font-weight:bold; display:flex; align-items:center; gap:0.25rem;"><span style="width:6px; height:6px; border-radius:50%; background:#ef4444; animation: blink 1s infinite;"></span>REC</span>`;
        
        const canvasWrapper = document.createElement('div');
        canvasWrapper.style.cssText = 'position:relative; width:100%; aspect-ratio:16/9; background:#000;';
        
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'width:100%; height:100%; display:block;';
        canvas.width = 320;
        canvas.height = 180;
        
        canvasWrapper.appendChild(canvas);
        wrapper.appendChild(title);
        wrapper.appendChild(canvasWrapper);
        grid.appendChild(wrapper);
        
        canvases.push({ canvas, lane, ctx: canvas.getContext('2d'), lastOcr: '', ocrTime: 0 });
    });

    const drawFeed = (item, time) => {
        const { canvas, ctx, lane } = item;
        const w = canvas.width;
        const h = canvas.height;

        ctx.fillStyle = '#0a0f1d';
        ctx.fillRect(0, 0, w, h);

        // Draw scanlines or noise
        ctx.strokeStyle = 'rgba(255,255,255,0.015)';
        ctx.lineWidth = 1;
        for (let y = 0; y < h; y += 4) {
            ctx.beginPath();
            ctx.moveTo(0, y + (time % 4));
            ctx.lineTo(w, y + (time % 4));
            ctx.stroke();
        }

        // Draw camera details
        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.fillStyle = '#10b981';
        ctx.fillText(`CAM-ID: ${lane.replace(/\s+/g, '-').toUpperCase()}-01`, 10, 15);
        ctx.fillText(`FPS: 29.97`, 10, 25);
        
        const d = new Date();
        const dateStr = d.toISOString().replace('T', ' ').substring(0, 19);
        ctx.fillText(dateStr, w - 105, 15);

        // Simulated truck detection overlay
        if (time - item.ocrTime > 6000) {
            if (Math.random() < 0.3) {
                const prefix = Math.random() < 0.5 ? 'DT' : 'LV';
                const num = Math.floor(Math.random() * 200) + 100;
                item.lastOcr = `${prefix}-${num}`;
            } else {
                item.lastOcr = '';
            }
            item.ocrTime = time;
        }

        if (item.lastOcr) {
            ctx.strokeStyle = '#0ea5e9';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(80, 50, 160, 80);
            
            ctx.fillStyle = '#0ea5e9';
            ctx.fillRect(80, 38, 70, 12);
            
            ctx.fillStyle = '#000';
            ctx.font = 'bold 7px "Outfit", sans-serif';
            ctx.fillText(item.lastOcr, 85, 47);
            
            ctx.fillStyle = 'rgba(14, 165, 233, 0.1)';
            ctx.fillRect(80, 50, 160, 80);
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
            ctx.font = '8px "Outfit", sans-serif';
            ctx.fillText('NO VEHICLE DETECTED', w/2 - 50, h/2);
        }
    };

    let startTime = 0;
    const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        
        canvases.forEach(item => {
            drawFeed(item, elapsed);
        });
        
        animationFrameId = requestAnimationFrame(animate);
    };

    const startFeedsAnimation = () => {
        if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(animate);
        }
    };

    const stopFeedsAnimation = () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    };
});
