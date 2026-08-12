// Nocturne design-system tokens, ported from the Claude Design prototype
// (_ds/nocturne styles.css + the prototype's .cs-app overrides). One object
// per appearance; components read them through useTheme().

export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  /** Secondary surface (skeleton shimmer highlight, toast ground). */
  surface2: string;
  text: string;
  /** Muted body text — the prototype's --m. */
  muted: string;
  /** Faint text — neutral-500/600 captions. */
  faint: string;
  divider: string;
  accent: string;
  /** Bright accent for text/icons on tinted grounds — the prototype's --acct. */
  accentBright: string;
  danger: string;
  warning: string;
  /** Translucent scrim behind sheets and dialogs. */
  scrim: string;
  /** 8–14% accent tint used as button/badge ground. */
  accentTint: string;
  accentTintStrong: string;
  /** ~30–40% accent used for tinted borders. */
  accentBorder: string;
  /** Hairline ring color for elevated cards (--shadow-sm ring). */
  ring: string;
  shadowOpacity: number;
}

export const darkTheme: Theme = {
  dark: true,
  bg: '#161826',
  surface: '#232532',
  surface2: '#2c2e3d',
  text: '#e9e9ed',
  muted: '#9397ab',
  faint: '#878ba0',
  divider: 'rgba(233,233,237,0.16)',
  accent: '#9184d9',
  accentBright: '#d2cefd',
  danger: '#e08a84',
  warning: '#dfa96b',
  scrim: 'rgba(8,9,15,0.55)',
  accentTint: 'rgba(145,132,217,0.10)',
  accentTintStrong: 'rgba(145,132,217,0.16)',
  accentBorder: 'rgba(145,132,217,0.40)',
  ring: '#3f424d',
  shadowOpacity: 0.55,
};

export const lightTheme: Theme = {
  dark: false,
  bg: '#e4e7f5',
  surface: '#f3f5fe',
  surface2: '#e9ecf8',
  text: '#292b31',
  muted: '#4f5468',
  faint: '#62667a',
  divider: 'rgba(41,43,49,0.13)',
  accent: '#796cbf',
  accentBright: '#5d5294',
  danger: '#a8433f',
  warning: '#8a5d2c',
  scrim: 'rgba(41,43,49,0.42)',
  accentTint: 'rgba(121,108,191,0.10)',
  accentTintStrong: 'rgba(121,108,191,0.16)',
  accentBorder: 'rgba(121,108,191,0.40)',
  ring: 'rgba(41,43,49,0.10)',
  shadowOpacity: 0.14,
};

// The capture/processing screens are always-dark regardless of appearance
// (camera chrome), matching the prototype.
export const cameraChrome = {
  bg: '#0c0d14',
  glass: 'rgba(22,24,38,0.55)',
  glassStrong: 'rgba(22,24,38,0.75)',
  text: '#e9e9ed',
  textDim: 'rgba(233,233,237,0.6)',
  muted: '#9397ab',
  accent: '#9184d9',
  accentBright: '#d2cefd',
  warning: '#dfa96b',
} as const;

export type Appearance = 'system' | 'light' | 'dark';
