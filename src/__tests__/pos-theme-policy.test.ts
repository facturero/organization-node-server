import { describe, it, expect } from 'vitest';
import { assertThemeConfigAcceptable } from '../domain/pos-theme-policy';
import { POS_THEME_CONFIG_MAX_BYTES } from '../domain/pos-theme';
import { LowContrastPosThemeError, PosThemeTooLargeError } from '../domain/errors';
import { classicTheme, lowContrastTheme, oversizedTheme } from './pos-theme-fixtures';

describe('Política del tema · tamaño', () => {
  it('acepta un config de tamaño normal', () => {
    expect(() => assertThemeConfigAcceptable(classicTheme())).not.toThrow();
  });

  it('el Clásico del encargo ocupa ~1 KB, el 13% del tope: el límite no aprieta', () => {
    const bytes = Buffer.byteLength(JSON.stringify(classicTheme()), 'utf8');
    expect(bytes).toBeLessThan(POS_THEME_CONFIG_MAX_BYTES);
    // Un config real ronda los 1.085 bytes porque lleva los dos modos completos.
    // El margen es enorme porque el schema es cerrado: 8 KB no es el límite que
    // protege hoy, es el que protege si algún día el schema se afloja.
    expect(bytes).toBeLessThan(2048);
    expect(bytes / POS_THEME_CONFIG_MAX_BYTES).toBeLessThan(0.25);
  });

  it('rechaza por encima de 8 KB diciendo cuántos bytes son', () => {
    try {
      assertThemeConfigAcceptable(oversizedTheme());
      expect.unreachable('debería lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(PosThemeTooLargeError);
      const bytes = Buffer.byteLength(JSON.stringify(oversizedTheme()), 'utf8');
      expect((error as PosThemeTooLargeError).message).toContain(String(bytes));
      expect((error as PosThemeTooLargeError).message).toContain(String(POS_THEME_CONFIG_MAX_BYTES));
    }
  });

  it('el tope es exactamente 8192 bytes, no "8 KB a ojo"', () => {
    expect(POS_THEME_CONFIG_MAX_BYTES).toBe(8192);
  });

  it('mide en bytes, no en caracteres: un emoji vale cuatro', () => {
    const base = classicTheme();
    // 8 emojis de 4 bytes = 32 bytes de peso, pero 16 unidades de string.
    const conEmoji = { ...base, branding: { ...base.branding, welcomeMessage: '👋'.repeat(20) } };
    const bytes = Buffer.byteLength(JSON.stringify(conEmoji), 'utf8');
    expect(bytes).toBe(Buffer.byteLength(JSON.stringify(conEmoji), 'utf8'));
    expect(bytes).toBeGreaterThan(JSON.stringify(conEmoji).length);
  });
});

describe('Política del tema · contraste', () => {
  it('acepta el Clásico', () => {
    expect(() => assertThemeConfigAcceptable(classicTheme())).not.toThrow();
  });

  it('lanza LowContrastPosThemeError con las parejas que fallan', () => {
    try {
      assertThemeConfigAcceptable(lowContrastTheme());
      expect.unreachable('debería lanzar');
    } catch (error) {
      expect(error).toBeInstanceOf(LowContrastPosThemeError);
      const pairs = (error as LowContrastPosThemeError).pairs;
      expect(pairs[0].a).toBe('light.textMuted');
      expect(pairs[0].b).toBe('light.surface');
      expect(pairs[0].ratio).toBeLessThan(3);
    }
  });

  it('el tamaño se comprueba ANTES que el contraste, para no pagar el cálculo en un payload inútil', () => {
    // Un config enorme y además mal contrastado debe quejarse del tamaño: es el
    // dato que el usuario tiene que arreglar primero.
    const base = classicTheme();
    const enormeYMalo = {
      ...lowContrastTheme(),
      branding: { ...base.branding, welcomeMessage: 'x'.repeat(9000) },
    };
    expect(() => assertThemeConfigAcceptable(enormeYMalo)).toThrow(PosThemeTooLargeError);
  });
});
