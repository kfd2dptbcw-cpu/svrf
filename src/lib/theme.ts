/**
 * Inline script that applies the saved (or system) theme before first paint,
 * avoiding a light/dark flash. Kept outside the client component module so the
 * server layout can import it as a plain string.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;
