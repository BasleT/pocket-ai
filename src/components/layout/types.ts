import type { LucideIcon } from 'lucide-react';

export const PANEL_ORDER = ['chat', 'summarize', 'youtube', 'pdf', 'ocr', 'settings'] as const;

export type ActivePanel = (typeof PANEL_ORDER)[number];

export type RailItem = {
  id: ActivePanel;
  icon: LucideIcon;
  label: string;
};
