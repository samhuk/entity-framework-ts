import {
  DataFormatDeclaration,
  ExtractDataFormatFieldNames,
  DataFormat,
  FieldRefsDict,
  DataType,
  NumberDataSubType,
  StringDataSubType,
  CreateRecordFieldNames,
  CreateRecordOptions,
  DataFormatSqlInfo,
  CapitalizedFieldNames,
} from './types'
import { toDictReadonly } from '../helpers/dict'
import { camelCaseToSnakeCase, capitalize } from '../helpers/string'
import { convertDataFormatDeclarationToCreateTableSql } from './sql'
import { createSampleData } from './sampleData'
import { COMMON_FIELDS } from './common'

type ToFieldsDict<T extends DataFormatDeclaration> = (
  { [fieldName in T['fields'][number]['name']]: Extract<T['fields'][number], { name: fieldName }> }
)

const createSelectSqlBase = <T extends DataFormatDeclaration>(
  declaration: T,
  columnNames: { [fieldName in ExtractDataFormatFieldNames<T>]: string },
  fieldNames?: ExtractDataFormatFieldNames<T>[],
): string => {
  const columns = fieldNames?.map(fieldName => columnNames[fieldName]).join(', ') ?? '*'
  const tableName = camelCaseToSnakeCase(declaration.name)
  return `select ${columns} from "${tableName}"`
}

/**
 * Parses the given data format declaration, enriching it with additional information
 * and exposing functions for the purpose of extracting information from it.
 */
export const createDataFormat = <T extends DataFormatDeclaration>(
  dataFormatDeclaration: T,
): Readonly<DataFormat<T>> => {
  type FieldNames = ExtractDataFormatFieldNames<T>
  type FieldsDict = ToFieldsDict<T>

  // Create field name to field name dict
  const fieldNamesDict = toDictReadonly(dataFormatDeclaration.fields, f => ({
    key: f.name,
    value: f.name,
  })) as { [fieldName in FieldNames]: fieldName }
  const fieldNameList = dataFormatDeclaration.fields.map(f => f.name) as FieldNames[]
  // Create field name to field ref dict
  const fieldRefsDict = toDictReadonly(dataFormatDeclaration.fields, f => ({
    key: f.name,
    value: {
      formatName: dataFormatDeclaration.name,
      fieldName: f.name,
    },
  })) as FieldRefsDict<T>
  // Create field name to field dict. Using "as" here since we *will* make it a FieldsDict just below. We promise.
  const fields: FieldsDict = { } as FieldsDict
  // TODO: Although f.name is always (obviously) going to be a key in "dfd.fields", TS doesn't see it...
  // @ts-ignore
  dataFormatDeclaration.fields.forEach(f => fields[f.name] = f)

  // Create record field names list
  const createRecordFieldNames = dataFormatDeclaration.fields.filter(f => {
    if (f.dataType === DataType.NUMBER && f.dataSubType === NumberDataSubType.SERIAL)
      return false
    if (f.dataType === DataType.STRING && f.dataSubType === StringDataSubType.UUID_V4 && (f.autoGenerate ?? true))
      return false
    if (f.dataType === DataType.DATE && (f.defaultToCurrentEpoch ?? false))
      return false
    return true
  /* Using "as" here as we need to convince TS that all the operations above do
   * indeed yield CreateRecordFieldNames<T>. We promise.
   */
  }).map(f => f.name) as CreateRecordFieldNames<T>

  // -- PostgreSql
  // Create field name to column name dict
  const columnNamesDict = toDictReadonly(dataFormatDeclaration.fields, f => ({
    key: f.name,
    value: camelCaseToSnakeCase(f.name),
  })) as { [fieldName in FieldNames]: string }
  const columnNameList = Object.values(columnNamesDict) as string[]
  // Create table name
  const tableName = `"${camelCaseToSnakeCase(dataFormatDeclaration.name)}"`

  const fieldSubSetSelectSqlBases = {} as any

  dataFormatDeclaration.fieldSubSets?.forEach(fss => {
    const columnsSql = fss.fields.map(fname => `${tableName}.${(columnNamesDict as any)[fname]}`).join(', ')
    fieldSubSetSelectSqlBases[fss.name] = `select ${columnsSql} from ${tableName}`
  })

  const sql: DataFormatSqlInfo<T> = {
    tableName,
    columnNames: columnNamesDict,
    createCreateTableSql: relations => convertDataFormatDeclarationToCreateTableSql(dataFormatDeclaration, relations),
    columnNameList,
    selectSqlBase: createSelectSqlBase(dataFormatDeclaration, columnNamesDict),
    updateSqlBase: `update ${tableName} set`,
    deleteSqlBase: `delete from ${tableName}`,
    fieldSubSetSelectSqlBases,
  }

  const pluralizedName = dataFormatDeclaration.pluralizedName ?? `${dataFormatDeclaration.name}s` as any

  const capitalizedFieldNames = toDictReadonly(
    dataFormatDeclaration.fields,
    f => ({ key: f.name, value: capitalize(f.name) }),
  ) as CapitalizedFieldNames<T>

  return {
    name: dataFormatDeclaration.name,
    capitalizedName: capitalize(dataFormatDeclaration.name) as any,
    pluralizedName,
    capitalizedPluralizedName: capitalize(pluralizedName) as any,
    declaration: dataFormatDeclaration,
    fields,
    fieldNames: fieldNamesDict,
    fieldNameList,
    fieldNamesWithEnabledGetByList: fieldNameList.filter(fname => fields[fname].enableGetBy ?? false),
    fieldNamesWithEnabledDeleteByList: fieldNameList.filter(fname => fields[fname].enableDeleteBy ?? false),
    capitalizedFieldNames,
    sql,
    fieldRefs: fieldRefsDict,
    createRecordFieldNames,
    createRandomCreateOptions: () => {
      const record = {} as CreateRecordOptions<T>
      createRecordFieldNames.forEach(fname => {
        if (fname === COMMON_FIELDS.dateDeleted.name)
          return

        // Although fname is always going to be a key in "fields", TS doesn't see it.
        (record as any)[fname] = createSampleData(fields[fname])
      })
      return record
    },
  }
}

export const createDataFormatDeclaration = <T extends DataFormatDeclaration>(d: T): T => d
