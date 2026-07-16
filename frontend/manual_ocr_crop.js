document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('ocr-crop-container');
    const box = document.getElementById('ocr-crop-box');
    const img = document.getElementById('ocr-context-img');
    const bboxLabel = document.getElementById('ocr-bbox-label');
    const btnReprocess = document.getElementById('btn-reprocess-ocr');
    const correctModal = document.getElementById('correct-modal');

    let currentCrossingId = null;
    let isDrawing = false;
    let startX = 0, startY = 0;
    let bboxCoords = { x_min: 0.2, y_min: 0.2, x_max: 0.8, y_max: 0.8 };

    // Triggered when Correct modal is opened via context menu
    window.onCorrectModalOpened = (crossingId) => {
        currentCrossingId = crossingId;
        const cards = document.querySelectorAll('.crossing-feed-card');
        const card = Array.from(cards).find(c => parseInt(c.dataset.id) === crossingId);
        if (card) {
            const contextImg = card.querySelectorAll('.feed-thumb img')[1];
            if (contextImg && img) {
                img.src = contextImg.src;
            }
        }
        resetBox();
    };

    const resetBox = () => {
        if (!container || !box) return;
        const w = container.clientWidth || 380;
        const h = container.clientHeight || 213;
        
        const boxW = Math.round(w * 0.6);
        const boxH = Math.round(h * 0.6);
        const boxL = Math.round(w * 0.2);
        const boxT = Math.round(h * 0.2);

        box.style.left = `${boxL}px`;
        box.style.top = `${boxT}px`;
        box.style.width = `${boxW}px`;
        box.style.height = `${boxH}px`;
        
        updateBBox(boxL, boxT, boxW, boxH);
    };

    const updateBBox = (left, top, width, height) => {
        if (!container || !bboxLabel) return;
        const w = container.clientWidth || 1;
        const h = container.clientHeight || 1;
        
        const x_min = Math.max(0, left / w);
        const y_min = Math.max(0, top / h);
        const x_max = Math.min(1, (left + width) / w);
        const y_max = Math.min(1, (top + height) / h);
        
        bboxCoords = { x_min, y_min, x_max, y_max };
        bboxLabel.textContent = `BBox: [${x_min.toFixed(2)}, ${y_min.toFixed(2)}, ${x_max.toFixed(2)}, ${y_max.toFixed(2)}]`;
    };

    // Support drawing and dragging box
    if (container && box) {
        container.addEventListener('mousedown', (e) => {
            if (e.target === box) {
                let dragStartLeft = box.offsetLeft;
                let dragStartTop = box.offsetTop;
                let dragStartX = e.clientX;
                let dragStartY = e.clientY;
                
                const onMouseMove = (moveEv) => {
                    const dx = moveEv.clientX - dragStartX;
                    const dy = moveEv.clientY - dragStartY;
                    let newL = Math.max(0, Math.min(container.clientWidth - box.clientWidth, dragStartLeft + dx));
                    let newT = Math.max(0, Math.min(container.clientHeight - box.clientHeight, dragStartTop + dy));
                    box.style.left = `${newL}px`;
                    box.style.top = `${newT}px`;
                    updateBBox(newL, newT, box.clientWidth, box.clientHeight);
                };
                
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                e.preventDefault();
                return;
            }

            const rect = container.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            isDrawing = true;

            box.style.left = `${startX}px`;
            box.style.top = `${startY}px`;
            box.style.width = '0px';
            box.style.height = '0px';
            
            const onMouseMove = (moveEv) => {
                if (!isDrawing) return;
                const curX = Math.max(0, Math.min(container.clientWidth, moveEv.clientX - rect.left));
                const curY = Math.max(0, Math.min(container.clientHeight, moveEv.clientY - rect.top));
                const left = Math.min(startX, curX);
                const top = Math.min(startY, curY);
                const width = Math.abs(startX - curX);
                const height = Math.abs(startY - curY);
                
                box.style.left = `${left}px`;
                box.style.top = `${top}px`;
                box.style.width = `${width}px`;
                box.style.height = `${height}px`;
                updateBBox(left, top, width, height);
            };

            const onMouseUp = () => {
                isDrawing = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });
    }

    if (btnReprocess) {
        btnReprocess.addEventListener('click', async () => {
            if (!currentCrossingId) return;
            btnReprocess.disabled = true;
            btnReprocess.textContent = 'Running OCR...';
            try {
                const response = await fetch(`/api/crossings/${currentCrossingId}/reprocess-ocr`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bboxCoords)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (typeof window.showToast === 'function') {
                        window.showToast(data.message);
                    }
                    if (correctModal) {
                        correctModal.classList.add('hidden');
                    }
                }
            } catch (err) {
                console.error("Error during OCR reprocessing:", err);
            } finally {
                btnReprocess.disabled = false;
                btnReprocess.textContent = 'Re-trigger OCR';
            }
        });
    }
});
