(() => {
  const STORAGE_KEY = 'cyberforge-theme';
  const VALID_THEMES = new Set(['light', 'dark']);

  function getSavedTheme() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return VALID_THEMES.has(saved) ? saved : null;
  }

  function getTheme() {
    return document.documentElement.getAttribute('data-theme') || getSavedTheme() || 'light';
  }

  function setTheme(theme, persist = true) {
    const normalized = VALID_THEMES.has(theme) ? theme : 'light';
    document.documentElement.setAttribute('data-theme', normalized);
    if (persist) {
      localStorage.setItem(STORAGE_KEY, normalized);
    }
    document.dispatchEvent(new CustomEvent('cyberforge:theme-changed', { detail: { theme: normalized } }));
    return normalized;
  }

  function initTheme(defaultTheme = 'light') {
    const initial = getSavedTheme() || defaultTheme;
    return setTheme(initial, false);
  }

  function toggleTheme() {
    const current = getTheme();
    return setTheme(current === 'dark' ? 'light' : 'dark', true);
  }

  window.CyberForgeTheme = {
    storageKey: STORAGE_KEY,
    initTheme,
    getTheme,
    setTheme,
    toggleTheme,
    isDark: () => getTheme() === 'dark'
  };
})();