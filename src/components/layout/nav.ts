import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  MessageSquareText,
  Mic,
  UsersRound,
  Library,
  Layers,
  LineChart,
  UserCog,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  children?: { label: string; href: string }[];
  /** Phase in which this section becomes functional (for "coming soon" state). */
  available: boolean;
}

/** Global navigation (§12). Desktop-first; English UI (§10). */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, available: true },
  {
    label: "Practice",
    href: "/practice",
    icon: MessageSquareText,
    available: true,
    children: [
      { label: "Vietnamese", href: "/practice/vietnamese" },
      { label: "English", href: "/practice/english" },
    ],
  },
  {
    label: "Interview",
    href: "/interview",
    icon: UsersRound,
    available: false,
    children: [
      { label: "Individual", href: "/interview/individual" },
      { label: "Full Simulation", href: "/interview/simulation" },
    ],
  },
  { label: "Question Bank", href: "/questions", icon: Library, available: false },
  { label: "Flashcards", href: "/flashcards", icon: Layers, available: false },
  { label: "Progress", href: "/progress", icon: LineChart, available: false },
  { label: "Profile", href: "/profile", icon: UserCog, available: false },
];

export { Mic };
