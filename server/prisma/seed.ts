import { PrismaClient, TagCategory } from '@prisma/client';

const prisma = new PrismaClient();

const tags = [
  ['tag_00000000-0000-4000-8000-000000000001', TagCategory.EMOTION, '开心', 1, false],
  ['tag_00000000-0000-4000-8000-000000000002', TagCategory.EMOTION, '平静', 2, false],
  ['tag_00000000-0000-4000-8000-000000000003', TagCategory.EMOTION, '疲惫', 3, false],
  ['tag_00000000-0000-4000-8000-000000000004', TagCategory.EMOTION, '焦虑', 4, false],
  ['tag_00000000-0000-4000-8000-000000000005', TagCategory.EMOTION, '委屈', 5, false],
  ['tag_00000000-0000-4000-8000-000000000006', TagCategory.EMOTION, '难过', 6, false],
  ['tag_00000000-0000-4000-8000-000000000007', TagCategory.EMOTION, '愤怒', 7, false],
  ['tag_00000000-0000-4000-8000-000000000008', TagCategory.EMOTION, '孤独', 8, false],
  ['tag_00000000-0000-4000-8000-000000000009', TagCategory.EMOTION, '迷茫', 9, false],
  ['tag_00000000-0000-4000-8000-000000000010', TagCategory.EMOTION, '失落', 10, false],
  ['tag_00000000-0000-4000-8000-000000000011', TagCategory.EMOTION, '其他', 11, true],
  ['tag_00000000-0000-4000-8000-000000000101', TagCategory.CONTEXT, '家庭', 1, false],
  ['tag_00000000-0000-4000-8000-000000000102', TagCategory.CONTEXT, '校园', 2, false],
  ['tag_00000000-0000-4000-8000-000000000103', TagCategory.CONTEXT, '亲密关系', 3, false],
  ['tag_00000000-0000-4000-8000-000000000104', TagCategory.CONTEXT, '职场', 4, false],
  ['tag_00000000-0000-4000-8000-000000000105', TagCategory.CONTEXT, '朋友关系', 5, false],
  ['tag_00000000-0000-4000-8000-000000000106', TagCategory.CONTEXT, '自我与生活', 6, false],
  ['tag_00000000-0000-4000-8000-000000000107', TagCategory.CONTEXT, '其他', 7, true]
] as const;

async function main(): Promise<void> {
  await prisma.tagCatalog.upsert({
    where: { id: 'current' },
    create: { id: 'current', version: 'mvp-tags-v1' },
    update: { version: 'mvp-tags-v1' }
  });

  for (const [id, category, name, sortOrder, isOther] of tags) {
    await prisma.tag.upsert({
      where: { id },
      create: {
        id,
        category,
        name,
        sortOrder,
        enabled: true,
        isOther,
        catalogVersion: 'mvp-tags-v1'
      },
      update: {
        category,
        name,
        sortOrder,
        enabled: true,
        isOther,
        catalogVersion: 'mvp-tags-v1'
      }
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
