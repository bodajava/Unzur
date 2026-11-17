export type Theme = "light" | "dark";
export const THEME_KEY = "unzur_theme";

/**
 * Runs in <head> before first paint: a saved choice wins, otherwise the
 * system setting. Sets <html data-theme> so there is no flash of the wrong theme.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;
