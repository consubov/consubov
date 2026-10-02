import { createTenantId, createPrincipalId } from "../domain/identity";
import type { TenantId, PrincipalId } from "../domain/identity";

export enum MembershipStatus {
  ACTIVE = "ACTIVE",
}

export interface Tenant {
  id: TenantId;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Membership {
  id: string;
  tenantId: TenantId;
  principalId: PrincipalId;
  status: MembershipStatus;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActiveTenant {
  tenant: Tenant;
  membership: Membership;
}
