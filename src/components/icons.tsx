interface P {
  className?: string;
}

const base = (className?: string) => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconBitcoin = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 7.5h3.4a2.1 2.1 0 0 1 0 4.2H9.5m0 0h4a2.2 2.2 0 0 1 0 4.4H9.5m0-8.6v8.6m0-8.6V6m0 10.1V18m1.6-12V6m0 12v1.5" />
  </svg>
);

export const IconChart = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 17l5-6 4 3 6-8" />
    <path d="M14 6h4v4" />
    <path d="M3 21h18" />
  </svg>
);

export const IconVault = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3" y="4" width="18" height="14" rx="2" />
    <circle cx="12" cy="11" r="3.5" />
    <path d="M12 9.2v1.8l1.4 1M7 21v-3m10 3v-3" />
  </svg>
);

export const IconBook = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z" />
    <path d="M4 19a2 2 0 0 1 2-2h13" />
    <path d="M9 7h6" />
  </svg>
);

export const IconHome = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v10h13V10" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export const IconClose = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconPlus = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCheck = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4.5 12.5l5 5L19.5 7" />
  </svg>
);

export const IconTarget = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </svg>
);

export const IconBolt = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M13 2L5 13.5h5.5L10 22l8-11.5h-5.5L13 2z" />
  </svg>
);

export const IconMedal = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="14.5" r="5" />
    <path d="M12 12.4l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3.9-1.8z" fill="currentColor" stroke="none" />
    <path d="M8.5 10.5L5.5 3h4L12 7.5 14.5 3h4l-3 7.5" />
  </svg>
);

export const IconReset = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 5v5h5" />
    <path d="M4.6 10A8 8 0 1 1 4 14" />
  </svg>
);

export const IconWallet = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 7a2 2 0 0 1 2-2h13v3" />
    <path d="M3 7v10a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-1z" />
    <circle cx="16.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

export const IconCalc = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M8.5 7h7" />
    <path d="M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 15.5h.01M12 15.5h.01M15.5 15.5v.01M8.5 15.5v3.5" strokeWidth="2.2" />
  </svg>
);

export const IconNote = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5 3h14v13l-5 5H5V3z" />
    <path d="M14 21v-5h5" />
    <path d="M8.5 8h7M8.5 12h4" />
  </svg>
);

export const IconHelp = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.2 9.2a2.8 2.8 0 1 1 3.9 2.9c-.9.4-1.1 1-1.1 1.9" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" />
  </svg>
);

export const IconGlobe = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.8 2.6 4 5.6 4 9s-1.2 6.4-4 9c-2.8-2.6-4-5.6-4-9s1.2-6.4 4-9z" />
  </svg>
);

export const IconCoins = ({ className }: P) => (
  <svg {...base(className)}>
    <ellipse cx="9" cy="7" rx="6" ry="3" />
    <path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
    <path d="M3 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    <path d="M21 10v6c0 1.2-1.3 2.2-3.2 2.7" />
    <path d="M15 9.4c3.4 0 6 1.3 6 2.9v4.2" />
  </svg>
);

export const IconGift = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="4" y="9" width="16" height="4" />
    <path d="M6 13v7h12v-7M12 9v11" />
    <path d="M12 9C9 9 6.5 7.8 6.5 5.8 6.5 4.3 7.7 3.5 9 3.5c2.2 0 3 3 3 5.5zm0 0c3 0 5.5-1.2 5.5-3.2 0-1.5-1.2-2.3-2.5-2.3-2.2 0-3 3-3 5.5z" />
  </svg>
);

export const IconTrendUp = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 16l6-6 4 3 8-8" />
    <path d="M15 5h6v6" />
  </svg>
);

export const IconTrendDown = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 8l6 6 4-3 8 8" />
    <path d="M15 19h6v-6" />
  </svg>
);

export const IconAnchor = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="5.5" r="2.5" />
    <path d="M12 8v12M5 13H3c0 5 4 8 9 8s9-3 9-8h-2" />
  </svg>
);

export const IconCompass = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
  </svg>
);

export const IconSearch = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </svg>
);

export const IconTrash = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 6.5h16M9.5 6V4h5v2M6.5 6.5l1 13h9l1-13" />
    <path d="M10 10.5v5.5M14 10.5v5.5" />
  </svg>
);

