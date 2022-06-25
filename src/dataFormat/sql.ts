import {
  DataFormat,
  DataFormatDeclaration,
  DataFormatDeclarations,
  DataFormatField,
  DataType,
  DateDataSubType,
  ExtractDataFormatFieldNames,
  JsonDataSubType,
  NumberDataSubType,
  StringDataSubType,
  ThreeStepNumberSize,
  TwoStepNumberSize,
} from './types'
import { camelCaseToSnakeCase } from '../helpers/string'
import { ReadonlyOrMutable } from '../helpers/types'
import { Relation, RelationType } from '../relations/types'

const createBooleanColumnSql = (dataFormatField: DataFormatField<DataType.BOOLEAN>, isUnique: boolean): string => {
  const columnName = camelCaseToSnakeCase(dataFormatField.name)

  return [
    `${columnName} boolean`,
    dataFormatField.allowNull ? '' : 'not null',
    isUnique ? 'unique' : '',
    dataFormatField.default != null
      ? dataFormatField.default
        ? 'default true'
        : 'default false'
      : '',
  ].filter(s => s.length > 0).join(' ')
}

const createNumberColumnSql = (dataFormatField: DataFormatField<DataType.NUMBER>, isUnique: boolean): string => {
  const columnName = camelCaseToSnakeCase(dataFormatField.name)
  const size = dataFormatField.size
    ?? (dataFormatField.dataSubType === NumberDataSubType.REAL
      ? TwoStepNumberSize.REGULAR
      : ThreeStepNumberSize.REGULAR
    )
  const typeName = {
    [NumberDataSubType.INTEGER]: {
      [ThreeStepNumberSize.SMALL]: 'smallint',
      [ThreeStepNumberSize.REGULAR]: 'integer',
      [ThreeStepNumberSize.LARGE]: 'bigint',
    },
    [NumberDataSubType.REAL]: {
      [TwoStepNumberSize.REGULAR]: 'real',
      [TwoStepNumberSize.LARGE]: 'double precision',
    },
    [NumberDataSubType.SERIAL]: {
      [ThreeStepNumberSize.SMALL]: 'smallserial',
      [ThreeStepNumberSize.REGULAR]: 'serial',
      [ThreeStepNumberSize.LARGE]: 'bigserial',
    },
  }[dataFormatField.dataSubType][size]

  const isSerial = dataFormatField.dataSubType === NumberDataSubType.SERIAL

  return [
    `${columnName} ${typeName}`,
    // Not null text
    isSerial
      ? ''
      : (dataFormatField.allowNull ?? true)
        ? ''
        : 'not null',
    // Serial text
    isSerial ? 'primary key' : '',
    isUnique ? 'unique' : '',
    // Default text
    !isSerial
      ? dataFormatField.default != null
        ? `default ${dataFormatField.default}`
        : ''
      : '',
  ].filter(s => s.length > 0).join(' ')
}

const getStringColumnTypeName = (field: DataFormatField<DataType.STRING>): string => {
  switch (field.dataSubType) {
    case StringDataSubType.VARYING_LENGTH:
      return `character varying(${field.maxLength})`
    case StringDataSubType.FIXED_LENGTH:
      return `character(${field.length})`
    case StringDataSubType.STRING_ENUM:
      return `character varying(${field.maxLength ?? 100})`
    case StringDataSubType.UUID_V4:
      return 'character(36)'
    case StringDataSubType.SHA_256:
      return 'character(44)'
    default:
      return null
  }
}

const createStringColumnSql = (field: DataFormatField<DataType.STRING>, isUnique: boolean): string => {
  const columnName = camelCaseToSnakeCase(field.name)
  const typeName = getStringColumnTypeName(field)

  const isAutoGenerated = field.dataSubType === StringDataSubType.UUID_V4 && (field.autoGenerate ?? true)

  return [
    `${columnName} ${typeName}`,
    // Not null text
    (field.allowNull ?? false) ? '' : 'not null',
    // Default text
    field.default != null ? `default '${field.default}'` : '',
    // Uuid text
    isAutoGenerated
      ? 'unique default uuid_generate_v4()'
      : isUnique
        ? 'unique'
        : '',
  ].filter(s => s.length > 0).join(' ')
}

