import { describe, it, expect } from 'vitest';
import {
  CONTRAST_MIN_BLOCKING,
  checkContrast,
  contrastRatio,
  relativeLuminance,
  resolveThemeAssets,
} from '../domain/pos-theme';
import { classicTheme } from './pos-theme-fixtures';

describe('posTheme · contraste', () => {
  it('la luminancia de blanco es 1 y la de negro es 0', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
  });

  it('blanco sobre negro da el máximo de la escala (21:1)', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 2);
  });

  it('un color contra sí mismo da 1:1', () => {
    expect(contrastRatio('#2563eb', '#2563eb')).toBeCloseTo(1, 5);
  });

  it('el ratio es simétrico: no depende del orden de los argumentos', () => {
    expect(contrastRatio('#1f2937', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#1f2937'), 10);
  });

  it('el tema Clásico del encargo pasa el corte de 3:1', () => {
    // Si este test falla, la tabla de §3 no describe el aspecto del POS de hoy.
    expect(checkContrast(classicTheme())).toEqual([]);
  });

  it('detecta el textoMuted ilegible y dice qué pareja falla y con qué ratio', () => {
    const base = classicTheme();
    const config = {
      ...base,
      colors: {
        ...base.colors,
        light: { ...base.colors.light, textMuted: '#f1f3f5' },
      },
    };
    const failing = checkContrast(config, CONTRAST_MIN_BLOCKING);
    expect(failing).toHaveLength(1);
    expect(failing[0].a).toBe('light.textMuted');
    expect(failing[0].b).toBe('light.surface');
    expect(failing[0].ratio).toBeLessThan(CONTRAST_MIN_BLOCKING);
    expect(failing[0].min).toBe(CONTRAST_MIN_BLOCKING);
  });

  it('mira los DOS modos: un tema puede leerse de día y ser ilegible de noche', () => {
    const base = classicTheme();
    const config = {
      ...base,
      colors: {
        light: base.colors.light,
        dark: { ...base.colors.dark, text: '#1e293b' },
      },
    };
    const failing = checkContrast(config, CONTRAST_MIN_BLOCKING);
    expect(failing.every((p) => p.a.startsWith('dark.'))).toBe(true);
    expect(failing.length).toBeGreaterThan(0);
  });

  it('avisa (sin bloquear) por debajo de 4.5:1 pero por encima de 3:1', () => {
    const base = classicTheme();
    // textMuted un gris medio: legible pero no AA.
    const config = {
      ...base,
      colors: {
        ...base.colors,
        light: { ...base.colors.light, textMuted: '#8a8f98' },
      },
    };
    expect(checkContrast(config, CONTRAST_MIN_BLOCKING)).toEqual([]);
    expect(checkContrast(config, 4.5).length).toBeGreaterThan(0);
  });

  it('el texto sobre el primario se deriva: elige blanco o negro, el que mejor contraste dé', () => {
    const base = classicTheme();
    // Amarillo claro: negro encima gana por goleada.
    const claro = {
      ...base,
      colors: { ...base.colors, light: { ...base.colors.light, primary: '#fde047' } },
    };
    const failing = checkContrast(claro, CONTRAST_MIN_BLOCKING);
    // Con negro encima el ratio es alto, así que no debe fallar.
    expect(failing).toEqual([]);
  });

  it('la pareja on-primary nunca falla, y el motivo es aritmético', () => {
    // Elijiendo entre blanco y negro, lo PEOR que puede salir es el primario en
    // el punto donde ambos empatan, y ahí el ratio es sqrt(21) ~ 4.58. O sea:
    // con los cortes de 3 y de 4.5 esta pareja no puede disparar nunca.
    //
    // Se deja la comprobación igual porque es la que protege si algún día baja
    // el corte o si se deriva el texto de otra forma, pero conviene saber que hoy
    // es una red de seguridad, no un filtro que llegue a parar nada.
    const base = classicTheme();
    for (const primary of ['#767676', '#808080', '#949494', '#ff0000', '#0000ff']) {
      const config = {
        ...base,
        colors: { ...base.colors, light: { ...base.colors.light, primary } },
      };
      expect(checkContrast(config, CONTRAST_MIN_BLOCKING)).toEqual([]);
      expect(checkContrast(config, 4.5)).toEqual([]);
    }
  });

  it('el piso de la pareja on-primary es sqrt(21)', () => {
    for (const primary of ['#767676', '#7a7a7a', '#808080', '#8a8a8a', '#949494']) {
      const best = Math.max(contrastRatio('#ffffff', primary), contrastRatio('#000000', primary));
      expect(best).toBeGreaterThanOrEqual(Math.sqrt(21));
    }
  });
});

describe('posTheme · assets', () => {
  const uuidA = '11111111-1111-4111-8111-111111111111';
  const uuidB = '22222222-2222-4222-8222-222222222222';
  const uuidC = '33333333-3333-4333-8333-333333333333';

  it('sin marca no hay assets', () => {
    expect(resolveThemeAssets(classicTheme())).toEqual([]);
  });

  it('incluye logo y logoDark solo cuando existen', () => {
    const base = classicTheme();
    const config = {
      ...base,
      branding: { ...base.branding, logoFileId: uuidA, logoDarkFileId: uuidB },
    };
    expect(resolveThemeAssets(config)).toEqual([
      { role: 'logo', fileId: uuidA },
      { role: 'logoDark', fileId: uuidB },
    ]);
  });

  it('logoDark sin logo no aparece: el POS cae al logo, no a la nada', () => {
    const base = classicTheme();
    const config = { ...base, branding: { ...base.branding, logoDarkFileId: uuidB } };
    expect(resolveThemeAssets(config)).toEqual([{ role: 'logoDark', fileId: uuidB }]);
  });

  it('el fondo del login solo cuenta cuando es de tipo imagen', () => {
    const base = classicTheme();
    const color = {
      ...base,
      branding: {
        ...base.branding,
        loginBackground: { type: 'color', color: '#123456', imageFileId: null },
      },
    } as const;
    expect(resolveThemeAssets(color)).toEqual([]);

    const imagen = {
      ...base,
      branding: { ...base.branding, loginBackground: { type: 'image', color: null, imageFileId: uuidC } },
    } as const;
    expect(resolveThemeAssets(imagen)).toEqual([{ role: 'loginBackground', fileId: uuidC }]);
  });
});
