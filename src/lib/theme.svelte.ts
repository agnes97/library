import type { ThemeId } from './types';

const STORAGE_KEY = 'theme';
const SWAPPED_KEY = 'theme-swapped';
const DEFAULT_THEME: ThemeId = 'pink-purple';

/** swatches for a theme picker; the real values live in app.css */
export const themes: { id: ThemeId; label: string; colors: [string, string] }[] = [
  { id: 'pink-purple', label: 'Pink & Purple', colors: ['#ff5fb7', '#b06bff'] },
  { id: 'blue', label: 'Blue', colors: ['#6cc4ff', '#4a6bff'] },
  { id: 'green', label: 'Green', colors: ['#a0ffb8', '#1a9550'] },
  { id: 'cyan-orange', label: 'Cyan & Orange', colors: ['#3ff0e6', '#ff9a3c'] },
  { id: 'white', label: 'White', colors: ['#f4f2ff', '#f4f2ff'] },
];

function isThemeId(value: unknown): value is ThemeId {
  return themes.some((t) => t.id === value);
}

function isTwoTone(id: ThemeId) {
  const colors = themes.find((t) => t.id === id)?.colors;
  return colors !== undefined && colors[0] !== colors[1];
}

class Theme {
  current = $state<ThemeId>(DEFAULT_THEME);
  /** the two lights trade colours */
  swapped = $state(false);

  init() {
    let stored: string | null = null;
    let storedSwapped: string | null = null;

    try {
      stored = localStorage.getItem(STORAGE_KEY);
      storedSwapped = localStorage.getItem(SWAPPED_KEY);
    } catch {
      // storage blocked; keep the default
    }

    this.current = isThemeId(stored) ? stored : DEFAULT_THEME;
    this.swapped = storedSwapped === 'true' && isTwoTone(this.current);
    this.apply();
  }

  /** picking the current theme again swaps its two colours */
  set(id: ThemeId) {
    if (id === this.current) {
      if (!isTwoTone(id)) return;
      this.swapped = !this.swapped;
    } else {
      this.current = id;
      this.swapped = false;
    }

    try {
      localStorage.setItem(STORAGE_KEY, this.current);
      localStorage.setItem(SWAPPED_KEY, String(this.swapped));
    } catch {
      // storage blocked; the theme still applies for this visit
    }

    this.apply();
  }

  private apply() {
    const root = document.documentElement;
    root.dataset.theme = this.current;
    root.toggleAttribute('data-swapped', this.swapped);
  }
}

export const theme = new Theme();
