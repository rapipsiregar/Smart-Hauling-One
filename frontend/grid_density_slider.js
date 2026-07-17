document.addEventListener('DOMContentLoaded', () => {
    const slider = document.getElementById('slider-density');
    const label = document.getElementById('val-density');

    if (!slider || !label) return;

    const setDensity = (scale) => {
        document.documentElement.style.setProperty('--grid-density-scale', scale);
        label.textContent = `${scale.toFixed(1)}x`;
        slider.value = Math.round(scale * 100);
        localStorage.setItem('pref-grid-density-scale', scale);
    };

    slider.addEventListener('input', () => {
        const scale = parseFloat(slider.value) / 100;
        setDensity(scale);
    });

    const saved = localStorage.getItem('pref-grid-density-scale');
    if (saved !== null) {
        setDensity(parseFloat(saved));
    } else {
        setDensity(1.0);
    }
});
