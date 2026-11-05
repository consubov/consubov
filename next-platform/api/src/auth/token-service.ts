import {
  signSyntheticJwt,
  verifySyntheticJwt,
  decodeSyntheticJwt,
  SyntheticJwtClaims,
  SYNTHETIC_JWT_SECRET_LAB,
  VerifyJwtResult
} from '@consubov/auth-client';

export class ApiTokenService {
  private secret: string;

  constructor(secret: string = SYNTHETIC_JWT_SECRET_LAB) {
    this.secret = secret;
  }

  public async verifyToken(token: string): Promise<VerifyJwtResult> {
    return await verifySyntheticJwt(token, this.secret);
  }

  public async generateToken(
    claims: Partial<SyntheticJwtClaims> & {
      user_id: string;
      tenant_id: string;
      fazenda_id: string;
      profile_id: any;
    },
    expiresInSeconds: number = 86400
  ): Promise<string> {
    return await signSyntheticJwt(claims, this.secret, { expiresInSeconds });
  }

  public decodeToken(token: string): SyntheticJwtClaims | null {
    return decodeSyntheticJwt(token);
  }
}
