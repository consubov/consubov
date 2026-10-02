import type { VerifiedIdentityWithClaims } from "./claims";

export interface AuthContractPort {
  verifyAndResolve(principal: string): Promise<VerifiedIdentityWithClaims | null>;
}
