document.addEventListener('DOMContentLoaded', () => {
    const checkbox = document.getElementById('verify-handover-checkbox');
    const inputGroup = document.getElementById('signature-input-group');
    const tokenBox = document.getElementById('cryptographic-token-box');
    const tokenValue = document.getElementById('cryptographic-token-value');
    const inputSignature = document.getElementById('operator-signature-input');
    const btnSign = document.getElementById('btn-sign-report');

    if (!checkbox || !inputGroup || !tokenBox || !tokenValue || !inputSignature || !btnSign) return;

    // Load saved signature state
    const savedSignature = localStorage.getItem('shift_report_signature');
    const savedToken = localStorage.getItem('shift_report_token');
    const savedChecked = localStorage.getItem('shift_report_verified') === 'true';

    if (savedChecked) {
        checkbox.checked = true;
        if (savedSignature) {
            inputSignature.value = savedSignature;
            inputGroup.classList.add('hidden');
            tokenBox.classList.remove('hidden');
            tokenValue.textContent = savedToken || 'N/A';
        } else {
            inputGroup.classList.remove('hidden');
        }
    }

    checkbox.onchange = () => {
        if (checkbox.checked) {
            inputGroup.classList.remove('hidden');
            localStorage.setItem('shift_report_verified', 'true');
        } else {
            inputGroup.classList.add('hidden');
            tokenBox.classList.add('hidden');
            inputSignature.value = '';
            localStorage.removeItem('shift_report_signature');
            localStorage.removeItem('shift_report_token');
            localStorage.setItem('shift_report_verified', 'false');
            if (window.showToast) window.showToast('Signature verification cleared.', 'info');
        }
    };

    btnSign.onclick = async () => {
        const name = inputSignature.value.trim();
        if (!name) {
            if (window.showToast) window.showToast('Please enter operator credentials before signing.', 'warning');
            return;
        }

        btnSign.disabled = true;
        btnSign.textContent = 'Generating...';

        try {
            const totalRitase = document.getElementById('donut-total-val')?.textContent || '0';
            const timestamp = new Date().toISOString();
            const message = `SmartGate-ShiftReport|Ritase:${totalRitase}|Operator:${name}|Time:${timestamp}`;
            
            // Web Crypto API SHA-256
            const encoder = new TextEncoder();
            const data = encoder.encode(message);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

            tokenValue.textContent = `SIG-SHA256-${hashHex.substring(0, 32).toUpperCase()}`;
            tokenBox.classList.remove('hidden');
            inputGroup.classList.add('hidden');

            localStorage.setItem('shift_report_signature', name);
            localStorage.setItem('shift_report_token', tokenValue.textContent);

            if (window.showToast) window.showToast('Shift report digitally signed & verified!', 'success');
        } catch (err) {
            if (window.showToast) window.showToast(`Signing failed: ${err.message}`, 'danger');
        } finally {
            btnSign.disabled = false;
            btnSign.textContent = '🖋 Sign';
        }
    };
});
