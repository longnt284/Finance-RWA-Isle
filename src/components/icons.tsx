interface IconProps {
  className?: string;
}

const base = (className?: string) => ({
  className: className ?? "h-4 w-4",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
});

export const IconCrypto = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 2 3 7v10l9 5 9-5V7l-9-5z" />
    <path d="M12 22V12" />
    <path d="M3 7l9 5 9-5" />
  </svg>
);

export const IconStocks = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 17l5-6 4 3 6-8" />
    <path d="M14 6h4v4" />
    <path d="M3 21h18" />
  </svg>
);

export const IconVault = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="3" y="4" width="18" height="14" rx="1.5" />
    <circle cx="12" cy="11" r="3.5" />
    <path d="M12 9.5V11l1.2 1" />
    <path d="M6 21v-3M18 21v-3" />
  </svg>
);

export const IconAcademy = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2 9l10-5 10 5-10 5L2 9z" />
    <path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" />
    <path d="M22 9v5" />
  </svg>
);

export const IconLighthouse = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M9 21l1.2-11h3.6L15 21H9z" />
    <path d="M9.6 13h4.8" />
    <rect x="9.5" y="7" width="5" height="3" />
    <path d="M8.5 7h7l-1.5-3h-4L8.5 7z" />
    <path d="M4 8.5h3M17 8.5h3M5 5l2 1.5M19 5l-2 1.5" />
  </svg>
);

export const IconOverview = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <path d="M5 5l2.1 2.1M16.9 16.9 19 19M19 5l-2.1 2.1M7.1 16.9 5 19" />
  </svg>
);

export const IconPlus = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M4 12.5l5 5L20 6.5" />
  </svg>
);

export const IconClose = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconFlame = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M12 22c4.4 0 7-2.8 7-6.6 0-2.8-1.6-4.6-3-6.4-1.3-1.6-2.6-3.2-3-6-2.5 1.8-4 4.2-4 7 0 .8.1 1.5.3 2.2C8 11.6 7 10.5 6.6 9 5.4 10.5 5 12.6 5 14.4 5 19.2 7.6 22 12 22z" />
  </svg>
);

export const IconSound = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M11 5 6 9H3v6h3l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12" />
  </svg>
);

export const IconMute = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M11 5 6 9H3v6h3l5 4V5z" />
    <path d="M16 9l6 6M22 9l-6 6" />
  </svg>
);

export const IconTarget = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.2" />
  </svg>
);

export const IconBolt = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
  </svg>
);

export const IconChevron = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconReset = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);

export const IconMedal = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="M9 13.5 7 21l5-2.6L17 21l-2-7.5" />
    <path d="M12 6.5l.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2L9.1 8.6l2-.3.9-1.8z" fill="currentColor" stroke="none" />
  </svg>
);
