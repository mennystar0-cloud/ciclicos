export type FontSize = 'sm' | 'md' | 'lg' | 'xl';

export const applyTheme = (dark: boolean, font: FontSize) => {
    dark ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
    document.documentElement.setAttribute('data-font', font);
};

export const loadUIPrefs = (): { dark: boolean; font: FontSize } => {
    try { const r = localStorage.getItem('conteo:ui'); if (r) return JSON.parse(r); } catch {}
    return { dark: false, font: 'md' };
};

export const saveUIPrefs = (dark: boolean, font: FontSize) => {
    localStorage.setItem('conteo:ui', JSON.stringify({ dark, font }));
    applyTheme(dark, font);
};
