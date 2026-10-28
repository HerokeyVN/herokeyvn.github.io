export type Project = {
  index: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  technologies: string[];
  href: string;
  linkLabel: string;
  sourceNote?: string;
  visual: "protocol" | "product" | "piano";
};

export const profile = {
  name: "HerokeyVN",
  title: "Backend Developer | Node.js & TypeScript",
  description:
    "Building backend systems, exploring software architecture, and developing practical applications.",
  location: "Ho Chi Minh City, Vietnam",
  email: "herokey2018@gmail.com",
  github: "https://github.com/HerokeyVN",
} as const;

export const experience = {
  company: "FIDT",
  role: "Backend Developer",
  duration: "August 2025 — August 2026",
  progression: [
    "Backend Developer Intern · Aug 2025 — Jan 2026",
    "Fresher Backend Developer · Feb 2026 — Aug 2026",
  ],
  responsibilities: [
    "Maintained and developed identity management services.",
    "Migrated user information retrieval from Directus to Ory Kratos.",
    "Developed Admin APIs across multiple functional domains.",
    "Contributed to frontend components and UI improvements across projects.",
  ],
} as const;

export const projects: Project[] = [
  {
    index: "01",
    slug: "fb-messenger-e2ee",
    name: "FB-Messenger-E2EE",
    category: "End-to-End Encrypted Messaging Toolkit",
    description:
      "A TypeScript toolkit for Facebook Messenger's end-to-end encrypted messaging. It implements Signal Protocol and Noise transport for device registration, cryptographic key management, encrypted messaging, and media handling.",
    technologies: [
      "TypeScript",
      "Node.js / Bun",
      "Signal Protocol",
      "Noise Protocol",
      "WebSocket",
      "Protobuf",
    ],
    href: "https://github.com/HerokeyVN/FB-Messenger-E2EE",
    linkLabel: "View repository",
    visual: "protocol",
  },
  {
    index: "02",
    slug: "sky-sheet-store",
    name: "Sky Sheet Store",
    category: "Music Sheet Sharing Platform",
    description:
      "A web platform for discovering, sharing, and practicing music sheets for Sky: Children of the Light. Its service-oriented architecture incorporates sheet hashing, music fingerprinting, and encryption mechanisms for content verification and protection.",
    technologies: ["Go", "Vue / Nuxt", "Directus", "PostgreSQL"],
    href: "https://skysheet.store/",
    linkLabel: "Visit live website",
    sourceNote: "Source code is private",
    visual: "product",
  },
  {
    index: "03",
    slug: "sky-auto-piano",
    name: "Sky Auto Piano",
    category: "Desktop Music Automation Application",
    description:
      "An open-source Windows desktop application that automates music sheet playback for Sky: Children of the Light. It supports multiple sheet formats, adjustable speed, sustained notes, and global keyboard shortcuts through an MVVM-based interface.",
    technologies: ["Electron", "Node.js", "JavaScript"],
    href: "https://github.com/HerokeyVN/Sky-Auto-Piano",
    linkLabel: "View repository",
    visual: "piano",
  },
];

export const skills = [
  { label: "Languages", items: ["TypeScript", "JavaScript"] },
  {
    label: "Backend & Identity",
    items: ["Node.js", "REST APIs", "Ory Kratos", "Directus"],
  },
  { label: "Frontend", items: ["Vue.js", "Nuxt.js", "HTML", "CSS"] },
  { label: "Database", items: ["PostgreSQL"] },
  {
    label: "Additional Technologies",
    items: ["Git", "Electron", "WebSocket", "Signal Protocol"],
  },
] as const;
