import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuditContext } from '../../common/interfaces/audit.interface.js';
import { StorageService } from '../../common/services/s3/storage.service.js';
import { runInBackground } from '../../common/utilities/background.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AuditLogRepository } from '../../models/repositories/audit-log.repository.js';
import { ProductRepository } from '../../models/repositories/product.repository.js';
import { TransactionManager } from '../../models/repositories/transaction.manager.js';
import type { SaveSizeChartDto } from './dto/index.js';
import type { AdminProduct } from './entities/product.entity.js';
import { ProductsService } from './products.service.js';
import { DEFAULT_SIZE_CHART_TITLE, readSizeChart, type SizeChart } from './size-chart.js';

const NEW_FILE = /^new:(\d)$/;

@Injectable()
export class SizeChartService {
  constructor(
    private readonly products: ProductRepository,
    private readonly auditLogs: AuditLogRepository,
    private readonly tx: TransactionManager,
    private readonly storage: StorageService,
    private readonly productsService: ProductsService,
  ) {}

  /**
   * Replaces the product's chart. Each option names its photo: "new:N" (the
   * N-th uploaded file) or a URL already on the chart. Photos no longer used
   * are deleted from storage after the save.
   */
  async save(
    productId: string,
    dto: SaveSizeChartDto,
    files: Express.Multer.File[] = [],
    audit: AuditContext,
  ): Promise<AdminProduct> {
    const product = await this.products.findLiveById(productId);
    if (!product) throw new NotFoundException('Product not found');
    const current = readSizeChart(product.sizeChart);
    const currentUrls = new Set(current?.options.map((o) => o.url) ?? []);

    const usedFiles = new Set<number>();
    for (const option of dto.options) {
      const match = NEW_FILE.exec(option.image);
      if (match) {
        const index = Number(match[1]);
        if (index >= files.length || usedFiles.has(index)) {
          throw new BadRequestException(`Photo for "${option.label}" is missing`);
        }
        usedFiles.add(index);
      } else if (!currentUrls.has(option.image)) {
        throw new BadRequestException(`Photo for "${option.label}" is not on this size chart`);
      }
    }
    if (usedFiles.size !== files.length) throw new BadRequestException('Every uploaded photo must belong to a choice');
    if (dto.enabled && !dto.options.length) throw new BadRequestException('Add at least one photo to show the size chart');

    const stored = await this.storage.uploadFiles(files, 'size-charts');
    const options = dto.options.map((o) => {
      const match = NEW_FILE.exec(o.image);
      return { label: o.label, url: match ? stored[Number(match[1])].url : o.image };
    });
    const next: SizeChart = { enabled: dto.enabled, title: dto.title || DEFAULT_SIZE_CHART_TITLE, options };

    try {
      await this.tx.run(async (tx) => {
        await this.products.withTx(tx).updateById(productId, {
          sizeChart: options.length ? (next as unknown as Prisma.InputJsonObject) : Prisma.DbNull,
        });
        await this.auditLogs.withTx(tx).record({
          ...audit,
          action: 'PRODUCT_SIZE_CHART_UPDATED',
          entityType: 'Product',
          entityId: productId,
          oldValues: current ? { ...current } : {},
          newValues: { ...next },
        });
      });
    } catch (error) {
      await this.storage.deleteFiles(stored.map((f) => f.key));
      throw error;
    }

    const kept = new Set(options.map((o) => o.url));
    const unused = [...currentUrls].filter((url) => !kept.has(url));
    if (unused.length) runInBackground('delete-size-chart-images', () => this.storage.deleteFiles(unused));
    return this.productsService.adminFindById(productId);
  }
}
