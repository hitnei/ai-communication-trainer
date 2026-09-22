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
  Brain,
  History,
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
    available: true,
    children: [
      { label: "Individual", href: "/interview/individual" },
      { label: "Full Simulation", href: "/interview/simulation" },
    ],
  },
  { label: "Question Bank", href: "/questions", icon: Library, available: true },
  { label: "Flashcards", href: "/flashcards", icon: Layers, available: true },
  { label: "Memory", href: "/memory", icon: Brain, available: true },
  { label: "Progress", href: "/progress", icon: LineChart, available: true },
  { label: "History", href: "/history", icon: History, available: true },
  { label: "Profile", href: "/profile", icon: UserCog, available: true },
];

export { Mic };
