// Lucide-flavoured inline SVG icons used throughout the kit.
// Stroke 1.5, square viewbox 24x24, currentColor.

const Ico = ({ d, children, ...p }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
       strokeLinecap="round" strokeLinejoin="round" width="16" height="16" {...p}>
    {d ? <path d={d}/> : children}
  </svg>
);

window.Icons = {
  Bot:        (p) => <Ico {...p}><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 4h6"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 17h6"/></Ico>,
  Scan:       (p) => <Ico {...p}><path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2M3 12h18"/></Ico>,
  Layout:     (p) => <Ico {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></Ico>,
  Bank:       (p) => <Ico {...p}><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21V12h6v9M5 10h14"/></Ico>,
  Receipt:    (p) => <Ico {...p}><path d="M5 3h14v18l-3-2-3 2-3-2-3 2-2-2V3zM9 8h6M9 12h6M9 16h4"/></Ico>,
  Pie:        (p) => <Ico {...p}><path d="M21 12a9 9 0 11-9-9v9h9z"/><path d="M21 12a9 9 0 00-9-9"/></Ico>,
  Calendar:   (p) => <Ico {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></Ico>,
  Wallet:     (p) => <Ico {...p}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/></Ico>,
  Target:     (p) => <Ico {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></Ico>,
  Trend:      (p) => <Ico {...p}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></Ico>,
  Upload:     (p) => <Ico {...p}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 9l5-5 5 5M12 4v12"/></Ico>,
  Lightbulb:  (p) => <Ico {...p}><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12c1 1 2 2 2 3h4c0-1 1-2 2-3a7 7 0 00-4-12z"/></Ico>,
  Trophy:     (p) => <Ico {...p}><path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 01-10 0V4zM4 4h3v4a3 3 0 01-3-3V4zM17 4h3v1a3 3 0 01-3 3V4z"/></Ico>,
  Settings:   (p) => <Ico {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 01-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1A1.7 1.7 0 004.6 9a1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 012.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 012.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/></Ico>,
  Star:       (p) => <Ico {...p}><path d="M12 2l3 7 7 .8-5.2 4.8 1.6 7L12 18l-6.4 3.6 1.6-7L2 9.8 9 9z"/></Ico>,
  Plus:       (p) => <Ico {...p}><path d="M12 5v14M5 12h14"/></Ico>,
  Arrow:      (p) => <Ico {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Ico>,
  ArrowDown:  (p) => <Ico {...p}><path d="M7 17l10-10M17 7v10H7"/></Ico>,
  ArrowUp:    (p) => <Ico {...p}><path d="M7 17L17 7M17 17V7H7"/></Ico>,
  Activity:   (p) => <Ico {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Ico>,
  Card:       (p) => <Ico {...p}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/></Ico>,
  Flame:      (p) => <Ico {...p}><path d="M8 14a4 4 0 008 0c0-3-3-3-3-7 0 0-2 1-2 4 0 1 .5 2 1 2 0 0-1 .5-2.5.5S8 12 8 14z"/></Ico>,
  Check:      (p) => <Ico {...p}><path d="M5 13l4 4L19 7"/></Ico>,
  X:          (p) => <Ico {...p}><path d="M18 6L6 18M6 6l12 12"/></Ico>,
  Search:     (p) => <Ico {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></Ico>,
  Filter:     (p) => <Ico {...p}><path d="M3 5h18l-7 9v6l-4-2v-4z"/></Ico>,
  Edit:       (p) => <Ico {...p}><path d="M12 20h9M16.5 3.5a2 2 0 113 3L7 19l-4 1 1-4z"/></Ico>,
  Sparkles:   (p) => <Ico {...p}><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM18 16l.7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7z"/></Ico>,
};
