import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@qiuzheng.local';
  const password = 'demo-password-123';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: 'Demo User',
      passwordHash,
    },
  });

  let team = await prisma.team.findFirst({
    where: { members: { some: { userId: user.id, role: 'owner' } } },
  });
  if (!team) {
    team = await prisma.team.create({
      data: {
        name: 'Demo Team',
        members: { create: { userId: user.id, role: 'owner' } },
      },
    });
  }

  let project = await prisma.project.findFirst({
    where: { teamId: team.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        teamId: team.id,
        name: '新系统综述项目',
        question: '',
        members: { create: { userId: user.id, role: 'owner' } },
        protocolVersions: {
          create: {
            version: 1,
            question: '',
            createdBy: user.id,
            criteria: {
              create: [
                { code: 'P', title: 'Population', titleEn: 'Population', includeText: '', excludeText: '', sortOrder: 1 },
                { code: 'I', title: 'Intervention', titleEn: 'Intervention', includeText: '', excludeText: '', sortOrder: 2 },
                { code: 'O', title: 'Outcomes', titleEn: 'Outcomes', includeText: '', excludeText: '', sortOrder: 3 },
                { code: 'S', title: 'Study design', titleEn: 'Study design', includeText: '', excludeText: '', sortOrder: 4 },
              ],
            },
          },
        },
      },
    });
  }

  const citationCount = await prisma.citation.count({ where: { projectId: project.id } });

  // Do not inject or wipe research data on startup. Demo wipe is intentional/one-off;
  // use POST /seed-demo only when you explicitly want practice data again.
  console.log('Seed complete (account only; research data untouched)');
  console.log(`Login: ${email} / ${password}`);
  console.log(`Project: ${project.id}`);
  console.log(`Citations: ${citationCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