export const IconArrowR = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </svg>
);

export const IconLock = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    <circle cx="12" cy="15" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);

export const IconSpark = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3z" />
    <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconIsland = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M2.5 19c2.5 1.6 6 2.5 9.5 2.5s7-.9 9.5-2.5" />
    <path d="M12 12V7.5M12 7.5C12 5 10 4 8 4.5c1 1 1.5 2 4 3zm0 0c0-2.5 2-3.5 4-3-1 1-1.5 2-4 3zm0 0C9.5 7.5 8.5 9 9 11c1-.8 2-1.5 3-3.5zm0 0c2.5 0 3.5 1.5 3 3.5-1-.8-2-1.5-3-3.5z" />
    <path d="M6 19c1-3.5 3-7 6-7s5 3.5 6 7" />
  </svg>
);

export const IconSwap = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7 4L3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7" />
  </svg>
);

export const IconSound = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
  </svg>
);

export const IconSoundOff = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 9.5v5h3.5L12 19V5L7.5 9.5H4z" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </svg>
);

export const IconEye = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const IconChevD = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M6 9.5l6 6 6-6" />
  </svg>
);

/* ---------- khảo thí, nhiệm vụ, tài khoản, khí hậu ---------- */

export const IconScroll = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7 4h10a2 2 0 0 1 2 2v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2Z" />
    <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
  </svg>
);

export const IconBrain = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 5.5a2.5 2.5 0 0 0-4.7-1.2A2.6 2.6 0 0 0 4.6 7 2.6 2.6 0 0 0 4 11.4a2.6 2.6 0 0 0 1.2 3.9A2.5 2.5 0 0 0 9.5 19a2.5 2.5 0 0 0 2.5-1.6Z" />
    <path d="M12 5.5a2.5 2.5 0 0 1 4.7-1.2A2.6 2.6 0 0 1 19.4 7 2.6 2.6 0 0 1 20 11.4a2.6 2.6 0 0 1-1.2 3.9A2.5 2.5 0 0 1 14.5 19a2.5 2.5 0 0 1-2.5-1.6Z" />
    <path d="M12 5.5v11.9" />
  </svg>
);

export const IconCalendar = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 9.5h17M8 3.2v3.4M16 3.2v3.4" />
    <path d="M7.6 13.4h2M11 13.4h2M14.4 13.4h2M7.6 16.6h2M11 16.6h2" />
  </svg>
);

export const IconFlag = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M5.5 21V3.5" />
    <path d="M5.5 4.6h11.2l-1.8 3.6 1.8 3.6H5.5" />
  </svg>
);

export const IconUser = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="8.2" r="3.6" />
    <path d="M4.8 20a7.4 7.4 0 0 1 14.4 0" />
  </svg>
);

export const IconShield = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3.2 5 5.9v5.3c0 4.3 2.9 8.1 7 9.6 4.1-1.5 7-5.3 7-9.6V5.9Z" />
    <path d="m9.2 11.9 2 2 3.6-3.9" />
  </svg>
);

export const IconCloud = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7.2 18.5A4.2 4.2 0 0 1 7 10.1a5.2 5.2 0 0 1 9.9-1.3 3.9 3.9 0 0 1 .4 7.7Z" />
    <path d="M12 11.5v6M9.6 15.1 12 17.5l2.4-2.4" />
  </svg>
);

export const IconYacht = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 17.4h18l-2.2 3.2H5.2Z" />
    <path d="M5.4 17.4V12h11.2l2.2 5.4" />
    <path d="M8.4 12V8.6h5.4V12" />
    <path d="M11.1 8.6V4.4" />
  </svg>
);

export const IconSun = ({ className }: P) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.6v2.2M12 19.2v2.2M4.2 12H2M22 12h-2.2M6.5 6.5 4.9 4.9M19.1 19.1l-1.6-1.6M17.5 6.5l1.6-1.6M4.9 19.1l1.6-1.6" />
  </svg>
);

export const IconMoon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M20.2 14.2A8.4 8.4 0 0 1 9.8 3.8a8.4 8.4 0 1 0 10.4 10.4Z" />
  </svg>
);

export const IconDroplet = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3.2c3 3.6 5.6 6.6 5.6 9.5A5.6 5.6 0 0 1 6.4 12.7c0-2.9 2.6-5.9 5.6-9.5Z" />
  </svg>
);

