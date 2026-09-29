import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { seedDemo } from './seed-demo.js';

const prisma = new PrismaClient();

const PERMISSION_GROUPS = {
  'Dashboard': ['dashboard.view'],
  'Agents': ['agents.view', 'agents.create', 'agents.edit', 'agents.delete'],
  'Workflows': ['workflows.view', 'workflows.edit'],
  'Data Master': ['fields.view', 'fields.edit', 'users.view', 'users.manage', 'roles.view', 'roles.manage'],
  'Knowledge': ['knowledge.view', 'knowledge.edit'],
  'Analytics': ['analytics.view'],
  'Integrations': ['integrations.view', 'integrations.manage'],
  'Voice Test': ['test-agent.use'],
  'System': ['publish'],
};

async function main() {
  console.log('Seeding database...');

  // 1. Seed Permission Groups and Permissions
  for (const [groupName, permissions] of Object.entries(PERMISSION_GROUPS)) {
    const group = await prisma.permissionGroup.upsert({
      where: { name: groupName },
      update: {},
      create: { name: groupName },
    });

    for (const permName of permissions) {
      await prisma.permission.upsert({
        where: { name: permName },
        update: { groupId: group.id },
        create: {
          name: permName,
          groupId: group.id,
          description: `Allows ${permName}`,
        },
      });
    }
  }

  // Fetch all permissions for admin/superadmin
  const allPermissions = await prisma.permission.findMany();

  // 2. Seed Roles
  // role 1: user (default)
  const userRole = await prisma.role.upsert({
    where: { code: 'USER' },
    update: { name: 'Participant', deletedAt: null },
    create: {
      name: 'Participant',
      code: 'USER',
      description: 'Default role for registered users',
      color: 'slate',
    },
  });

  // role 2: admin
  const adminRole = await prisma.role.upsert({
    where: { code: 'ADMIN' },
    update: {
      permissions: {
        deleteMany: {},
        create: allPermissions.map(p => ({ permissionId: p.id }))
      }
    },
    create: {
      name: 'Admin',
      code: 'ADMIN',
      description: 'Administrator with full access',
      color: 'blue',
      permissions: {
        create: allPermissions.map(p => ({ permissionId: p.id }))
      }
    },
  });

  // role 3: superadmin(webdev)
  const superAdminRole = await prisma.role.upsert({
    where: { code: 'SUPER-ADMIN' },
    update: {
      permissions: {
        deleteMany: {},
        create: allPermissions.map(p => ({ permissionId: p.id }))
      }
    },
    create: {
      name: 'Super Admin',
      code: 'SUPER-ADMIN',
      description: 'Web developer / Super admin (Akmal)',
      color: 'purple',
      permissions: {
        create: allPermissions.map(p => ({ permissionId: p.id }))
      }
    },
  });

  await seedDemo(prisma, superAdminRole.id, userRole.id);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
