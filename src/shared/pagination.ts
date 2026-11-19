import { Prisma } from '@prisma/client';

export const MAX_PAGE_SIZE = 100;
export const FALLBACK_PAGE_SIZE = 25;

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function paginationRequested(query: Record<string, unknown> = {}) {
  return query.page !== undefined || query.pageSize !== undefined;
}

export function getPageOptions(query: Record<string, unknown> = {}, defaultPageSize = FALLBACK_PAGE_SIZE) {
  const requestedPage = Number(query.page);
  const requestedPageSize = Number(query.pageSize);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.floor(requestedPage) : 1;
  const validPageSize = Number.isInteger(requestedPageSize) && requestedPageSize > 0;
  const pageSize = Math.min(MAX_PAGE_SIZE, validPageSize ? requestedPageSize : defaultPageSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export async function getConfiguredPageSize(prisma: { systemSetting?: { findUnique?: (args: any) => Promise<{ value?: unknown } | null> } }) {
  if (!prisma.systemSetting?.findUnique) return FALLBACK_PAGE_SIZE;
  let setting: { value?: unknown } | null;
  try {
    setting = await prisma.systemSetting.findUnique({ where: { key: 'defaultPageSize' }, select: { value: true } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2021', 'P2022'].includes(error.code)) {
      return FALLBACK_PAGE_SIZE;
    }
    throw error;
  }
  const value = Number(setting?.value);
  return [10, 25, 50].includes(value) ? value : FALLBACK_PAGE_SIZE;
}

export async function paginate<T>(
  query: Record<string, unknown>,
  defaultPageSize: number,
  fetchItems: (page: ReturnType<typeof getPageOptions>) => Promise<T[]>,
  countItems: () => Promise<number>,
): Promise<PageResult<T>> {
  const pageOptions = getPageOptions(query, defaultPageSize);
  const [items, total] = await Promise.all([fetchItems(pageOptions), countItems()]);
  return {
    items,
    page: pageOptions.page,
    pageSize: pageOptions.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageOptions.pageSize)),
  };
}
