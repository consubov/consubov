export function buildFixedPages<T>(items: T[], pageSize: number): (T | null)[][] {
  if (items.length === 0 || pageSize <= 0) {
    return [];
  }

  const pages: (T | null)[][] = [];

  for (let index = 0; index < items.length; index += pageSize) {
    const page = [...items.slice(index, index + pageSize)] as (T | null)[];

    while (page.length < pageSize) {
      page.push(null);
    }

    pages.push(page);
  }

  return pages;
}
