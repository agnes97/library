import type { ThemeId } from './types';

const STORAGE_KEY = 'theme';
const SWAPPED_KEY = 'theme-swapped';
const CUSTOM_KEY = 'theme-custom';
const DEFAULT_THEME: ThemeId = 'pink-purple';
const DEFAULT_CUSTOM: [string, string] = ['#ff5fb7', '#3ff0e6'];

/** swatches for a theme picker; the real values live in app.css */
export const themes: { id: ThemeId; label: string; colors: [string, string] }[] = [
  { id: 'pink-purple', label: 'Pink & Purple', colors: ['#ff5fb7', '#b06bff'] },
  { id: 'blue', label: 'Blue', colors: ['#6cc4ff', '#4a6bff'] },
  { id: 'red-orange', label: 'Red & Orange', colors: ['#ec2222', '#ff8800'] },
  { id: 'green', label: 'Green', colors: ['#a0ffb8', '#1a9550'] },
  { id: 'cyan-orange', label: 'Cyan & Orange', colors: ['#3ff0e6', '#ff9a3c'] },
  { id: 'white', label: 'White', colors: ['#f4f2ff', '#f4f2ff'] },
];

function isThemeId(value: unknown): value is ThemeId {
  return value === 'custom' || themes.some((t) => t.id === value);
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

/** the themes whose lights are swapped; older saves only stored 'true' for the current theme */
function parseSwapped(stored: string | null, current: ThemeId): ThemeId[] {
  if (stored === 'true') return [current];
  try {
    const parsed: unknown = JSON.parse(stored ?? '');
    if (Array.isArray(parsed)) return parsed.filter(isThemeId);
  } catch {
    // missing or malformed; nothing is swapped
  }
  return [];
}

function parseCustom(stored: string | null): [string, string] {
  try {
    const parsed: unknown = JSON.parse(stored ?? '');
    if (Array.isArray(parsed) && parsed.length === 2 && parsed.every(isHexColor)) {
      return [parsed[0], parsed[1]];
    }
  } catch {
    // missing or malformed; fall through to the default
  }
  return [...DEFAULT_CUSTOM];
}

class Theme {
  current = $state<ThemeId>(DEFAULT_THEME);
  /** each theme remembers whether its two lights trade colours */
  swappedThemes = $state<ThemeId[]>([]);
  /** the two colours of the custom theme, light a then light b */
  custom = $state<[string, string]>([...DEFAULT_CUSTOM]);

  /** the two lights of the current theme trade colours */
  get swapped() {
    return this.swappedThemes.includes(this.current);
  }

  colorsOf(id: ThemeId): [string, string] | undefined {
    return id === 'custom' ? this.custom : themes.find((t) => t.id === id)?.colors;
  }

  init() {
    let stored: string | null = null;
    let storedSwapped: string | null = null;
    let storedCustom: string | null = null;

    try {
      stored = localStorage.getItem(STORAGE_KEY);
      storedSwapped = localStorage.getItem(SWAPPED_KEY);
      storedCustom = localStorage.getItem(CUSTOM_KEY);
    } catch {
      // storage blocked; keep the default
    }

    this.custom = parseCustom(storedCustom);
    this.current = isThemeId(stored) ? stored : DEFAULT_THEME;
    this.swappedThemes = parseSwapped(storedSwapped, this.current).filter((id) =>
      this.isTwoTone(id)
    );
    this.apply();
  }

  /** picking the current theme again swaps its two colours */
  set(id: ThemeId) {
    if (id === this.current) {
      if (!this.isTwoTone(id)) return;
      this.swappedThemes = this.swapped
        ? this.swappedThemes.filter((swapped) => swapped !== id)
        : [...this.swappedThemes, id];
    } else {
      this.current = id;
    }

    this.save();
    this.apply();
  }

  /** index 0 is light a, 1 is light b */
  setCustom(index: 0 | 1, color: string) {
    if (!isHexColor(color)) return;
    this.custom[index] = color;
    this.save();
    this.apply();
  }

  private isTwoTone(id: ThemeId) {
    const colors = this.colorsOf(id);
    return colors !== undefined && colors[0] !== colors[1];
  }

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, this.current);
      localStorage.setItem(SWAPPED_KEY, JSON.stringify(this.swappedThemes));
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(this.custom));
    } catch {
      // storage blocked; the theme still applies for this visit
    }
  }

  private apply() {
    const root = document.documentElement;
    root.dataset.theme = this.current;
    root.toggleAttribute('data-swapped', this.swapped);
    root.style.setProperty('--custom-a', this.custom[0]);
    root.style.setProperty('--custom-b', this.custom[1]);
  }
}

export const theme = new Theme();
