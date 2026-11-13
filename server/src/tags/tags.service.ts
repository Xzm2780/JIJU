import { Injectable } from '@nestjs/common';
import { TagCategory } from '@prisma/client';
import { ApiError } from '../common/api-error';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const catalog = await this.prisma.tagCatalog.findUnique({
      where: { id: 'current' }
    });
    if (!catalog) {
      throw new ApiError(
        'JIJU_SYSTEM_5031',
        503,
        '标签目录暂时不可用，请稍后重试'
      );
    }
    const tags = await this.prisma.tag.findMany({
      where: { enabled: true, catalogVersion: catalog.version }
    });

    const categoryOrder = new Map<TagCategory, number>([
      [TagCategory.EMOTION, 0],
      [TagCategory.CONTEXT, 1]
    ]);
    tags.sort(
      (left, right) =>
        categoryOrder.get(left.category)! - categoryOrder.get(right.category)! ||
        left.sortOrder - right.sortOrder ||
        left.id.localeCompare(right.id)
    );

    return {
      version: catalog.version,
      items: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        category: tag.category,
        sort_order: tag.sortOrder
      }))
    };
  }
}
