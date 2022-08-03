import { Operator } from '@samhuk/data-filter/dist/types'
import { SortingDirection } from '@samhuk/data-query/dist/sorting/types'
import { createStore } from '.'
import { createMockDbService } from '../mock/dbService'
import { tsPgOrm } from '../testData'

describe('store', () => {
  describe('createStore', () => {
    const fn = createStore

    test('getSingle', async () => {
      const db = createMockDbService()
      db.queueResponses([
        // The user
        { id: 1, name: 'foo' },
        // The recipes of the user
        [
          { created_by_user_id: 1, image_id: 1, title: 'recipe 1' },
          { created_by_user_id: 1, image_id: 2, title: 'recipe 2' },
          { created_by_user_id: 1, image_id: 3, title: 'recipe 3' },
        ],
        // The image and user of each recipe, interlaced
        { file_name: 'foo' },
        { id: 1, name: 'foo' },
        { file_name: 'bar' },
        { id: 1, name: 'foo' },
        { file_name: 'fizz' },
        { id: 1, name: 'foo' },
      ])
      const store = fn(db, tsPgOrm, 'user')
      const result = await store.getSingle({
        fields: ['name'],
        relations: {
          recipes: {
            fields: ['title'],
            query: { page: 1, pageSize: 2, sorting: [{ field: 'id', dir: SortingDirection.DESC }] },
            relations: {
              image: {
                fields: ['fileName'],
              },
              user: { },
            },
          },
        },
      })

      expect(result).toEqual({
        name: 'foo',
        recipes: [
          {
            title: 'recipe 1',
            image: { fileName: 'foo' },
            user: { id: 1, name: 'foo' },
          },
          {
            title: 'recipe 2',
            image: { fileName: 'bar' },
            user: { id: 1, name: 'foo' },
          },
          {
            title: 'recipe 3',
            image: { fileName: 'fizz' },
            user: { id: 1, name: 'foo' },
          },
        ],
      })

      expect(db.receivedQueries[0]).toEqual(
        { parameters: undefined, sql: 'select "user"."name", "user"."id" from "user"  limit 1' },
      )
      expect(db.receivedQueries[1]).toEqual({ parameters: [1], sql: `select
"recipe"."title", "recipe"."created_by_user_id", "recipe"."image_id"
from "recipe"
where "recipe".created_by_user_id = $1 order by id desc limit 2 offset 0` })
      expect(db.receivedQueries[2]).toEqual({ parameters: [1], sql: `select
"image"."file_name", "image"."id", "image"."created_by_user_id"
from "image"
where "image".id = $1 limit 1` })
      expect(db.receivedQueries[3]).toEqual({ parameters: [1], sql: `select
"user"."id", "user"."name"
from "user"
where "user".id = $1 limit 1` })
      expect(db.receivedQueries[4]).toEqual({ parameters: [2], sql: `select
"image"."file_name", "image"."id", "image"."created_by_user_id"
from "image"
where "image".id = $1 limit 1` })
      expect(db.receivedQueries[5]).toEqual({ parameters: [1], sql: `select
"user"."id", "user"."name"
from "user"
where "user".id = $1 limit 1` })
      expect(db.receivedQueries[6]).toEqual({ parameters: [3], sql: `select
"image"."file_name", "image"."id", "image"."created_by_user_id"
from "image"
where "image".id = $1 limit 1` })
      expect(db.receivedQueries[7]).toEqual({ parameters: [1], sql: `select
"user"."id", "user"."name"
from "user"
where "user".id = $1 limit 1` })
    })

    test('updateSingle', async () => {
      const db = createMockDbService()

      const store = fn(db, tsPgOrm, 'user')

      const result = await store.updateSingle({
        filter: { field: 'id', op: Operator.EQUALS, val: 1 },
        record: {
          id: 3,
          name: 'NEW USER NAME',
        },
      })

      expect(result).toEqual(undefined)
      expect(db.receivedQueries).toEqual([
        {
          parameters: [3, 'NEW USER NAME'],
          sql: 'update "user" set (id, name) = ($1, $2) where id = 1',
        },
      ])
    })
  })
})
