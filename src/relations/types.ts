import { ExpandRecursively, TypeDependantBaseIntersection, DeepReadonly, ValuesUnionFromDict } from '../helpers/types'
import { DataFormatDeclarations, DataFormat } from '../dataFormat/types'

export enum RelationType {
  /**
   * One item of this format relates to one item of another format.
   *
   * For example, user <-> userAddress is a one-to-one relation since one
   * user is related to only one user address and one user address is related
   * to only one user.
   *
   * Local field: unique
   *
   * Foreign field: unique
   */
  ONE_TO_ONE,
  /**
   * One item of this format relates to multiple items on another format.
   *
   * For example, customer <-->> customerOrders is a one-to-many relation
   * since a customer can have multiple orders, but an order is owned by only
   * one customer.
   *
   * Local field: unique
   *
   * Foreign field: not unique
   */
  ONE_TO_MANY,
  /**
   * Multiple items of this format relates to multiple items of another format.
   *
   * For example, user <<-->> userGroup is a many-to-many relation since multiple
   * users can be related to one user group and multiple user groups can be related
   * to one user.
   *
   * Note: Many-to-many relations require a join (a.k.a "junction"/"mapping") table.
   * Use `createJoinTables` to create them once the relations have been loaded into
   * the TsPgOrm instance.
   */
  MANY_TO_MANY,
}

type ExtractAvailableFieldRefs<T extends DataFormatDeclarations> = ExpandRecursively<ValuesUnionFromDict<{
  [K in T[number]['name']]: ValuesUnionFromDict<DataFormat<Extract<T[number], { name: K }>>['fieldRefs']>
}>>

type MutableRelationDeclaration<
  T extends DataFormatDeclarations,
  K extends RelationType = RelationType,
> = TypeDependantBaseIntersection<RelationType, {
  [RelationType.ONE_TO_ONE]: {
    fromOneField: ExtractAvailableFieldRefs<T>
    toOneField: ExtractAvailableFieldRefs<T>
    /**
     * The related data property name of `toOneField` records that are related to `fromOneField` record(s).
     */
    relatedFromOneRecordsName?: string
    /**
     * The related data property name of `fromOneField` records that are related to `toOneField` record(s).
     */
    relatedToOneRecordsName?: string
  },
  [RelationType.ONE_TO_MANY]: {
    fromOneField: ExtractAvailableFieldRefs<T>
    toManyField: ExtractAvailableFieldRefs<T>
    /**
     * The related data property name of `toManyField` records that are related to `fromOneField` record(s).
     */
    relatedFromOneRecordsName?: string
    /**
     * The related data property name of `fromOneField` records that are related to `toManyField` record(s).
     */
    relatedToManyRecordsName?: string
  },
  [RelationType.MANY_TO_MANY]: {
    /**
     * Determines whether the join (a.k.a. "junction") table will have a `dateCreated` field (i.e. a
     * `date_created` column).
     *
     * @default false
     */
    includeDateCreated?: boolean
    fieldRef1: ExtractAvailableFieldRefs<T>
    fieldRef2: ExtractAvailableFieldRefs<T>
    /**
     * The related data property name of `fieldRef1` records that are related to `fieldRef2` record(s).
     */
    relatedFieldRef1RecordsName?: string
    /**
     * The related data property name of `fieldRef2` records that are related to `fieldRef1` record(s).
     */
    relatedFieldRef2RecordsName?: string
    /**
     * Determines if "ON UPDATE NO ACTION" is added for the `fieldRef1` foreign constraint.
     *
     * @default true
     */
    fieldRef1OnUpdateNoAction?: boolean
    /**
     * Determines if "ON DELETE NO ACTION" is added for the `fieldRef1` foreign constraint.
     *
     * @default true
     */
    fieldRef1OnDeleteNoAction?: boolean
    /**
     * Determines if "ON UPDATE NO ACTION" is added for the `fieldRef2` foreign constraint.
     *
     * @default true
     */
    fieldRef2OnUpdateNoAction?: boolean
    /**
     * Determines if "ON DELETE NO ACTION" is added for the `fieldRef2` foreign constraint.
     *
     * @default true
     */
    fieldRef2OnDeleteNoAction?: boolean
    /**
     * Alternative name to use for the store that will represent the underlying join (a.k.a. "junction")
     * table.
     */
    joinTableStoreName?: string
  },
}, K>

export type RelationDeclaration<
  T extends DataFormatDeclarations = DataFormatDeclarations,
  K extends RelationType = RelationType
> = DeepReadonly<MutableRelationDeclaration<T, K>>

export type RelationDeclarations<T extends DataFormatDeclarations = DataFormatDeclarations> = Readonly<RelationDeclaration<T>[]>

export type ToRelationName<
  K extends RelationDeclaration
