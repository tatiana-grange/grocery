import {
  adminCategoriesControllerArchive,
  adminCategoriesControllerCreate,
  adminCategoriesControllerList,
  adminCategoriesControllerUnarchive,
  adminCategoriesControllerUpdate,
  adminProductsControllerArchive,
  adminProductsControllerCreate,
  adminProductsControllerGet,
  adminProductsControllerList,
  adminProductsControllerSetPrice,
  adminProductsControllerUnarchive,
  adminProductsControllerUpdate,
  adminSuppliersControllerArchive,
  adminSuppliersControllerCreate,
  adminSuppliersControllerList,
  adminSuppliersControllerUnarchive,
  adminSuppliersControllerUpdate,
} from '@grocery/openapi-generator/client/sdk.gen'
import type {
  AdminCategoriesControllerCreateData,
  AdminCategoriesControllerUpdateData,
  AdminProductsControllerCreateData,
  AdminProductsControllerListData,
  AdminProductsControllerSetPriceData,
  AdminProductsControllerUpdateData,
  AdminSuppliersControllerCreateData,
  AdminSuppliersControllerUpdateData,
} from '@grocery/openapi-generator/client/types.gen'
import { FilterRule } from '@lonestone/nzoth/client'

export const CATALOG_PAGE_SIZE = 20

function unwrap<T>(response: { data?: T; error?: unknown }): T {
  if (response.error) throw response.error
  return response.data as T
}

// Suppliers -----------------------------------------------------------------------------------

export function suppliersQueryOptions(includeArchived = false) {
  return {
    queryKey: ['catalog', 'suppliers', includeArchived],
    queryFn: async () =>
      unwrap(
        await adminSuppliersControllerList({
          query: { offset: 0, pageSize: 100, includeArchived: String(includeArchived) },
        }),
      ),
  }
}

export const createSupplier = async (body: AdminSuppliersControllerCreateData['body']) =>
  unwrap(await adminSuppliersControllerCreate({ body }))

export const updateSupplier = async (
  id: string,
  body: AdminSuppliersControllerUpdateData['body'],
) => unwrap(await adminSuppliersControllerUpdate({ path: { id }, body }))

export const archiveSupplier = async (id: string, cascade = false) =>
  unwrap(
    await adminSuppliersControllerArchive({
      path: { id },
      query: { cascade: String(cascade) },
    }),
  )

export const unarchiveSupplier = async (id: string) =>
  unwrap(await adminSuppliersControllerUnarchive({ path: { id } }))

// Categories ----------------------------------------------------------------------------------

export function categoriesQueryOptions(includeArchived = false) {
  return {
    queryKey: ['catalog', 'categories', includeArchived],
    queryFn: async () =>
      unwrap(
        await adminCategoriesControllerList({
          query: { includeArchived: String(includeArchived) },
        }),
      ),
  }
}

export const createCategory = async (body: AdminCategoriesControllerCreateData['body']) =>
  unwrap(await adminCategoriesControllerCreate({ body }))

export const updateCategory = async (
  id: string,
  body: AdminCategoriesControllerUpdateData['body'],
) => unwrap(await adminCategoriesControllerUpdate({ path: { id }, body }))

export const archiveCategory = async (id: string) =>
  unwrap(await adminCategoriesControllerArchive({ path: { id } }))

export const unarchiveCategory = async (id: string) =>
  unwrap(await adminCategoriesControllerUnarchive({ path: { id } }))

// Products ------------------------------------------------------------------------------------

type ProductFilter = NonNullable<AdminProductsControllerListData['query']['filter']>[number]

export function productsQueryOptions(params: { page: number; search?: string }) {
  const filter: ProductFilter[] = params.search
    ? [{ property: 'q' as const, rule: FilterRule.LIKE, value: params.search }]
    : []
  return {
    queryKey: ['catalog', 'products', params.page, params.search ?? ''],
    queryFn: async () =>
      unwrap(
        await adminProductsControllerList({
          query: {
            offset: (params.page - 1) * CATALOG_PAGE_SIZE,
            pageSize: CATALOG_PAGE_SIZE,
            filter,
            includeArchived: 'false',
          },
        }),
      ),
  }
}

export function productDetailQueryOptions(id: string) {
  return {
    queryKey: ['catalog', 'products', 'detail', id],
    queryFn: async () => unwrap(await adminProductsControllerGet({ path: { id } })),
  }
}

export const createProduct = async (body: AdminProductsControllerCreateData['body']) =>
  unwrap(await adminProductsControllerCreate({ body }))

export const updateProduct = async (
  id: string,
  body: AdminProductsControllerUpdateData['body'],
) => unwrap(await adminProductsControllerUpdate({ path: { id }, body }))

export const setProductPrice = async (
  id: string,
  body: AdminProductsControllerSetPriceData['body'],
) => unwrap(await adminProductsControllerSetPrice({ path: { id }, body }))

export const archiveProduct = async (id: string) =>
  unwrap(await adminProductsControllerArchive({ path: { id } }))

export const unarchiveProduct = async (id: string) =>
  unwrap(await adminProductsControllerUnarchive({ path: { id } }))
