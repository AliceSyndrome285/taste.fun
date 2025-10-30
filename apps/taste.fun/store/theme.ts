"use client";

import { create } from 'zustand';

type Theme = 'dark' | 'light';

type ThemeState = {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
};

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'dark',
  toggle: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
  set: (t) => set({ theme: t }),
}));
