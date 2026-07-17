document.addEventListener('DOMContentLoaded', () => {
    const textarea = document.getElementById('supervisor-notes-textarea');
    const btnSave = document.getElementById('btn-save-notes');
    const printNotes = document.getElementById('print-supervisor-notes');

    if (!textarea || !btnSave || !printNotes) return;

    const savedNotes = localStorage.getItem('supervisor_shift_notes') || '';
    textarea.value = savedNotes;
    printNotes.textContent = savedNotes || '(No shift hand-over notes entered)';

    textarea.addEventListener('input', () => {
        printNotes.textContent = textarea.value || '(No shift hand-over notes entered)';
    });

    btnSave.addEventListener('click', () => {
        const value = textarea.value.trim();
        localStorage.setItem('supervisor_shift_notes', value);
        printNotes.textContent = value || '(No shift hand-over notes entered)';
        
        if (window.showToast) {
            window.showToast('Supervisor shift notes saved locally!', 'success');
        }
    });
});
