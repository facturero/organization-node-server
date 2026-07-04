# organization-service

Dueño del **perfil fiscal y la estructura** de la organización dentro del CRM: **datos fiscales** (razón social, RUC, país), **establecimientos** y **puntos de emisión**. Base propia `organization_db`. Node + TypeScript + Hono + Sequelize (misma plantilla que `auth-service`).

> Parte del monorepo [CRM + Facturación Electrónica](../../README.md). Contrato: [`openapi.yaml`](./openapi.yaml) (REST) y [`asyncapi.yaml`](./asyncapi.yaml) (eventos). Guía de construcción: [`IMPLEMENTATION.md`](./IMPLEMENTATION.md).

## Modelo (Opción A)

- **Aislamiento por `organization_id`** (modelo plano; no hay nivel `tenant`/grupo — es evolución futura).
- **La organización ya existe cuando este servicio la toca.** `auth-service` genera el `organization_id` y crea al fundador (usuario + rol Administrador) al **registrarse**. Este servicio es dueño del **perfil** de esa organización, identificada por el `organization_id` que llega en `X-Organization-Id`. **No** genera ids nuevos ni siembra roles.
- **No verifica JWT.** Confía en las cabeceras del gateway: `X-Organization-Id`, `X-User-Id`, `X-Country-Code`, `X-Permissions`.

## Onboarding (dónde encaja)

```
register (auth)               → user + organización (id) + rol Administrador
   └─ el usuario ya tiene org_id, pero sin datos fiscales
PUT /organizations/me (aquí)  → razón social + RUC + país
   ├─ 1.ª vez: crea establecimiento 001 (matriz) + punto de emisión 001
   ├─ emite organization.org.updated        → auth actualiza el country_code del token
   └─ emite organization.billing_point.created → billing inicializa el secuencial
```

## Endpoints

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/health` | — |
| GET | `/organizations/me` | `organization:read` |
| PUT | `/organizations/me` | `organization:update` (completar/actualizar perfil fiscal) |
| PATCH | `/organizations/me` | `organization:update` (nombre/settings) |
| GET | `/organizations/me/countries` | `organization:read` |
| POST | `/organizations/me/countries` | `organization:update` |
| GET | `/establishments` | `establishment:read` |
| POST | `/establishments` | `establishment:create` |
| PATCH | `/establishments/:id` | `establishment:update` |
| GET | `/establishments/:id/billing-points` | `establishment:read` |
| POST | `/establishments/:id/billing-points` | `establishment:create` |

Todas (salvo `/health`) exigen `X-Organization-Id`. El aislamiento por organización se aplica en cada consulta; operar sobre un recurso de otra organización responde `404`. Detalle completo en [`openapi.yaml`](./openapi.yaml).

## Eventos (Outbox)

Se escriben en `outbox_messages` (el relay a RabbitMQ es infraestructura compartida, pendiente). Namespace `organization.*`:

| Evento | Cuándo | Consumido por |
|--------|--------|---------------|
| `organization.org.updated` | Perfil creado/actualizado | auth (country_code del token), billing (snapshot) |
| `organization.establishment.created` | Nuevo establecimiento | billing |
| `organization.billing_point.created` | Nuevo punto de emisión | billing (inicializa secuencial) |

**Consume:** `tax.country.enabled` → read-model `countries`. Hay un seed que deja **EC habilitado** para probar sin tax-service. Contrato en [`asyncapi.yaml`](./asyncapi.yaml).

> Nota: **no** se emite `organization.org.created` — la organización la crea auth-service al registrar al fundador.

## Requisitos

- Node ≥ 20, MySQL ≥ 8 con la base `organization_db`.

## Puesta en marcha

```bash
npm install
cp .env.example .env       # credenciales de organization_db
npm run db:migrate         # crea tablas + habilita EC (seed)
npm run dev                # tsx watch, puerto 3002
npm run build && npm start # producción
npm test                   # vitest (unit, sin DB)
npm run typecheck
```

## Estructura

Clean Architecture (layer-first), igual que `auth-service`: `domain/` (entidades, value objects `CountryCode`/`TaxId`, errores, repos) ← `application/` (casos de uso, `UnitOfWork`, dtos) ← `infrastructure/` (config, persistencia Sequelize, Outbox) / `interface/http/` (Hono: contexto + `requirePermission`). Composition root en `src/main.ts`.
