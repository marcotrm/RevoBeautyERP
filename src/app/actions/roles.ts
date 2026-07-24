'use server';

import { prisma } from '@/lib/prisma';
import {
  RoleConfig, DEFAULT_ROLES, ROLE_COLORS, normalizePerms, emptyPerms,
} from '@/lib/rolesConfig';

function toRoleConfig(row: {
  id: string; name: string; color: string; isSystem: boolean; permissions: unknown;
}): RoleConfig {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isSystem: row.isSystem,
    permissions: normalizePerms(row.permissions as Record<string, boolean>),
  };
}

/** Semina i ruoli di default se la tabella è vuota. Idempotente. */
async function ensureSeeded() {
  const count = await prisma.appRole.count();
  if (count > 0) return;
  await prisma.appRole.createMany({
    data: DEFAULT_ROLES.map((r, i) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      isSystem: r.isSystem,
      permissions: r.permissions,
      sortOrder: i,
    })),
    skipDuplicates: true,
  });
}

export async function getRoles(): Promise<RoleConfig[]> {
  await ensureSeeded();
  const rows = await prisma.appRole.findMany({ orderBy: { sortOrder: 'asc' } });
  return rows.map(toRoleConfig);
}

export async function createRole(name: string): Promise<RoleConfig> {
  const count = await prisma.appRole.count();
  const color = ROLE_COLORS[count % ROLE_COLORS.length];
  const row = await prisma.appRole.create({
    data: {
      name: name.trim(),
      color,
      isSystem: false,
      permissions: emptyPerms(),
      sortOrder: count,
    },
  });
  return toRoleConfig(row);
}

export async function updateRolePermissions(id: string, permissions: Record<string, boolean>): Promise<RoleConfig> {
  const row = await prisma.appRole.update({
    where: { id },
    data: { permissions: normalizePerms(permissions) },
  });
  return toRoleConfig(row);
}

export async function deleteRole(id: string): Promise<boolean> {
  await prisma.appRole.delete({ where: { id } });
  return true;
}
