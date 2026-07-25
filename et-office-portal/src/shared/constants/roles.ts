export const ROLES = {
  EMPLOYEE: "employee",
  LEADER: "leader",
  DEPUTY_DIRECTOR: "deputy_director",
  ADMIN: "admin",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<Role, string> = {
  employee: "Nhân viên",
  leader: "Trưởng nhóm",
  deputy_director: "Phó Giám đốc",
  admin: "Quản trị viên",
};

export function isAtLeastLeader(role: Role): boolean {
  return (["leader", "deputy_director", "admin"] as Role[]).includes(role);
}

export function isAdminOrPGD(role: Role): boolean {
  return (["deputy_director", "admin"] as Role[]).includes(role);
}
