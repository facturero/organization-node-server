import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from './sequelize';

export class OrganizationModel extends Model<
  InferAttributes<OrganizationModel>,
  InferCreationAttributes<OrganizationModel>
> {
  declare id: string;
  declare legal_name: string | null;
  declare trade_name: string | null;
  declare tax_id: string | null;
  declare country_code: string | null;
  declare status: 'active' | 'suspended';
  declare settings: unknown | null;
  declare created_at: Date;
  declare updated_at: Date;
}

OrganizationModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    legal_name: { type: DataTypes.STRING(255), allowNull: true },
    trade_name: { type: DataTypes.STRING(255), allowNull: true },
    tax_id: { type: DataTypes.STRING(20), allowNull: true },
    country_code: { type: DataTypes.STRING(2), allowNull: true },
    status: { type: DataTypes.ENUM('active', 'suspended'), allowNull: false, defaultValue: 'active' },
    settings: { type: DataTypes.JSON, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'organizations', timestamps: false },
);

export class EstablishmentModel extends Model<
  InferAttributes<EstablishmentModel>,
  InferCreationAttributes<EstablishmentModel>
> {
  declare id: string;
  declare organization_id: string;
  declare code: string;
  declare name: string;
  declare country_code: string;
  declare address: string | null;
  declare is_main: boolean;
  declare status: 'active' | 'inactive';
  declare created_at: Date;
  declare updated_at: Date;
}

EstablishmentModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    organization_id: { type: DataTypes.CHAR(36), allowNull: false },
    code: { type: DataTypes.STRING(3), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    country_code: { type: DataTypes.STRING(2), allowNull: false },
    address: { type: DataTypes.STRING(255), allowNull: true },
    is_main: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'establishments', timestamps: false },
);

export class EmissionPointModel extends Model<
  InferAttributes<EmissionPointModel>,
  InferCreationAttributes<EmissionPointModel>
> {
  declare id: string;
  declare establishment_id: string;
  declare organization_id: string;
  declare code: string;
  declare name: string | null;
  declare status: 'active' | 'inactive';
  declare created_at: Date;
  declare updated_at: Date;
}

EmissionPointModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    establishment_id: { type: DataTypes.CHAR(36), allowNull: false },
    organization_id: { type: DataTypes.CHAR(36), allowNull: false },
    code: { type: DataTypes.STRING(3), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: true },
    status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'emission_points', timestamps: false },
);

export class OrganizationCountryModel extends Model<
  InferAttributes<OrganizationCountryModel>,
  InferCreationAttributes<OrganizationCountryModel>
> {
  declare id: string;
  declare organization_id: string;
  declare country_code: string;
  declare enabled: boolean;
}

OrganizationCountryModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    organization_id: { type: DataTypes.CHAR(36), allowNull: false },
    country_code: { type: DataTypes.STRING(2), allowNull: false },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'organization_countries', timestamps: false },
);

export class CountryModel extends Model<
  InferAttributes<CountryModel>,
  InferCreationAttributes<CountryModel>
> {
  declare code: string;
  declare name: string | null;
  declare currency_code: string | null;
  declare enabled: boolean;
  declare updated_at: Date;
}

CountryModel.init(
  {
    code: { type: DataTypes.STRING(2), primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: true },
    currency_code: { type: DataTypes.STRING(3), allowNull: true },
    enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'countries', timestamps: false },
);

export class OutboxModel extends Model<
  InferAttributes<OutboxModel>,
  InferCreationAttributes<OutboxModel>
> {
  declare id: string;
  declare aggregate_type: string;
  declare aggregate_id: string;
  declare type: string;
  declare payload: unknown;
  declare occurred_at: Date;
  declare processed_at: Date | null;
}

OutboxModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    aggregate_type: { type: DataTypes.STRING(50), allowNull: false },
    aggregate_id: { type: DataTypes.CHAR(36), allowNull: false },
    type: { type: DataTypes.STRING(100), allowNull: false },
    payload: { type: DataTypes.JSON, allowNull: false },
    occurred_at: { type: DataTypes.DATE, allowNull: false },
    processed_at: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'outbox_messages', timestamps: false },
);

// Asociaciones
OrganizationModel.hasMany(EstablishmentModel, { foreignKey: 'organization_id' });
EstablishmentModel.belongsTo(OrganizationModel, { foreignKey: 'organization_id' });
EstablishmentModel.hasMany(EmissionPointModel, { foreignKey: 'establishment_id' });
EmissionPointModel.belongsTo(EstablishmentModel, { foreignKey: 'establishment_id' });
OrganizationModel.hasMany(OrganizationCountryModel, { foreignKey: 'organization_id' });
OrganizationCountryModel.belongsTo(OrganizationModel, { foreignKey: 'organization_id' });
