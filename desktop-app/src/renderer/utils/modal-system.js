// CyberForge Modal System
// Provides modal dialogs across all screens

(() => {
  function showModal(title, content, onSubmit, submitText = 'Save') {
    // Remove existing modal
    document.querySelector('.modal-overlay')?.remove();
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">
          <button class="cf-btn modal-cancel">Cancel</button>
          <button class="cf-btn primary modal-submit">${submitText}</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Animate in
    requestAnimationFrame(() => overlay.classList.add('active'));
    
    const closeModal = () => {
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 200);
    };
    
    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.querySelector('.modal-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    
    overlay.querySelector('.modal-submit').addEventListener('click', async () => {
      const form = overlay.querySelector('.modal-body');
      const formData = {};
      form.querySelectorAll('input, select, textarea').forEach(el => {
        if (el.type === 'checkbox') {
          formData[el.name] = el.checked;
        } else {
          formData[el.name] = el.value;
        }
      });
      
      const submitBtn = overlay.querySelector('.modal-submit');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="loading-spinner"></span>';
      
      try {
        await onSubmit(formData);
        closeModal();
      } catch (error) {
        window.CyberForgeToast.showToast('error', 'Error', error.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = submitText;
      }
    });
    
    return overlay;
  }

  function showConfirmModal(title, message, onConfirm) {
    return showModal(title, `<p>${message}</p>`, onConfirm, 'Confirm');
  }

  // Expose globally
  window.CyberForgeModal = { showModal, showConfirmModal };
})();
