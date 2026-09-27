import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

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
    update: {},
    create: {
      name: 'User',
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

  // 3. Seed Users
  const superAdminPassword = await bcrypt.hash('superadmin123', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@kavqen.com' },
    update: { roleId: superAdminRole.id },
    create: {
      email: 'superadmin@kavqen.com',
      name: 'Akmal Fauzi',
      password: superAdminPassword,
      roleId: superAdminRole.id,
    }
  });

  const demoUserPassword = await bcrypt.hash('demo12345', 10);
  await prisma.user.upsert({
    where: { email: 'demo.user@kavqen.com' },
    update: { roleId: userRole.id },
    create: {
      email: 'demo.user@kavqen.com', name: 'Demo Participant',
      password: demoUserPassword, roleId: userRole.id
    }
  });

  
  // 4. Seed Default Fields
  const defaultFields = [
    {
      name: 'full_name',
      label: 'Full Name',
      type: 'string',
      required: true,
      prompt_hint: "Ask for the patient's full name",
      category: 'Patient Info',
    },
    {
      name: 'phone_number',
      label: 'Phone Number',
      type: 'phone',
      required: true,
      prompt_hint: 'Ask for the best contact phone number',
      category: 'Patient Info',
    },
    {
      name: 'date_of_birth',
      label: 'Date of Birth',
      type: 'date',
      required: true,
      prompt_hint: 'Ask for date of birth (day, month, year)',
      category: 'Demographics',
    },
    {
      name: 'primary_symptoms',
      label: 'Primary Symptoms',
      type: 'text',
      required: true,
      prompt_hint: 'Ask what symptoms or pain the patient is experiencing',
      category: 'Clinical Intake',
    },
    {
      name: 'urgency_level',
      label: 'Urgency Level',
      type: 'enum',
      options: ['low', 'medium', 'high'],
      required: true,
      prompt_hint: 'Estimate urgency level based on patient symptoms',
      category: 'Triage',
    },
    {
      name: 'allergies',
      label: 'Known Allergies',
      type: 'text',
      required: false,
      prompt_hint: 'Ask if the patient has any known drug or food allergies',
      category: 'Medical History',
    },
    {
      name: 'insurance_provider',
      label: 'Insurance Provider',
      type: 'string',
      required: false,
      prompt_hint: 'Ask for patient health insurance carrier or coverage ID',
      category: 'Billing',
    },
  ];

  for (const field of defaultFields) {
    await prisma.field.upsert({
      where: { name: field.name },
      update: {},
      create: {
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        prompt_hint: field.prompt_hint,
        category: field.category,
        options: field.options || [],
      },
    });
  }

  
  // 5. Seed Default Agents
  const defaultAgents = [
    {
      id: 'sarah',
      name: 'Sarah AI Agent',
      role: 'Merchant Pre-Screening & Inbound Qualification',
      themeId: 'clinic',
      voice: 'Jessica (Calm, Reassuring)',
      model: 'Gemini 3 Pro Preview / AssemblyAI',
      workflowSteps: 8,
      avatarGradient: 'from-pink-500 via-rose-500 to-amber-500',
      description: 'Specialized inbound assistant that qualifies merchant businesses, handles ineligibility with empathy, and collects merchant volume data.',
      tags: ['B2B Sales', 'Lead Intake', 'Qualification'],
    },
    {
      id: 'clinic',
      name: 'Clinic Patient Intake Agent',
      role: 'Healthcare Intake, Triage & Medical Symptoms',
      themeId: 'clinic',
      voice: 'Alba (Natural & Clear)',
      model: 'AssemblyAI Universal-3.5 Streaming',
      workflowSteps: 5,
      avatarGradient: 'from-sky-500 via-indigo-600 to-teal-500',
      description: 'Medical clinic front-desk triage agent that collects patient symptoms, calculates urgency levels, and books intake appointments.',
      tags: ['Healthcare', 'Clinical Triage', 'HIPAA'],
    },
    {
      id: 'complaint',
      name: 'Customer Support Complaint Agent',
      role: 'Ticket Resolution, Order Diagnosis & Escalation',
      themeId: 'complaint',
      voice: 'Eve (Warm & Helpful)',
      model: 'AssemblyAI Universal-3.5 Streaming',
      workflowSteps: 5,
      avatarGradient: 'from-emerald-500 via-teal-600 to-cyan-500',
      description: 'Empathetic customer resolution agent designed to de-escalate angry customers, log complaint categories, and issue instant refund vouchers.',
      tags: ['Support', 'Dispute Resolution', 'E-commerce'],
    },
  ];

  for (const agent of defaultAgents) {
    const { id, ...agentData } = agent;
    await prisma.agent.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ...agentData
      },
    });
  }

  
  console.log('Seeding Workflows...');
  await prisma.workflow.upsert({
    where: { id: '3e62f5f1-3d23-4df4-8d96-6e465a1811e1' },
    update: {},
    create: {
      id: '3e62f5f1-3d23-4df4-8d96-6e465a1811e1',
      name: 'Default Support Flow',
      description: 'Handles basic customer inquiries',
      status: 'PUBLISHED',
      data: {}
    }
  });

  const demoWorkflowId = 'd17661dc-3ac0-4c3d-9530-455eb935a720';
  const configsDir = path.resolve(process.cwd(), '../../configs');
  const clinicSchema = JSON.parse(readFileSync(path.join(configsDir, 'clinic.json'), 'utf8'));
  const demoSchema = { ...clinicSchema, theme_id: demoWorkflowId, title: 'Clinic Intake Demo' };
  const demoSchemaPath = path.join(configsDir, `${demoWorkflowId}.json`);
  if (!existsSync(demoSchemaPath)) writeFileSync(demoSchemaPath, JSON.stringify(demoSchema, null, 2));
  await prisma.workflow.upsert({
    where: { id: demoWorkflowId },
    update: { ownerId: superAdmin.id },
    create: {
      id: demoWorkflowId,
      ownerId: superAdmin.id,
      name: 'Clinic Intake Demo',
      description: 'Demo intake pasien dengan alur suara dan form terstruktur.',
      status: 'PUBLISHED',
      data: {
        nodes: demoSchema.nodes,
        edges: demoSchema.edges,
        publishedFields: demoSchema.fields
      }
    }
  });

  const demoCode = 'KQ-DEMO-2026';
  await prisma.accessCode.upsert({
    where: { codeHash: createHash('sha256').update(demoCode).digest('hex') },
    update: { expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), revokedAt: null },
    create: {
      workflowId: demoWorkflowId,
      createdById: superAdmin.id,
      codeHash: createHash('sha256').update(demoCode).digest('hex'),
      prefix: 'KQ-DEMO',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  await prisma.workflow.upsert({
    where: { id: '9a3f2d25-9c17-48b4-93c6-2c98d63a8a3f' },
    update: {},
    create: {
      id: '9a3f2d25-9c17-48b4-93c6-2c98d63a8a3f',
      name: 'Sales Onboarding',
      description: 'Qualifies leads and books meetings',
      status: 'DRAFT',
      data: {}
    }
  });

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
