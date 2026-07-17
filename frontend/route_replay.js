document.addEventListener('DOMContentLoaded', () => {
    // Coordinate mapping for checkpoints in 400x300 SVG viewbox
    const CHECKPOINT_COORDS = {
        "North Checkpoint": { x: 100, y: 100 },
        "Main Portal": { x: 200, y: 220 },
        "South Gate": { x: 300, y: 160 }
    };

    const mapSvg = document.querySelector('.map-svg');
    if (!mapSvg) return;

    // Create route replay group layer
    let replayLayer = document.getElementById('route-replay-layer');
    if (!replayLayer) {
        replayLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        replayLayer.setAttribute('id', 'route-replay-layer');
        mapSvg.appendChild(replayLayer);
    }

    // Add CSS styles for animated lines and pulse markers
    let styles = document.getElementById('route-replay-styles');
    if (!styles) {
        styles = document.createElement('style');
        styles.setAttribute('id', 'route-replay-styles');
        styles.innerHTML = `
            .route-path-bg {
                stroke: rgba(56, 189, 248, 0.15);
                stroke-width: 6;
                stroke-linecap: round;
                stroke-linejoin: round;
                fill: none;
            }
            .route-path-glow {
                stroke: var(--primary);
                stroke-width: 3;
                stroke-linecap: round;
                stroke-linejoin: round;
                fill: none;
                stroke-dasharray: 8 8;
                animation: routeFlow 2.5s linear infinite;
            }
            .route-node-pulse {
                animation: nodePulse 1.5s ease-in-out infinite alternate;
                fill: var(--primary);
                filter: drop-shadow(0 0 6px var(--primary));
            }
            .route-node-label {
                font-family: 'Outfit', sans-serif;
                font-size: 8px;
                font-weight: 700;
                fill: var(--primary);
                text-shadow: 0 1px 3px rgba(0,0,0,0.8);
            }
            @keyframes routeFlow {
                to {
                    stroke-dashoffset: -16;
                }
            }
            @keyframes nodePulse {
                from {
                    r: 4px;
                    opacity: 0.6;
                }
                to {
                    r: 8px;
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Event delegation on the live crossings list
    const feedList = document.getElementById('live-feed-list');
    if (feedList) {
        feedList.addEventListener('mouseover', (e) => {
            const card = e.target.closest('.crossing-feed-card');
            if (!card) return;

            const ohtIdEl = card.querySelector('.oht-id');
            if (!ohtIdEl) return;

            const hullId = ohtIdEl.textContent.trim();
            drawRouteReplay(hullId);
        });

        feedList.addEventListener('mouseout', (e) => {
            const card = e.target.closest('.crossing-feed-card');
            if (!card) return;

            clearRouteReplay();
        });
    }

    function drawRouteReplay(hullId) {
        clearRouteReplay();

        // Access crossings stored globally in window.currentCrossings
        const crossings = window.currentCrossings || [];
        
        // Filter and sort crossings chronologically for this hullId
        const history = crossings
            .filter(c => c.hull_id === hullId)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        if (history.length === 0) return;

        // Build list of unique coordinates in sequence
        const points = [];
        history.forEach(c => {
            const lane = c.lane;
            const coord = CHECKPOINT_COORDS[lane];
            if (coord) {
                points.push({
                    x: coord.x,
                    y: coord.y,
                    lane: lane,
                    time: new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                });
            }
        });

        if (points.length === 0) return;

        // Render path connections
        if (points.length > 1) {
            let pathD = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                pathD += ` L ${points[i].x} ${points[i].y}`;
            }

            // Background trace line
            const pathBg = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathBg.setAttribute('d', pathD);
            pathBg.setAttribute('class', 'route-path-bg');
            replayLayer.appendChild(pathBg);

            // Flowing glow line
            const pathGlow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathGlow.setAttribute('d', pathD);
            pathGlow.setAttribute('class', 'route-path-glow');
            replayLayer.appendChild(pathGlow);
        }

        // Draw node markers with step numbers
        points.forEach((pt, index) => {
            // Pulse circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', pt.x);
            circle.setAttribute('cy', pt.y);
            circle.setAttribute('r', '6');
            circle.setAttribute('class', 'route-node-pulse');
            replayLayer.appendChild(circle);

            // Step index label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', pt.x);
            text.setAttribute('y', pt.y - 12);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('class', 'route-node-label');
            text.textContent = `${index + 1}. ${pt.lane} (${pt.time})`;
            replayLayer.appendChild(text);
        });
    }

    function clearRouteReplay() {
        if (replayLayer) {
            replayLayer.innerHTML = '';
        }
    }
});
