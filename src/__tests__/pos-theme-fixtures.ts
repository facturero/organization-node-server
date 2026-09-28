import { PosThemeConfig } from '../domain/pos-theme';

/**
 * El config "Clásico" del encargo (§3): los valores del aspecto ACTUAL del POS.
 * Si estos colores no pasan el contraste de 3:1 es un bug de la tabla, no del
 * test, así que hay un test explícito que lo fija.
 */
export function classicTheme(overrides: Partial<PosThemeConfig> = {}): PosThemeConfig {
  return {
    schemaVersion: 1,
    mode: 'light',
    allowCashierToggle: true,
    schedule: { darkFrom: '19:00', darkTo: '06:00' },
    colors: {
      light: {
        primary: '#2563eb',
        background: '#f9fafb',
        surface: '#ffffff',
        surfaceAlt: '#f3f4f6',
        text: '#1f2937',
        textMuted: '#6b7280',
        border: '#e5e7eb',
        success: '#059669',
        warning: '#b45309',
        danger: '#dc2626',
      },
      dark: {
        primary: '#3b82f6',
        background: '#0f172a',
        surface: '#1e293b',
        surfaceAlt: '#334155',
        text: '#f1f5f9',
        textMuted: '#94a3b8',
        border: '#334155',
        success: '#34d399',
        warning: '#fbbf24',
        danger: '#f87171',
      },
    },
    typography: { fontFamily: 'system', baseSize: 16, headingWeight: 600 },
    shape: { radius: 'lg', density: 'comfortable', shadows: true, borderWidth: 1 },
    layout: {
      cartPosition: 'right',
      cartWidth: 'normal',
      catalogColumns: 'auto',
      productCard: 'image-top',
      categoriesPlacement: 'top',
      statusBarPosition: 'bottom',
      showProductImages: true,
    },
    branding: {
      logoFileId: null,
      logoDarkFileId: null,
      logoPosition: 'left',
      logoSize: 'md',
      showLogoOnLogin: true,
      loginBackground: { type: 'color', color: null, imageFileId: null },
      welcomeMessage: null,
    },
    ...overrides,
  };
}

/** Texto casi del color del fondo: el caso que el servidor tiene que rechazar. */
export function lowContrastTheme(): PosThemeConfig {
  const base = classicTheme();
  return {
    ...base,
    colors: {
      ...base.colors,
      light: { ...base.colors.light, textMuted: '#f1f3f5' },
    },
  };
}

/** `welcomeMessage` es lo único que crece sin límite natural; 8 KB es el tope
 * del JSON entero, no de un campo. */
export function oversizedTheme(): PosThemeConfig {
  const base = classicTheme();
  return { ...base, branding: { ...base.branding, welcomeMessage: 'x'.repeat(9000) } };
}
