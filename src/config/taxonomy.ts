export interface CourseOption {
  id: string;
  dbValue: string;
  label: string;
  emoji: string;
}

export interface LocationOption {
  id: string;
  label: string;
  description: string;
  emoji: string;
  dbValues: Array<"nigeria" | "africa_remote" | "overseas_remote" | "overseas_relocate">;
}

export interface StipendOption {
  id: string;
  label: string;
  description: string;
  emoji: string;
  prioritizeStipend: boolean;
  strictOnly: boolean;
}

export const COURSES: Record<string, CourseOption> = {
  cs: {
    id: "cs",
    dbValue: "computer_science",
    label: "Computer Science / Software Eng",
    emoji: "💻",
  },
  eee: {
    id: "eee",
    dbValue: "electrical_engineering",
    label: "Electrical / Computer Eng",
    emoji: "⚡",
  },
  design: {
    id: "design",
    dbValue: "product_design",
    label: "Product Design (UI/UX)",
    emoji: "🎨",
  },
  ds: {
    id: "ds",
    dbValue: "data_science",
    label: "Data Science & AI",
    emoji: "📊",
  },
  other: {
    id: "other",
    dbValue: "other",
    label: "Other (Type custom course)",
    emoji: "✏️",
  },
};

export const LOCATIONS: Record<string, LocationOption> = {
  ng: {
    id: "ng",
    label: "Nigeria Only",
    description: "Onsite, Hybrid & Local Remote",
    emoji: "🇳🇬",
    dbValues: ["nigeria"],
  },
  remote: {
    id: "remote",
    label: "Overseas / Remote Only",
    description: "Africa Remote & Global Remote",
    emoji: "🌍",
    dbValues: ["africa_remote", "overseas_remote"],
  },
  both: {
    id: "both",
    label: "Both (Nigeria & Overseas)",
    description: "All verified local and global roles",
    emoji: "🌐",
    dbValues: ["nigeria", "africa_remote", "overseas_remote", "overseas_relocate"],
  },
};

export const STIPENDS: Record<string, StipendOption> = {
  strict: {
    id: "strict",
    label: "Strict (Paid Only)",
    description: "Only send roles with a confirmed stipend",
    emoji: "💰",
    prioritizeStipend: true,
    strictOnly: true,
  },
  preferred: {
    id: "preferred",
    label: "Preferred (Prioritize Paid)",
    description: "Rank paid roles first, include high-value unpaid",
    emoji: "⭐",
    prioritizeStipend: true,
    strictOnly: false,
  },
};