> = {
  [RelationType.MANY_TO_MANY]: K extends { type: RelationType.MANY_TO_MANY } ? `${K['fieldRef1']['formatName']}.${K['fieldRef1']['fieldName']} <<-->> ${K['fieldRef2']['formatName']}.${K['fieldRef2']['fieldName']}` : never
  [RelationType.ONE_TO_MANY]: K extends { type: RelationType.ONE_TO_MANY } ? `${K['fromOneField']['formatName']}.${K['fromOneField']['fieldName']} <-->> ${K['toManyField']['formatName']}.${K['toManyField']['fieldName']}` : never
  [RelationType.ONE_TO_ONE]: K extends { type: RelationType.ONE_TO_ONE } ? `${K['fromOneField']['formatName']}.${K['fromOneField']['fieldName']} <--> ${K['toOneField']['formatName']}.${K['toOneField']['fieldName']}` : never
}[K['type']]

export type ExtractLocalFieldRefFromRelation<
  K extends RelationDeclaration,
  // The local data format name
  L extends string
> = {
  [RelationType.MANY_TO_MANY]: K extends { type: RelationType.MANY_TO_MANY }
    ? K['fieldRef1']['formatName'] extends L
      ? K['fieldRef1']
      : K['fieldRef2']
    : never
  [RelationType.ONE_TO_MANY]: K extends { type: RelationType.ONE_TO_MANY }
    ? K['fromOneField']['formatName'] extends L
      ? K['fromOneField']
      : K['toManyField']
    : never
  [RelationType.ONE_TO_ONE]: K extends { type: RelationType.ONE_TO_ONE }
    ? K['fromOneField']['formatName'] extends L
      ? K['fromOneField']
      : K['toOneField']
    : never
}[K['type']]

export type IsForeignFormatPluralFromRelation<
  K extends RelationDeclaration,
  // The local data format name
  L extends string
> = {
  [RelationType.MANY_TO_MANY]: true
  [RelationType.ONE_TO_MANY]: K extends { type: RelationType.ONE_TO_MANY }
    ? K['fromOneField']['formatName'] extends L
      ? true
      : false
    : never
  [RelationType.ONE_TO_ONE]: false
}[K['type']]

export type ExtractForeignFieldRefFromRelation<
  K extends RelationDeclaration,
  // The local data format name
  L extends string
> = {
  [RelationType.MANY_TO_MANY]: K extends { type: RelationType.MANY_TO_MANY }
    ? K['fieldRef1']['formatName'] extends L
      ? K['fieldRef2']
      : K['fieldRef1']
    : never
  [RelationType.ONE_TO_MANY]: K extends { type: RelationType.ONE_TO_MANY }
    ? K['fromOneField']['formatName'] extends L
      ? K['toManyField']
      : K['fromOneField']
    : never
  [RelationType.ONE_TO_ONE]: K extends { type: RelationType.ONE_TO_ONE }
    ? K['fromOneField']['formatName'] extends L
      ? K['toOneField']
      : K['fromOneField']
    : never
}[K['type']]

export type ExtractForeignFieldNameFromRelation<
  K extends RelationDeclaration,
  // The local data format name
  L extends string
> = ExtractForeignFieldRefFromRelation<K, L>['fieldName']

export type ExtractForeignFormatNameFromRelation<
  K extends RelationDeclaration,
  // The local data format name
  L extends string
> = ExtractForeignFieldRefFromRelation<K, L>['formatName']

type RelationSqlProperties<
  T extends RelationType = RelationType,
> = TypeDependantBaseIntersection<RelationType, {
  [RelationType.ONE_TO_ONE]: {
    sql: {
      foreignKeySql: string
    }
  },
  [RelationType.ONE_TO_MANY]: {
    sql: {
      foreignKeySql: string
    }
  },
  [RelationType.MANY_TO_MANY]: {
    sql: {
      createJoinTableSql: string
      joinTableName: string
      joinTableFieldRef1ColumnName: string
      joinTableFieldRef2ColumnName: string
      dropJoinTableSql: string
    }
  },
}, T>

export type Relation<
  T extends DataFormatDeclarations = DataFormatDeclarations,
  K extends RelationType = RelationType,
  L extends RelationDeclaration<T, K> = RelationDeclaration<T, K>
> = L & RelationSqlProperties<K> & { relationName: ToRelationName<L> }

export type RelationsDict<
  T extends DataFormatDeclarations = DataFormatDeclarations,
  K extends RelationDeclarations<T> = RelationDeclarations<T>,
> = {
  [K1 in keyof K & `${bigint}` as K[K1] extends infer TRelationDeclaration
    ? ToRelationName<TRelationDeclaration & RelationDeclaration<T>>
    : never
  // @ts-ignore
  ]: K[K1] extends RelationDeclaration<T> ? Relation<T, K[K1]['type'], K[K1]> : never
}

