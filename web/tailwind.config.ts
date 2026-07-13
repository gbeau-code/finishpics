import type { Config } from 'tailwindcss'

// ---------------------------------------------------------------------------
// FinishPics v2 design tokens
// Source of truth: design/handoff/README.md ("Design Tokens" section).
// Navy + gold + electric-blue athletic palette (NOT the purple _ds tokens).
// ---------------------------------------------------------------------------

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary surfaces
        'fp-navy':        '#0A1B3D',   // headers / banners / hero
        'fp-navy-mid':    '#0c2350',   // gradient midpoint
        'fp-navy-deep':   '#0d2147',   // deep card variant
        // Accents
        'fp-gold':        '#FDB927',   // highlight / primary CTA (text on gold: fp-ink-strong)
        'fp-blue':        '#0E63E6',   // electric blue — links / selected states
        'fp-blue-tint':   '#EAF1FE',   // selected-chip fill
        // Text
        'fp-ink':         '#2c2c2c',   // body
        'fp-ink-strong':  '#151515',
        'fp-muted':       '#5b6270',
        'fp-faint':       '#9aa1ab',
        // Chrome
        'fp-border':      '#E4E8EF',
        'fp-stage':       '#EDF0F5',   // light stage background (mobile)
      },
      backgroundImage: {
        'fp-hero': 'linear-gradient(135deg, #0A1B3D 0%, #0c2350 60%, #0A1B3D 100%)',
      },
      boxShadow: {
        'fp-xs':        '0 1px 2px rgba(21,21,21,0.06)',
        'fp-sm':        '0 2px 6px rgba(21,21,21,0.08)',
        'fp-md':        '0 8px 20px rgba(21,21,21,0.10)',
        'fp-lg':        '0 18px 40px rgba(21,21,21,0.14)',
        'fp-gold':      '0 14px 34px rgba(253,185,39,0.35)',
        'fp-gold-hover':'0 14px 34px rgba(253,185,39,0.45)',
        'fp-blue-glow': '0 4px 12px rgba(14,99,230,0.45)',
      },
      borderRadius: {
        'fp-cta':  '13px',   // primary CTA
        'fp-card': '18px',   // cards
        'fp-tile': '9px',    // icon-logo tile
      },
      transitionTimingFunction: {
        'fp-out': 'cubic-bezier(0.16, 0.84, 0.44, 1)',
        'fp-in':  'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      transitionDuration: {
        'fp-fast': '120ms',
        'fp-base': '200ms',
        'fp-slow': '360ms',
      },
      fontFamily: {
        // Body uses condensed width (font-stretch handled in globals.css)
        sans: ['Roboto', 'Roboto Condensed', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
