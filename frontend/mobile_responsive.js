(function() {
    document.addEventListener("DOMContentLoaded", () => {
        const toggle = document.getElementById("toggle-mobile-mode");
        if (!toggle) return;

        function applyMobileMode(enabled) {
            document.body.classList.toggle("layout-mobile", enabled);
            toggle.checked = enabled;
            localStorage.setItem("mobileResponsiveMode", enabled ? "true" : "false");
            
            // Trigger redraw on map and charts
            setTimeout(() => {
                window.dispatchEvent(new Event("resize"));
                if (typeof window.renderSubcontractorComplianceWidget === "function") {
                    window.renderSubcontractorComplianceWidget();
                }
            }, 100);
        }

        // Initialize from localStorage or screen size detection
        const storedVal = localStorage.getItem("mobileResponsiveMode");
        if (storedVal !== null) {
            applyMobileMode(storedVal === "true");
        } else {
            // Auto-detect based on screen width
            applyMobileMode(window.innerWidth <= 768);
        }

        toggle.addEventListener("change", () => {
            applyMobileMode(toggle.checked);
        });

        // Add auto-switch on resizing if not overridden
        window.addEventListener("resize", () => {
            if (localStorage.getItem("mobileResponsiveMode") === null) {
                if (window.innerWidth <= 768 && !document.body.classList.contains("layout-mobile")) {
                    applyMobileMode(true);
                } else if (window.innerWidth > 768 && document.body.classList.contains("layout-mobile")) {
                    applyMobileMode(false);
                }
            }
        });
    });
})();
