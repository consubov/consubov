export interface AuthContractPort {
  verifyAndResolve(principal: string): Promise<VerifiedIdentityWithClaims | null>;
}
