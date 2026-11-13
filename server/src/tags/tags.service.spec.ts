import { TagCategory } from '@prisma/client';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  it('returns only enabled tags from the catalog in stable order', async () => {
    const prisma = {
      tagCatalog: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'current',
          version: 'mvp-tags-v2'
        })
      },
      tag: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'context-2',
            name: '职场',
            category: TagCategory.CONTEXT,
            sortOrder: 2
          },
          {
            id: 'emotion-2',
            name: '平静',
            category: TagCategory.EMOTION,
            sortOrder: 2
          },
          {
            id: 'emotion-1',
            name: '开心',
            category: TagCategory.EMOTION,
            sortOrder: 1
          }
        ])
      }
    };
    const service = new TagsService(prisma as any);

    const result = await service.list();

    expect(result.version).toBe('mvp-tags-v2');
    expect(result.items.map((tag) => tag.id)).toEqual([
      'emotion-1',
      'emotion-2',
      'context-2'
    ]);
    expect(prisma.tag.findMany).toHaveBeenCalledWith({
      where: { enabled: true, catalogVersion: 'mvp-tags-v2' }
    });
  });
});
