import { BaseController } from './BaseController';
import { PageResult } from '../models';

export interface PagedState<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
}

/** A list loaded page by page (infinite scroll). Subclasses fetch one page. */
export abstract class PagedListController<T, S extends PagedState<T>> extends BaseController<S> {
  protected readonly pageSize: number = 30;
  private generation = 0;

  protected abstract fetchPage(offset: number, limit: number): Promise<PageResult<T>>;

  /** Reload from the first page. With [quiet] the current items stay visible meanwhile. */
  async load(quiet = false): Promise<void> {
    const gen = ++this.generation;
    this.setState({ loading: !quiet, error: null } as Partial<S>);
    try {
      const page = await this.fetchPage(0, this.pageSize);
      if (gen !== this.generation) return;
      this.setState({ items: page.items, hasMore: page.hasMore, loading: false } as Partial<S>);
      this.onLoaded(page.items);
    } catch (e) {
      if (gen !== this.generation) return;
      this.setState({ loading: false, error: BaseController.messageOf(e) } as Partial<S>);
    }
  }

  /** Append the next page; no-op if already loading or done. */
  async loadMore(): Promise<void> {
    const s = this.state;
    if (s.loading || s.loadingMore || !s.hasMore) return;
    const gen = this.generation;
    this.setState({ loadingMore: true } as Partial<S>);
    try {
      const page = await this.fetchPage(s.items.length, this.pageSize);
      if (gen !== this.generation) return;
      this.setState((cur) => ({ items: [...cur.items, ...page.items], hasMore: page.hasMore, loadingMore: false } as Partial<S>));
    } catch {
      this.setState({ loadingMore: false } as Partial<S>);
    }
  }

  /** Hook for subclasses (e.g. caching the first page). */
  protected onLoaded(_items: T[]): void {}
}
