import { File, Paths } from 'expo-file-system';
import { Appearance } from '../theme/tokens';

export interface Settings {
  appearance: Appearance;
  onboarded: boolean;
  coachSeen: boolean;
}

const DEFAULTS: Settings = { appearance: 'system', onboarded: false, coachSeen: false };

const settingsFile = () => new File(Paths.document, 'settings.json');

export function loadSettings(): Settings {
  try {
    const f = settingsFile();
    if (!f.exists) return { ...DEFAULTS };
    const parsed = JSON.parse(f.textSync()) as Partial<Settings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch };
  try {
    settingsFile().write(JSON.stringify(next));
  } catch (e) {
    console.warn('settings save failed', e);
  }
  return next;
}
