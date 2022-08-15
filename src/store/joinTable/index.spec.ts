import { createJoinTableStoresDict } from '.'
import { filterForManyToManyRelations } from '../..'
import { createMockDbService } from '../../mock/dbService'
import { tsPgOrm } from '../../testData'

describe('joinTable', () => {
  describe('create', () => {
    test('basic test', async () => {
      const db = createMockDbService()
      const manyToManyRelationsList = filterForManyToManyRelations(tsPgOrm.relations)
      const joinStoresDict = createJoinTableStoresDict<
        typeof tsPgOrm['dataFormatDeclarations'],
        typeof tsPgOrm['relationDeclarations']
      >(tsPgOrm.dataFormats, manyToManyRelationsList as any, db)

      db.queueResponse({
        id: 1,
        user_id: 2,
        user_group_id: 3,
      })

      const newJoinTableRecord = await joinStoresDict['user.id <<-->> userGroup.id'].create({ userId: 2, userGroupId: 3 })

      expect(newJoinTableRecord).toEqual({
        id: 1,
        userId: 2,
        userGroupId: 3,
      })

      expect(db.receivedQueries.length).toBe(1)
      expect(db.receivedQueries[0]).toEqual({
        parameters: [2, 3],
        sql: `insert into user_to_user_group
(user_id, user_group_id)
values ($1, $2) returning *`,
      })
    })
  })

  describe('createMultiple', () => {
    test('basic test', async () => {
      const db = createMockDbService()
      const manyToManyRelationsList = filterForManyToManyRelations(tsPgOrm.relations)
      const joinStoresDict = createJoinTableStoresDict<
        typeof tsPgOrm['dataFormatDeclarations'],
        typeof tsPgOrm['relationDeclarations']
      >(tsPgOrm.dataFormats, manyToManyRelationsList as any, db)

      db.queueResponse(true)

      await joinStoresDict['user.id <<-->> userGroup.id'].createMultiple([
        { userId: 2, userGroupId: 3 },
        { userId: 3, userGroupId: 4 },
        { userId: 4, userGroupId: 5 },
      ])

      expect(db.receivedQueries.length).toBe(1)
      expect(db.receivedQueries[0]).toEqual({
        parameters: [2, 3, 3, 4, 4, 5],
        sql: `insert into user_to_user_group
(user_id, user_group_id)
values ($1, $2) returning *;
insert into user_to_user_group
(user_id, user_group_id)
values ($3, $4) returning *;
insert into user_to_user_group
(user_id, user_group_id)
values ($5, $6) returning *`,
      })
    })
  })

  describe('deleteById', () => {
    test('basic test', async () => {
      const db = createMockDbService()
      const manyToManyRelationsList = filterForManyToManyRelations(tsPgOrm.relations)
      const joinStoresDict = createJoinTableStoresDict<
        typeof tsPgOrm['dataFormatDeclarations'],
        typeof tsPgOrm['relationDeclarations']
      >(tsPgOrm.dataFormats, manyToManyRelationsList as any, db)

      db.queueResponse({
        id: 1,
        user_id: 2,
        user_group_id: 3,
      })

      const newJoinTableRecord = await joinStoresDict['user.id <<-->> userGroup.id'].deleteById({ id: 2, return: true })

      expect(newJoinTableRecord).toEqual({
        id: 1,
        userId: 2,
        userGroupId: 3,
      })

      expect(db.receivedQueries.length).toBe(1)
      expect(db.receivedQueries[0]).toEqual({
        parameters: [2],
        sql: 'delete from user_to_user_group where id = $1 returning *',
      })
    })
  })
})
