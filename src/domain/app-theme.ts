import { contrastRatio, CONTRAST_MIN_BLOCKING } from './pos-theme';

/**
 * Contrato de los temas de la aplicación web (schemaVersion 1): el aspecto del CRM que cada empresa puede crear, aparte de los
 * temas de la caja (`pos-theme.ts`, que llevan además distribución de carrito y catálogo).
 *
 * Igual que el del POS, es SOLO DATOS: una base (claro u oscuro) y ocho colores. El resto de la paleta de Vuetify (tonos suaves,
 * bordes, el color del texto sobre cada color) la deriva el navegador a partir de estos ocho, para que un tema no pueda quedar
 * a medias con un token suelto sin tocar. El contrato se copia en el frontend (`src/types/appTheme.ts`).
 */

export const APP_THEME_SCHEMA_VERSION = 1;

/** Un tema son ocho colores y una base: con 2 KB sobra, y un JSON sin tope es una puerta abierta a meter cualquier cosa. */
export const APP_THEME_CONFIG_MAX_BYTES = 2048;

/** Tope por empresa: la lista del menú del avatar tiene que caber en pantalla. */
export const APP_THEME_MAX_PER_ORGANIZATION = 20;

export const APP_THEME_BASES = ['light', 'dark'] as const;
export type AppThemeBase = (typeof APP_THEME_BASES)[number];

export const APP_THEME_COLOR_TOKENS = ['primary', 'secondary', 'background', 'surface', 'text', 'success', 'warning', 'error'] as const;
export type AppThemeColorToken = (typeof APP_THEME_COLOR_TOKENS)[number];
export type AppThemeColors = Record<AppThemeColorToken, string>;

export interface AppThemeConfig {
  schemaVersion: typeof APP_THEME_SCHEMA_VERSION;
  base: AppThemeBase;
  colors: AppThemeColors;
}

/**
 * Referencia a un tema, tal como se guarda en la elección de cada usuario y en el tema de la empresa: uno de los integrados o el
 * id (uuid) de un tema propio. `system` sigue al sistema operativo (claro u oscuro).
 *
 * Los `preset:*` son temas predefinidos que ve toda empresa (como los de Slack; decisión del dueño, 2026-11-18). El servidor solo
 * conoce sus nombres para validar la referencia: sus colores viven en el frontend (`src/types/appTheme.ts`, `PRESET_THEMES`),
 * igual que los de claro y oscuro. Si se añade uno, va en las dos listas.
 */
export const BUILTIN_THEME_REFS = [
  'light',
  'dark',
  'system',
  'preset:ocean',
  'preset:forest',
  'preset:sunset',
  'preset:lavender',
  'preset:cherry',
  'preset:midnight',
  'preset:graphite',
  'preset:emerald',
] as const;
export type BuiltinThemeRef = (typeof BUILTIN_THEME_REFS)[number];
export type ThemeRef = BuiltinThemeRef | string;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBuiltinThemeRef(ref: string): ref is BuiltinThemeRef {
  return (BUILTIN_THEME_REFS as readonly string[]).includes(ref);
}

export function isCustomThemeRef(ref: string): boolean {
  return UUID_RE.test(ref);
}

/** Lo que la empresa decidió para todos: qué tema ve quien nunca eligió y si el resto lo puede cambiar. */
export interface ThemeSettings {
  defaultTheme: ThemeRef;
  /** Fijado: quien no administra la organización ve siempre `defaultTheme`; los administradores siguen pudiendo elegir. */
  enforced: boolean;
}

/** Sin nada guardado, la empresa se ve en claro y cada uno elige: es como se veía antes de que existieran los temas. */
export const DEFAULT_THEME_SETTINGS: ThemeSettings = { defaultTheme: 'light', enforced: false };

/** Elige el blanco o el negro, el que más se lea sobre `hex`. El navegador hace la misma cuenta para los `on-*`. */
export function bestTextOn(hex: string): '#ffffff' | '#000000' {
  return contrastRatio('#ffffff', hex) >= contrastRatio('#000000', hex) ? '#ffffff' : '#000000';
}

export interface AppThemeContrastPair {
  a: string;
  b: string;
  ratio: number;
  min: number;
}

/**
 * Las parejas que tienen que leerse: el texto sobre el fondo y sobre las tarjetas, y el texto que el navegador pondrá sobre el
 * primario (blanco o negro, el mejor de los dos). Los colores de estado no se comprueban: se usan sobre todo como fondo suave o
 * en iconos, y su texto encima también lo elige el navegador.
 */
export function checkAppThemeContrast(config: AppThemeConfig, min: number = CONTRAST_MIN_BLOCKING): AppThemeContrastPair[] {
  const { colors } = config;
  const pairs: Array<[string, string, string, string]> = [
    ['text', 'background', colors.text, colors.background],
    ['text', 'surface', colors.text, colors.surface],
    ['on-primary', 'primary', bestTextOn(colors.primary), colors.primary],
  ];
  const failing: AppThemeContrastPair[] = [];
  for (const [a, b, ca, cb] of pairs) {
    const ratio = Math.round(contrastRatio(ca, cb) * 100) / 100;
    if (ratio < min) failing.push({ a, b, ratio, min });
  }
  return failing;
}
