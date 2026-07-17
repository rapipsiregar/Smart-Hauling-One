(function() {
    document.addEventListener("DOMContentLoaded", () => {
        // Create modal container
        const modal = document.createElement("div");
        modal.id = "tutorial-modal";
        modal.className = "modal hidden";
        
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content" style="width: 480px; max-width: 95%;">
                <div class="modal-header">
                    <h3 style="color: var(--primary); display: flex; align-items: center; gap: 0.5rem; margin: 0;">
                        <span>📖</span> Operator Guide & Tutorial
                    </h3>
                    <button class="btn-close" id="btn-close-tutorial">&times;</button>
                </div>
                <div class="modal-body" style="min-height: 250px; justify-content: flex-start;">
                    <div id="tutorial-slide-container"></div>
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; border-top: 1px solid var(--border); padding-top: 1rem;">
                        <div style="display: flex; gap: 6px;" id="tutorial-dots"></div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary btn-sm" id="btn-tutorial-prev">Back</button>
                            <button class="btn btn-primary btn-sm" id="btn-tutorial-next">Next</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const slides = [
            {
                title: "📡 Deployed Site Map & Signal Bars",
                description: "Monitor real-time connection strength for all edge cameras. Next to each skid tower pin on the map, look at the UHF and LTE signal indicator bars. They color-code dynamically from green (excellent) to red (poor) based on telemetry SNR dB metrics."
            },
            {
                title: "🚚 Subcontractor Compliance Cards",
                description: "View overall hauling performance at a glance. Subcontractor KPI cards show target vs actual completed shift ritase and hourly capacity rates. Individual and master header status lights dynamically blink red or orange if compliance levels drop below thresholds."
            },
            {
                title: "🔍 Smart Search & Visual Audits",
                description: "Perform quick crossing verifications. Click any crossing card in the live feed to display cropped hull plates next to wide-angle checkpoint proof frames. Click the Search bar to reuse search history dropdown terms instantly."
            }
        ];
        
        let currentSlide = 0;
        
        function renderSlide(idx) {
            currentSlide = idx;
            const container = document.getElementById("tutorial-slide-container");
            const slide = slides[idx];
            
            container.innerHTML = `
                <h4 style="color: var(--text-primary); font-size: 1.05rem; margin-bottom: 0.5rem;">${slide.title}</h4>
                <p style="color: var(--text-secondary); font-size: 0.88rem; line-height: 1.6; margin: 0;">${slide.description}</p>
            `;
            
            // Render progress dots
            const dots = document.getElementById("tutorial-dots");
            dots.innerHTML = slides.map((_, i) => `
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${i === idx ? "var(--primary)" : "var(--border)"}; display: inline-block; transition: background 0.2s;"></span>
            `).join("");
            
            // Adjust buttons
            const btnPrev = document.getElementById("btn-tutorial-prev");
            const btnNext = document.getElementById("btn-tutorial-next");
            
            btnPrev.style.visibility = idx === 0 ? "hidden" : "visible";
            btnNext.textContent = idx === slides.length - 1 ? "Start Exploring" : "Next";
        }
        
        function openTutorial() {
            modal.classList.remove("hidden");
            renderSlide(0);
        }
        
        function closeTutorial() {
            modal.classList.add("hidden");
            localStorage.setItem("smartgate_tutorial_completed", "true");
        }
        
        // Setup click listeners
        document.getElementById("btn-close-tutorial").onclick = closeTutorial;
        modal.querySelector(".modal-overlay").onclick = closeTutorial;
        
        document.getElementById("btn-tutorial-prev").onclick = () => {
            if (currentSlide > 0) renderSlide(currentSlide - 1);
        };
        
        document.getElementById("btn-tutorial-next").onclick = () => {
            if (currentSlide < slides.length - 1) {
                renderSlide(currentSlide + 1);
            } else {
                closeTutorial();
            }
        };
        
        // Manual override button listener
        const btnManual = document.getElementById("btn-show-tutorial");
        if (btnManual) btnManual.onclick = openTutorial;
        
        // Automatic trigger on first login
        const completed = localStorage.getItem("smartgate_tutorial_completed");
        if (completed !== "true") {
            setTimeout(openTutorial, 1500); // Small delay for visual aesthetic
        }
    });
})();
