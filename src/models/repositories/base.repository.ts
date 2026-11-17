import type { Paginated } from '../../common/interfaces/api-response.interface.js';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto.js';
import { Injectable } from '@nestjs/common';
import { type DbClient, PrismaService } from '../prisma.service.js';

/** Minimal shape shared by every Prisma model delegate. */
interface ModelDelegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findFirst(args?: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  updateMany(args: unknown): Promise<{ count: number }>;
  delete(args: unknown): Promise<unknown>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
  count(args?: unknown): Promise<number>;
}

export interface FindOptions<TOrderBy> {
  orderBy?: TOrderBy | TOrderBy[];
  skip?: number;
  take?: number;
}

export interface PaginateOptions<TOrderBy> {
  page: number;
  limit: number;
  orderBy?: TOrderBy | TOrderBy[];
}

/**
 * Generic CRUD for one Prisma model. Subclasses implement `delegate()` and add
 * typed, domain-specific queries using `this.db.<model>`.
 *
 * Transactions: `repo.withTx(tx)` returns the same repository bound to `tx`
 * (see TransactionManager).
 */
@Injectable()
export abstract class BaseRepository<
  TEntity,
  TWhere,
  TWhereUnique,
  TCreate,
  TUpdate,
  TOrderBy,
> {
  protected db: DbClient;

  constructor(prisma: PrismaService) {
    this.db = prisma as unknown as DbClient;
  }

  /** e.g. `return db.user;` */
  protected abstract delegate(db: DbClient): unknown;

  private get model(): ModelDelegate {
    return this.delegate(this.db) as ModelDelegate;
  }

  /** Same repository, running inside the given transaction. */
  withTx(tx: DbClient): this {
    const bound = Object.create(this) as this;
    bound.db = tx;
    return bound;
  }

  find(where?: TWhere, options: FindOptions<TOrderBy> = {}): Promise<TEntity[]> {
    return this.model.findMany({ where, ...options }) as Promise<TEntity[]>;
  }

  findOne(where: TWhere, options: Pick<FindOptions<TOrderBy>, 'orderBy'> = {}): Promise<TEntity | null> {
    return this.model.findFirst({ where, ...options }) as Promise<TEntity | null>;
  }

  findUnique(where: TWhereUnique): Promise<TEntity | null> {
    return this.model.findUnique({ where }) as Promise<TEntity | null>;
  }

  findById(id: string): Promise<TEntity | null> {
    return this.model.findUnique({ where: { id } }) as Promise<TEntity | null>;
  }

  create(data: TCreate): Promise<TEntity> {
    return this.model.create({ data }) as Promise<TEntity>;
  }

  update(where: TWhereUnique, data: TUpdate): Promise<TEntity> {
    return this.model.update({ where, data }) as Promise<TEntity>;
  }

  updateById(id: string, data: TUpdate): Promise<TEntity> {
    return this.model.update({ where: { id }, data }) as Promise<TEntity>;
  }

  async updateMany(where: TWhere, data: TUpdate): Promise<number> {
    return (await this.model.updateMany({ where, data })).count;
  }

  delete(where: TWhereUnique): Promise<TEntity> {
    return this.model.delete({ where }) as Promise<TEntity>;
  }

  async deleteMany(where: TWhere): Promise<number> {
    return (await this.model.deleteMany({ where })).count;
  }

  count(where?: TWhere): Promise<number> {
    return this.model.count({ where });
  }

  async exists(where: TWhere): Promise<boolean> {
    return (await this.model.count({ where, take: 1 })) > 0;
  }

  async paginate(where: TWhere, { page, limit, orderBy }: PaginateOptions<TOrderBy>): Promise<Paginated<TEntity>> {
    const [items, total] = await Promise.all([
      this.model.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
      this.model.count({ where }),
    ]);
    return { items: items as TEntity[], meta: buildPaginationMeta(total, page, limit) };
  }
}
