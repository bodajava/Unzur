export type Theme = "light" | "dark";
export const THEME_KEY = "unzur_theme";

/**
 * Runs in <head> before first paint and sets <html data-theme>, so there is
 * no flash of the wrong theme. The storefront is always light; only the
 * dashboard (/xx/admin) follows the saved choice, then the system setting.
 */
export const themeScript = `(function(){try{if(!/^\\/(en|ar)\\/admin(\\/|$)/.test(location.pathname)){document.documentElement.setAttribute("data-theme","light");return}var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){document.documentElement.setAttribute("data-theme","light")}})()`;
