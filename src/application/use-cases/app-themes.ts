import { AppTheme } from '../../domain/entities';
import {
  AppThemeLimitReachedError,
  AppThemeNameAlreadyExistsError,
  AppThemeNotFoundError,
  AppThemeTooLargeError,
  LowContrastAppThemeError,
  ThemeEnforcedError,
} from '../../domain/errors';
import {
  APP_THEME_CONFIG_MAX_BYTES,
  APP_THEME_MAX_PER_ORGANIZATION,
  AppThemeConfig,
  DEFAULT_THEME_SETTINGS,
  ThemeSettings,
  checkAppThemeContrast,
  isBuiltinThemeRef,
} from '../../domain/app-theme';
import { AppThemeRepository, Repositories, ThemePreferenceRepository } from '../../domain/repositories';
import { UnitOfWork } from '../ports';
import { AppThemeDTO, AppThemesStateDTO } from '../dtos';

/*
 * Temas de la aplicación web. Los seis casos de uso van juntos porque comparten las mismas tres reglas: un tema ajeno es 404
 * (nunca 403), una referencia a un tema propio tiene que existir, y el contraste se valida en el servidor y no solo en el editor.
 *
 * Quién puede qué (decisión del dueño, 2026-11-18): todos eligen su tema; solo los administradores de la organización crean temas
 * y deciden el de la empresa; si lo fijan, el resto ya no puede cambiarlo (los administradores sí).
 */

function toDTO(t: AppTheme): AppThemeDTO {
  return { id: t.id, name: t.name, config: t.config, createdBy: t.createdBy, updatedAt: t.updatedAt.toISOString() };
}

function assertAcceptable(config: AppThemeConfig): void {
  const bytes = Buffer.byteLength(JSON.stringify(config), 'utf8');
  if (bytes > APP_THEME_CONFIG_MAX_BYTES) throw new AppThemeTooLargeError(`El tema ocupa ${bytes} bytes y el máximo es ${APP_THEME_CONFIG_MAX_BYTES}.`);
  const failing = checkAppThemeContrast(config);
  if (failing.length > 0) throw new LowContrastAppThemeError(failing);
}

async function findOwned(repos: { appThemes: AppThemeRepository }, themeId: string, organizationId: string): Promise<AppTheme> {
  const theme = await repos.appThemes.findById(themeId);
  if (!theme || !theme.belongsToOrganization(organizationId)) throw new AppThemeNotFoundError();
  return theme;
}

/** Un `light`/`dark`/`system` vale siempre; un id solo si es un tema de esta organización. */
async function assertRefExists(repos: { appThemes: AppThemeRepository }, ref: string, organizationId: string): Promise<void> {
  if (!isBuiltinThemeRef(ref)) await findOwned(repos, ref, organizationId);
}

async function settingsOf(prefs: ThemePreferenceRepository, organizationId: string): Promise<ThemeSettings> {
  return (await prefs.getSettings(organizationId)) ?? { ...DEFAULT_THEME_SETTINGS };
}

/** Los temas de la empresa, sus ajustes y lo que eligió quien pregunta: lo que el navegador necesita para pintarse. */
export class GetAppThemesUseCase {
  constructor(
    private readonly appThemes: AppThemeRepository,
    private readonly prefs: ThemePreferenceRepository,
  ) {}

  async execute(organizationId: string, userId: string): Promise<AppThemesStateDTO> {
    const [themes, settings, myChoice] = await Promise.all([
      this.appThemes.listByOrganization(organizationId),
      settingsOf(this.prefs, organizationId),
      this.prefs.getChoice(organizationId, userId),
    ]);
    return { themes: themes.map(toDTO), settings, myChoice };
  }
}

export class CreateAppThemeUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: { organizationId: string; userId: string | null; name: string; config: AppThemeConfig }): Promise<AppThemeDTO> {
    assertAcceptable(input.config);
    return this.uow.execute(async (repos) => {
      const existing = await repos.appThemes.listByOrganization(input.organizationId);
      if (existing.length >= APP_THEME_MAX_PER_ORGANIZATION) throw new AppThemeLimitReachedError(APP_THEME_MAX_PER_ORGANIZATION);
      if (existing.some((t) => t.name === input.name)) throw new AppThemeNameAlreadyExistsError();

      const theme = AppTheme.create({ organizationId: input.organizationId, name: input.name, config: input.config, createdBy: input.userId });
      await repos.appThemes.save(theme);
      await publish(repos, 'organization.app_theme.created', input.organizationId, theme);
      return toDTO(theme);
    });
  }
}