export const IconSliders = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 7.5h9M17.5 7.5H20M4 16.5h3.5M12 16.5h8" />
    <circle cx="15" cy="7.5" r="2.2" />
    <circle cx="9.5" cy="16.5" r="2.2" />
  </svg>
);

export const IconNews = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 5.5h13v13H5.6A1.6 1.6 0 0 1 4 16.9V5.5Z" />
    <path d="M17 8.5h2.4a1.6 1.6 0 0 1 1.6 1.6v6.8a1.6 1.6 0 0 1-3.2 0" />
    <path d="M7 8.8h6M7 12h6M7 15.2h4" />
  </svg>
);

export const IconFish = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3.2 12c2.6-3.6 5.7-5.4 9.3-5.4 3 0 5.6 1.8 7.7 5.4-2.1 3.6-4.7 5.4-7.7 5.4-3.6 0-6.7-1.8-9.3-5.4Z" />
    <path d="M3.2 12 6.4 9v6L3.2 12Z" />
    <circle cx="15.4" cy="10.9" r="0.9" />
  </svg>
);

export const IconStore = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 9.6h16v8.6a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.2V9.6Z" />
    <path d="M3.2 9.6 5 4.6h14l1.8 5" />
    <path d="M9.4 19.6v-5h5.2v5" />
  </svg>
);

export const IconCoinPurse = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7.6 8.2 9 4.4h6l1.4 3.8" />
    <path d="M4.6 12.4a7.6 7.6 0 0 1 7.4-4.2 7.6 7.6 0 0 1 7.4 4.2c.8 3.4-2.4 7.2-7.4 7.2s-8.2-3.8-7.4-7.2Z" />
    <path d="M12 11v5m-1.7-3.8h2.6a1.3 1.3 0 0 1 0 2.6h-1.8a1.3 1.3 0 0 0 0 2.6h2.6" />
  </svg>
);

export const IconCamera = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-1.8A1 1 0 0 1 9.2 3.7h5.6a1 1 0 0 1 .9.5L16.8 6h1.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
    <circle cx="12" cy="12.4" r="3.4" />
  </svg>
);

export const IconEyeOff = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 6.3A9.3 9.3 0 0 1 12 6.2c5 0 9 5.8 9 5.8a17 17 0 0 1-2.9 3.4M6.5 7.9A16.6 16.6 0 0 0 3 12s4 5.8 9 5.8a8.7 8.7 0 0 0 3.6-.8" />
    <path d="M9.9 10a3 3 0 0 0 4.2 4.2" />
  </svg>
);

/* Chuỗi nhiệm vụ tuần — hai mắt xích móc vào nhau. */
export const IconChain = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M9.5 14.5a3.5 3.5 0 0 1 0-5l2-2a3.5 3.5 0 0 1 5 5l-1 1" />
    <path d="M14.5 9.5a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 0 1-5-5l1-1" />
  </svg>
);

/* Phong vũ biểu thị trường — kim đồng hồ đo áp suất. */
export const IconBarometer = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 16a8 8 0 0 1 16 0" />
    <path d="M12 16l4.2-4.6" />
    <circle cx="12" cy="16" r="1.2" />
    <path d="M4 19h16" />
  </svg>
);

/* Mồi câu — con giun trên lưỡi câu. */
export const IconBait = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M12 3v8" />
    <path d="M12 11a3.4 3.4 0 0 1-6.6 1.2c0-2.4 2.6-3.4 4.6-1.8" />
    <path d="M15 5.5h-3" />
    <path d="M16.5 15.5c1.6 1.2 1.6 3.4 0 4.6-1.7 1.2-4.2.4-4.2-1.6 0-2.2 2.6-2.6 4.2-3z" />
  </svg>
);

/* Giải câu cá trong ngày — chiếc cúp. */
export const IconTrophy = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
    <path d="M8 6H5.5a2.5 2.5 0 0 0 2.5 4.5" />
    <path d="M16 6h2.5a2.5 2.5 0 0 1-2.5 4.5" />
    <path d="M12 13v4" />
    <path d="M9 20h6" />
    <path d="M10 17h4l.6 3h-5.2z" />
  </svg>
);
