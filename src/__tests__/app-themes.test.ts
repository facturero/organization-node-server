import { describe, it, expect } from 'vitest';
import { ADMIN_PERMISSIONS, READ_PERMISSIONS, asOrganization, createTestApp, jsonOf } from './helpers';
import { AppThemeConfig } from '../domain/app-theme';

/** Temas de la aplicación web, por HTTP: permisos, aislamiento entre organizaciones, contraste y la regla de «fijado para todos». */

const ocean: AppThemeConfig = {
  schemaVersion: 1,
  base: 'light',
  colors: {
    primary: '#0b6e99',
    secondary: '#14a3c7',
    background: '#f3f7f9',
    surface: '#ffffff',
    text: '#1d2b36',
    success: '#1a9d6b',
    warning: '#e0a100',
    error: '#d64545',
  },
};

const unreadable: AppThemeConfig = { ...ocean, colors: { ...ocean.colors, text: '#f0f0f0' } };

type State = { themes: Array<{ id: string; name: string; createdBy: string | null }>; settings: { defaultTheme: string; enforced: boolean }; myChoice: string | null };

function asUser(orgId: string, userId: string, perms: string[]) {
  return { ...asOrganization(orgId, perms), 'X-User-Id': userId, 'content-type': 'application/json' };
}

describe('Temas de la aplicación · HTTP', () => {
  const admin = asUser('org-1', 'admin-1', ADMIN_PERMISSIONS);
  const staff = asUser('org-1', 'staff-1', READ_PERMISSIONS);
  const noPerms = asUser('org-1', 'staff-2', []);

  async function create(app: ReturnType<typeof createTestApp>['app'], name = 'Océano', config = ocean, headers = admin) {
    return app.request('/organizations/me/themes', { method: 'POST', headers, body: JSON.stringify({ name, config }) });
  }

  it('sin nada guardado: ninguna empresa tiene temas, se ve en claro y sin fijar', async () => {
    const { app } = createTestApp();
    const res = await app.request('/organizations/me/themes', { headers: noPerms });
    expect(res.status).toBe(200);
    expect(await jsonOf<State>(res)).toEqual({ themes: [], settings: { defaultTheme: 'light', enforced: false }, myChoice: null });
  });

  it('el administrador crea un tema; lo ven todos, también quien no tiene permisos', async () => {
    const { app, repos } = createTestApp();
    const res = await create(app);
    expect(res.status).toBe(201);
    const theme = await jsonOf<{ id: string; createdBy: string }>(res);
    expect(theme.createdBy).toBe('admin-1');
    expect(repos.events.map((e) => e.type)).toContain('organization.app_theme.created');

    const list = await jsonOf<State>(await app.request('/organizations/me/themes', { headers: noPerms }));
    expect(list.themes.map((t) => t.name)).toEqual(['Océano']);
  });

  it('quien no administra la organización no crea, edita, borra ni decide el de la empresa', async () => {
    const { app } = createTestApp();
    expect((await create(app, 'X', ocean, staff)).status).toBe(403);
    const { id } = await jsonOf<{ id: string }>(await create(app));
    expect((await app.request(`/organizations/me/themes/${id}`, { method: 'PUT', headers: staff, body: JSON.stringify({ name: 'Y', config: ocean }) })).status).toBe(403);
    expect((await app.request(`/organizations/me/themes/${id}`, { method: 'DELETE', headers: staff })).status).toBe(403);
    expect((await app.request('/organizations/me/theme-settings', { method: 'PUT', headers: staff, body: JSON.stringify({ defaultTheme: 'dark', enforced: true }) })).status).toBe(403);
  });

  it('rechaza un tema ilegible (contraste bajo) y un nombre repetido', async () => {
    const { app } = createTestApp();
    const bad = await create(app, 'Ilegible', unreadable);
    expect(bad.status).toBe(422);
    expect((await jsonOf<{ code: string; pairs: Array<{ a: string; b: string }> }>(bad)).code).toBe('LOW_CONTRAST');
    await create(app);
    const dup = await create(app);
    expect(dup.status).toBe(409);
    expect((await jsonOf<{ code: string }>(dup)).code).toBe('APP_THEME_NAME_EXISTS');
  });

  it('rechaza colores que no son #rrggbb y campos de más', async () => {
    const { app } = createTestApp();
    expect((await create(app, 'Rojo', { ...ocean, colors: { ...ocean.colors, primary: 'red' } })).status).toBe(422);
    expect((await create(app, 'Raro', { ...ocean, css: 'body{}' } as unknown as AppThemeConfig)).status).toBe(422);
  });

  it('un tema de otra organización es 404, no 403', async () => {
    const { app } = createTestApp();
    const { id } = await jsonOf<{ id: string }>(await create(app));
    const other = asUser('org-2', 'admin-2', ADMIN_PERMISSIONS);
    expect((await app.request(`/organizations/me/themes/${id}`, { method: 'PUT', headers: other, body: JSON.stringify({ name: 'Mío', config: ocean }) })).status).toBe(404);
    expect((await app.request('/organizations/me/theme-choice', { method: 'PUT', headers: other, body: JSON.stringify({ theme: id }) })).status).toBe(404);
    expect((await app.request('/organizations/me/theme-settings', { method: 'PUT', headers: other, body: JSON.stringify({ defaultTheme: id, enforced: false }) })).status).toBe(404);
  });

  it('cada uno elige su tema, y vuelve al de la empresa con null', async () => {
    const { app, repos } = createTestApp();
    const { id } = await jsonOf<{ id: string }>(await create(app));
    const before = repos.events.length;
    expect((await app.request('/organizations/me/theme-choice', { method: 'PUT', headers: noPerms, body: JSON.stringify({ theme: id }) })).status).toBe(200);
    expect((await app.request('/organizations/me/theme-choice', { method: 'PUT', headers: staff, body: JSON.stringify({ theme: 'dark' }) })).status).toBe(200);
    expect((await jsonOf<State>(await app.request('/organizations/me/themes', { headers: noPerms }))).myChoice).toBe(id);
    expect((await jsonOf<State>(await app.request('/organizations/me/themes', { headers: staff }))).myChoice).toBe('dark');
    // Elegir tema no llena la bitácora.
    expect(repos.events.length).toBe(before);

    await app.request('/organizations/me/theme-choice', { method: 'PUT', headers: staff, body: JSON.stringify({ theme: null }) });
    expect((await jsonOf<State>(await app.request('/organizations/me/themes', { headers: staff }))).myChoice).toBeNull();
  });

  it('fijado para todos: el resto ya no puede elegir, los administradores sí', async () => {
    const { app, repos } = createTestApp();
    const { id } = await jsonOf<{ id: string }>(await create(app));
    const res = await app.request('/organizations/me/theme-settings', { method: 'PUT', headers: admin, body: JSON.stringify({ defaultTheme: id, enforced: true }) });
    expect(res.status).toBe(200);
    expect(repos.events.map((e) => e.type)).toContain('organization.theme_settings.updated');

    const blocked = await app.request('/organizations/me/theme-choice', { method: 'PUT', headers: staff, body: JSON.stringify({ theme: 'dark' }) });
    expect(blocked.status).toBe(409);
    expect((await jsonOf<{ code: string }>(blocked)).code).toBe('THEME_ENFORCED');
    expect((await app.request('/organizations/me/theme-choice', { method: 'PUT', headers: admin, body: JSON.stringify({ theme: 'dark' }) })).status).toBe(200);
    expect((await jsonOf<State>(await app.request('/organizations/me/themes', { headers: staff }))).settings).toEqual({ defaultTheme: id, enforced: true });
  });

  it('borrar el tema de la empresa la devuelve a claro y sin fijar; quien lo tenía elegido vuelve al de la empresa', async () => {
    const { app, repos } = createTestApp();
    const { id } = await jsonOf<{ id: string }>(await create(app));
    await app.request('/organizations/me/theme-choice', { method: 'PUT', headers: staff, body: JSON.stringify({ theme: id }) });
    await app.request('/organizations/me/theme-settings', { method: 'PUT', headers: admin, body: JSON.stringify({ defaultTheme: id, enforced: true }) });

    expect((await app.request(`/organizations/me/themes/${id}`, { method: 'DELETE', headers: admin })).status).toBe(204);
    expect(repos.events.map((e) => e.type)).toContain('organization.app_theme.deleted');
    const state = await jsonOf<State>(await app.request('/organizations/me/themes', { headers: staff }));
    expect(state).toEqual({ themes: [], settings: { defaultTheme: 'light', enforced: false }, myChoice: null });
  });

  it('editar reemplaza nombre y colores', async () => {
    const { app, repos } = createTestApp();
    const { id } = await jsonOf<{ id: string }>(await create(app));
    const dark: AppThemeConfig = { ...ocean, base: 'dark', colors: { ...ocean.colors, background: '#10161c', surface: '#18222b', text: '#e6edf3' } };
    const res = await app.request(`/organizations/me/themes/${id}`, { method: 'PUT', headers: admin, body: JSON.stringify({ name: 'Océano noche', config: dark }) });
    expect(res.status).toBe(200);
    expect(await jsonOf<{ name: string; config: AppThemeConfig }>(res)).toMatchObject({ name: 'Océano noche', config: dark });
    expect(repos.events.map((e) => e.type)).toContain('organization.app_theme.updated');
  });
});
