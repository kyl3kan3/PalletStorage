// Soft rounded icons, 24x24 viewBox, stroke=1.8, linejoin=round

const mk = (paths, extra) => ({ size = 16, color = 'currentColor', style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style}>
    {paths}
    {extra}
  </svg>
);

const Ic = {
  Home: mk(<><path d="M4 11l8-7 8 7v8a2 2 0 0 1-2 2h-3v-6h-6v6H6a2 2 0 0 1-2-2z"/></>),
  Chart: mk(<><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H3"/></>),
  Inbound: mk(<><path d="M12 3v10"/><path d="M7 10l5 5 5-5"/><rect x="3" y="17" width="18" height="4" rx="1.5"/></>),
  Outbound: mk(<><path d="M12 21V11"/><path d="M7 14l5-5 5 5"/><rect x="3" y="3" width="18" height="4" rx="1.5"/></>),
  Scan: mk(<><path d="M4 7V5a1 1 0 0 1 1-1h2"/><path d="M17 4h2a1 1 0 0 1 1 1v2"/><path d="M4 17v2a1 1 0 0 0 1 1h2"/><path d="M17 20h2a1 1 0 0 0 1-1v-2"/><path d="M4 12h16"/></>),
  Box: mk(<><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></>),
  Boxes: mk(<><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></>),
  Warehouse: mk(<><path d="M3 21V9l9-5 9 5v12"/><rect x="8" y="13" width="8" height="8" rx="1"/><path d="M8 17h8"/></>),
  Clipboard: mk(<><rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></>),
  Search: mk(<><circle cx="11" cy="11" r="6"/><path d="m20 20-3.5-3.5"/></>),
  Plus: mk(<><path d="M12 5v14M5 12h14"/></>),
  Bell: mk(<><path d="M6 8a6 6 0 0 1 12 0c0 6 2 8 2 8H4s2-2 2-8z"/><path d="M10 21a2 2 0 0 0 4 0"/></>),
  Settings: mk(<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.3.9a7 7 0 0 0-2-1.2L14 3h-4l-.6 2.5a7 7 0 0 0-2 1.2l-2.3-.9-2 3.5 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.5 2.3-.9a7 7 0 0 0 2 1.2L10 21h4l.6-2.5a7 7 0 0 0 2-1.2l2.3.9 2-3.5-2-1.5a7 7 0 0 0 .1-1.2z"/></>),
  Filter: mk(<><path d="M3 5h18l-7 9v5l-4 2v-7z"/></>),
  Download: mk(<><path d="M12 3v12"/><path d="M7 12l5 5 5-5"/><path d="M5 21h14"/></>),
  Arrow: mk(<><path d="M5 12h14M13 6l6 6-6 6"/></>),
  Clock: mk(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
  Check: mk(<><path d="M5 12l5 5 9-11"/></>),
  X: mk(<><path d="M6 6l12 12M18 6 6 18"/></>),
  Truck: mk(<><path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></>),
  Spark: mk(<><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></>),
  Heart: mk(<><path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/></>),
  Dot: mk(<><circle cx="12" cy="12" r="3"/></>),
  Sun: mk(<><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></>),
  Moon: mk(<><path d="M20 14A8 8 0 1 1 10 4a7 7 0 0 0 10 10z"/></>),
  Lightning: mk(<><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></>),
  Dollar: mk(<><path d="M12 2v20"/><path d="M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>),
  Pin: mk(<><path d="M12 22s7-7.5 7-13a7 7 0 0 0-14 0c0 5.5 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></>),
  User: mk(<><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.5 4-7 8-7s8 2.5 8 7"/></>),
  Package: mk(<><path d="m3 7 9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/></>),
  Zap: mk(<><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></>),
  Calendar: mk(<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></>),
  Eye: mk(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>),
};

Object.assign(window, { Ic });
