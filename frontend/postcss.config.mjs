// Tailwind runs through PostCSS so both bundlers (Turbopack in dev, webpack on
// the Hostinger build server) process the CSS the same way.
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
