// Theme choice (Auto / Light / Dark): a per-browser preference, kept in localStorage under "theme".
// It is not part of the Board and is never shared between the two people. Everything environment-specific
// (root element, storage, buttons) is injected, so this is unit-testable with fakes. Storage may be
// unavailable or throw (private mode, blocked site data): every read and write is wrapped, and the page
// works without it.
import { esc } from './html';

export type ThemeChoice = 'auto' | 'light' | 'dark';
export const THEME_KEY = 'theme';
const CHOICES: ThemeChoice[] = ['auto', 'light', 'dark'];
const LABEL: Record<ThemeChoice, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' };

export interface ThemeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface ThemeRoot {
  dataset: Record<string, string | undefined>;
}
export interface ThemeButton {
  dataset: Record<string, string | undefined>;
  setAttribute(name: string, value: string): void;
}

/** Anything that is not one of the three choices means Auto. */
export function parseTheme(v: unknown): ThemeChoice {
  return v === 'light' || v === 'dark' || v === 'auto' ? v : 'auto';
}

export function initialTheme(storage: ThemeStorage | null | undefined): ThemeChoice {
  try {
    return parseTheme(storage ? storage.getItem(THEME_KEY) : null);
  } catch {
    return 'auto';
  }
}

export function saveTheme(storage: ThemeStorage | null | undefined, choice: ThemeChoice): void {
  try {
    storage?.setItem(THEME_KEY, choice);
  } catch {
    /* storage unavailable: the choice just won't survive a reload */
  }
}

/**
 * Inline <head> script (shell.ts gives it the CSP nonce): applies a stored light/dark choice to <html>
 * before first paint so the page never flashes the wrong theme. Auto leaves data-theme unset.
 */
export function themeInitScript(): string {
  return (
    `try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});` +
    `if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`
  );
}

/** The three-way segmented control, as static markup (the buttons are wired by `wireThemeControl`). */
export function themeControlHtml(current: ThemeChoice = 'auto'): string {
  const buttons = CHOICES.map(
    (c) =>
      `<button type="button" data-theme-choice="${c}" aria-pressed="${c === current}">${esc(LABEL[c])}</button>`,
  ).join('');
  return `<div class="seg" role="group" aria-label="Colour theme">${buttons}</div>`;
}

interface ApplyDeps {
  root: ThemeRoot;
  buttons: ThemeButton[];
}

/** Set (or, for Auto, remove) <html data-theme> and mark the matching button pressed. */
export function applyTheme(choice: ThemeChoice, { root, buttons }: ApplyDeps): void {
  if (choice === 'auto') delete root.dataset.theme;
  else root.dataset.theme = choice;
  for (const b of buttons) b.setAttribute('aria-pressed', String(parseTheme(b.dataset.themeChoice) === choice));
}

/** Apply and persist. */
export function setTheme(choice: ThemeChoice, deps: ApplyDeps & { storage: ThemeStorage | null | undefined }): void {
  applyTheme(choice, deps);
  saveTheme(deps.storage, choice);
}

/** Show the stored choice as pressed, then listen for clicks on the buttons (event delegation). */
export function wireThemeControl(deps: {
  container: { addEventListener(type: 'click', fn: (e: { target: unknown }) => void): void };
  root: ThemeRoot;
  storage: ThemeStorage | null | undefined;
  buttons: ThemeButton[];
}): void {
  applyTheme(initialTheme(deps.storage), deps);
  deps.container.addEventListener('click', (e) => {
    const target = e.target as { closest?: (sel: string) => ThemeButton | null } | null;
    const button = target?.closest?.('button[data-theme-choice]') ?? null;
    if (button) setTheme(parseTheme(button.dataset.themeChoice), deps);
  });
}
