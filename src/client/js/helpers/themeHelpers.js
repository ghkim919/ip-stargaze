export function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ip-stargaze-theme', theme);
}

export function initThemeToggle(onThemeChange) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = getCurrentTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.classList.add('theme-transitioning');
    applyTheme(next);
    if (onThemeChange) onThemeChange(next);
    setTimeout(() => document.body.classList.remove('theme-transitioning'), 300);
  });
}