const createDateColumnSql = (dataFormatField: DataFormatField<DataType.DATE>, isUnique: boolean): string => {
  const columnName = camelCaseToSnakeCase(dataFormatField.name)
  const typeName = {
    [DateDataSubType.DATE_TIME_WITH_TIMEZONE]: 'timestamp with time zone',
    [DateDataSubType.DATE_TIME]: 'timestamp',
    [DateDataSubType.DATE]: 'date',
    [DateDataSubType.TIME]: 'time',
  }[dataFormatField.dataSubType]

  return [
    `${columnName} ${typeName}`,
    // Not null text
    (dataFormatField.allowNull ?? true) ? '' : 'not null',
    isUnique ? 'unique' : '',
    // Default text
    dataFormatField.defaultToCurrentEpoch
      ? 'default CURRENT_TIMESTAMP'
      : dataFormatField.default != null
        ? `default ${dataFormatField.default}`
        : '',
  ].filter(s => s.length > 0).join(' ')
}

const createJsonColumnSql = (dataFormatField: DataFormatField<DataType.JSON>, isUnique: boolean): string => {
  const columnName = camelCaseToSnakeCase(dataFormatField.name)

  return [
    `${columnName} jsonb`,
    // Not null text
    (dataFormatField.allowNull ?? !(dataFormatField.dataSubType === JsonDataSubType.ARRAY)) ? '' : 'not null',
    isUnique ? 'unique' : '',
    // Default text
    dataFormatField.default != null
      ? `default '${JSON.stringify(dataFormatField.default)}'::jsonb`
      : dataFormatField.dataSubType === JsonDataSubType.ARRAY
        ? 'default \'[]\'::jsonb'
        : '',
  ].filter(s => s.length > 0).join(' ')
}

const createColumnSql = (dataFormatField: DataFormatField, isUnique: boolean): string => {
  switch (dataFormatField.dataType) {
    case DataType.NUMBER:
      return createNumberColumnSql(dataFormatField, isUnique)
    case DataType.BOOLEAN:
      return createBooleanColumnSql(dataFormatField, isUnique)
    case DataType.STRING:
      return createStringColumnSql(dataFormatField, isUnique)
    case DataType.DATE:
      return createDateColumnSql(dataFormatField, isUnique)
    case DataType.JSON:
      return createJsonColumnSql(dataFormatField, isUnique)
    default:
      return null
  }
}

const createColumnsSql = (
  dataFormatFields: ReadonlyOrMutable<DataFormatField[]>,
  oneToOneRelations: Relation<DataFormatDeclarations, RelationType.ONE_TO_ONE>[],
): string => (
  dataFormatFields
    .map(f => createColumnSql(f, oneToOneRelations.some(r => r.toOneField.fieldName === f.name)))
    .join(',\n  ')
)

const createForeignKeysSql = (
  relations: Relation<DataFormatDeclarations, RelationType.ONE_TO_MANY | RelationType.ONE_TO_ONE>[],
): string => (
  relations
    .map(r => r.sql.foreignKeySql)
    .join(',\n')
)

export const convertDataFormatDeclarationToCreateTableSql = (
  dataFormatDeclaration: DataFormatDeclaration,
  relations?: Relation<DataFormatDeclarations, RelationType.ONE_TO_MANY | RelationType.ONE_TO_ONE>[],
) => {
  const tableName = camelCaseToSnakeCase(dataFormatDeclaration.name)

  const oneToOneRelations = relations
    ?.filter(r => r.type === RelationType.ONE_TO_ONE) as Relation<DataFormatDeclarations, RelationType.ONE_TO_ONE>[] ?? []
  const columnsSql = createColumnsSql(dataFormatDeclaration.fields, oneToOneRelations)
  const foreignKeysSql = relations != null ? createForeignKeysSql(relations) : ''

  /* eslint-disable indent */
  return `
create table if not exists public."${tableName}"
(
  ${
    [
      columnsSql,
      foreignKeysSql,
    ].filter(s => s != null && s.length > 0).join(',\n')
  }
)

tablespace pg_default;

alter table if exists public."${tableName}"
  owner to postgres;
  `
  /* eslint-enable indent */
}

export const createValueList = <T extends DataFormatDeclaration>(df: DataFormat<T>, options: any, fieldNames: ExtractDataFormatFieldNames<T>[]) => (
  fieldNames.map(fieldName => {
    const value = options[fieldName]
    if (df.fields[fieldName].dataType === DataType.JSON)
      return JSON.stringify(value)
    return value
  })
)
