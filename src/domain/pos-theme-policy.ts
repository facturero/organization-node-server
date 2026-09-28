import { LowContrastPosThemeError, PosThemeTooLargeError } from './errors';
import {
  CONTRAST_MIN_BLOCKING,
  POS_THEME_CONFIG_MAX_BYTES,
  PosThemeConfig,
  checkContrast,
} from './pos-theme';

/**
 * Las dos reglas que el esquema NO puede comprobar y que son de negocio, no de
 * forma: el tamaño del JSON y el contraste.
 *
 * El contraste se calcula aquí (dominio) y no en el esquema porque depende del
 * valor de OTROS campos: un color puede ser válido en sí mismo y aun así dejar
 * el texto ilegible al combinarse con el fondo. Y se rechaza en el servidor, no
 * solo se avisa en el editor, porque el editor es una forma de entrar al
 * sistema y no la única.
 */
export function assertThemeConfigAcceptable(config: PosThemeConfig): void {
  const bytes = Buffer.byteLength(JSON.stringify(config), 'utf8');
  if (bytes > POS_THEME_CONFIG_MAX_BYTES) {
    throw new PosThemeTooLargeError(
      `El tema ocupa ${bytes} bytes y el máximo es ${POS_THEME_CONFIG_MAX_BYTES}.`,
    );
  }

  const failing = checkContrast(config, CONTRAST_MIN_BLOCKING);
  if (failing.length > 0) {
    throw new LowContrastPosThemeError(failing);
  }
}
