import { PosThemeRepository } from '../../domain/repositories';
import { PosThemeDTO } from '../dtos';
import { PosThemeConfig } from '../../domain/pos-theme';
import { findOwnedTheme } from './pos-theme-support';

export class GetPosThemeUseCase {
  constructor(private readonly themes: PosThemeRepository) {}

  async execute(themeId: string, organizationId: string): Promise<PosThemeDTO> {
    const theme = await findOwnedTheme({ posThemes: this.themes }, themeId, organizationId);
    return {
      id: theme.id,
      organizationId: theme.organizationId,
      name: theme.name,
      isDefault: theme.isDefault,
      version: theme.version,
      schemaVersion: theme.schemaVersion,
      config: theme.config as PosThemeConfig,
      updatedAt: theme.updatedAt.toISOString(),
    };
  }
}