export class UpdateAppThemeUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: { organizationId: string; themeId: string; name: string; config: AppThemeConfig }): Promise<AppThemeDTO> {
    assertAcceptable(input.config);
    return this.uow.execute(async (repos) => {
      const theme = await findOwned(repos, input.themeId, input.organizationId);
      const sameName = await repos.appThemes.findByName(input.organizationId, input.name);
      if (sameName && sameName.id !== theme.id) throw new AppThemeNameAlreadyExistsError();

      theme.replace(input.name, input.config);
      await repos.appThemes.save(theme);
      await publish(repos, 'organization.app_theme.updated', input.organizationId, theme);
      return toDTO(theme);
    });
  }
}

/**
 * Borrar un tema no se bloquea aunque esté en uso: quien lo tenía elegido vuelve al de la empresa, y si era el de la empresa, la
 * empresa vuelve a claro y se desfija (sin tema fijado que mostrar, mantener «fijado» dejaría a todos sin poder elegir nada útil).
 */
export class DeleteAppThemeUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: { organizationId: string; themeId: string }): Promise<void> {
    await this.uow.execute(async (repos) => {
      const theme = await findOwned(repos, input.themeId, input.organizationId);
      await repos.appThemes.remove(theme.id);
      await repos.themePreferences.clearChoicesFor(input.organizationId, theme.id);

      const settings = await repos.themePreferences.getSettings(input.organizationId);
      if (settings?.defaultTheme === theme.id) {
        await repos.themePreferences.saveSettings(input.organizationId, { ...DEFAULT_THEME_SETTINGS });
      }
      await publish(repos, 'organization.app_theme.deleted', input.organizationId, theme);
    });
  }
}

export class SaveThemeSettingsUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: { organizationId: string; settings: ThemeSettings }): Promise<ThemeSettings> {
    return this.uow.execute(async (repos) => {
      await assertRefExists(repos, input.settings.defaultTheme, input.organizationId);
      await repos.themePreferences.saveSettings(input.organizationId, input.settings);
      await repos.outbox.add({
        type: 'organization.theme_settings.updated',
        aggregateType: 'organization',
        aggregateId: input.organizationId,
        payload: { targetId: input.organizationId, organizationId: input.organizationId, ...input.settings },
        occurredAt: new Date(),
      });
      return input.settings;
    });
  }
}

/**
 * La elección personal. No publica evento a propósito (como el tablero de Inicio en auth-service): cambiar de tema es una
 * preferencia, no una acción de negocio, y llenaría la bitácora de ruido.
 */
export class SaveMyThemeChoiceUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: { organizationId: string; userId: string; isAdmin: boolean; theme: string | null }): Promise<{ myChoice: string | null }> {
    return this.uow.execute(async (repos) => {
      const settings = await settingsOf(repos.themePreferences, input.organizationId);
      if (settings.enforced && !input.isAdmin) throw new ThemeEnforcedError();
      if (input.theme !== null) await assertRefExists(repos, input.theme, input.organizationId);
      await repos.themePreferences.saveChoice(input.organizationId, input.userId, input.theme);
      return { myChoice: input.theme };
    });
  }
}

/**
 * Los avisos llevan solo el id y el nombre, nunca los colores: el navegador vuelve a pedir los temas por REST (el aviso en vivo
 * del gateway solo dice «algo cambió»), y la bitácora no necesita ocho hexadecimales para decir quién tocó qué.
 */
async function publish(repos: Repositories, type: string, organizationId: string, theme: AppTheme): Promise<void> {
  await repos.outbox.add({
    type,
    aggregateType: 'app_theme',
    aggregateId: theme.id,
    payload: { targetId: theme.id, organizationId, name: theme.name },
    occurredAt: new Date(),
  });
}