export type RelationsList<T extends DataFormatDeclarations, K extends RelationDeclarations<T>> = {
  // @ts-ignore
  [K1 in keyof K & `${bigint}`]: K[K1] extends RelationDeclaration<T> ? Relation<T, K[K1]['type'], K[K1]> : never
}

/**
 * Extracts the relations that are relevant to the given data format declaration name.
 *
 * A relation is relevant when the given data format declaration name features in either
 * of the sides of the relation.
 */
export type ExtractRelevantRelations<T extends string, K extends RelationDeclarations> =
  Extract<K[number], { fromOneField: { formatName: T } }>
    | Extract<K[number], { toOneField: { formatName: T } }>
    | Extract<K[number], { toManyField: { formatName: T } }>
    | Extract<K[number], { fieldRef1: { formatName: T } }>
    | Extract<K[number], { fieldRef2: { formatName: T } }>

/**
* Extracts the relations that are relevant to the given data format declaration name,
* where the given data format is the "from one" in the relations.
*/
export type ExtractRelevantRelationsWithOneToOneFromOne<T extends string, K extends RelationDeclarations> =
Extract<ExtractRelevantRelations<T, K>, { type: RelationType.ONE_TO_ONE, fromOneField: { formatName: T } }>

/**
* Extracts the relations that are relevant to the given data format declaration name,
* where the given data format is the "to one" in the relations.
*/
export type ExtractRelevantRelationsWithOneToOneToOne<T extends string, K extends RelationDeclarations> =
  Extract<ExtractRelevantRelations<T, K>, { type: RelationType.ONE_TO_ONE, toOneField: { formatName: T } }>

/**
* Extracts the relations that are relevant to the given data format declaration name,
* where the given data format is the "from one" in the relations.
*/
export type ExtractRelevantRelationsWithOneToManyFromOne<T extends string, K extends RelationDeclarations> =
  Extract<ExtractRelevantRelations<T, K>, { type: RelationType.ONE_TO_MANY, fromOneField: { formatName: T } }>

/**
* Extracts the relations that are relevant to the given data format declaration name,
* where the given data format is the "to many" in the relations.
*/
export type ExtractRelevantRelationsWithOneToManyToMany<T extends string, K extends RelationDeclarations> =
  Extract<ExtractRelevantRelations<T, K>, { type: RelationType.ONE_TO_MANY, toManyField: { formatName: T } }>

/**
* Extracts the relations that are relevant to the given data format declaration name,
* where the given data format is the "fieldRef1" in the relations.
*/
export type ExtractRelevantRelationsWithManyToManyFieldRef1<T extends string, K extends RelationDeclarations> =
  Extract<ExtractRelevantRelations<T, K>, { type: RelationType.MANY_TO_MANY, fieldRef1: { formatName: T } }>

/**
* Extracts the relations that are relevant to the given data format declaration name,
* where the given data format is the "fieldRef2" in the relations.
*/
export type ExtractRelevantRelationsWithManyToManyFieldRef2<T extends string, K extends RelationDeclarations> =
  Extract<ExtractRelevantRelations<T, K>, { type: RelationType.MANY_TO_MANY, fieldRef2: { formatName: T } }>

export type ExtractManyToManyRelations<T extends RelationDeclarations> =
  Extract<T[number], { type: RelationType.MANY_TO_MANY }>

export type ExtractRelationNamesOfManyToManyRelations<T extends RelationDeclarations> =
  ToRelationName<ExtractManyToManyRelations<T>>
// --

export type ExtractRelevantRelationNamesWithOneToOneFromOne<T extends string, K extends RelationDeclarations> =
  ToRelationName<ExtractRelevantRelationsWithOneToOneFromOne<T, K>>

export type ExtractRelevantRelationNamesWithOneToOneToOne<T extends string, K extends RelationDeclarations> =
  ToRelationName<ExtractRelevantRelationsWithOneToOneToOne<T, K>>

export type ExtractRelevantRelationNamesWithOneToManyFromOne<T extends string, K extends RelationDeclarations> =
  ToRelationName<ExtractRelevantRelationsWithOneToManyFromOne<T, K>>

export type ExtractRelevantRelationNamesWithOneToManyToMany<T extends string, K extends RelationDeclarations> =
  ToRelationName<ExtractRelevantRelationsWithOneToManyToMany<T, K>>

export type ExtractRelevantRelationNamesWithManyToManyFieldRef1<T extends string, K extends RelationDeclarations> =
  ToRelationName<ExtractRelevantRelationsWithManyToManyFieldRef1<T, K>>

export type ExtractRelevantRelationNamesWithManyToManyFieldRef2<T extends string, K extends RelationDeclarations> =
  ToRelationName<ExtractRelevantRelationsWithManyToManyFieldRef2<T, K>>

export type ExtractRelevantRelationNames<T extends string, K extends RelationDeclarations> =
  ToRelationName<ExtractRelevantRelations<T, K>>
