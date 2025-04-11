import { IsString } from 'class-validator';
import { getConfigFactory } from 'zyprova-common-lib/dist/config';

export class JwtAuthConfig {
  /**
   * A secure string used to hash passwords
   */
  @IsString()
  secret!: string;

  /**
   * Expiry time of generated authTokens in seconds
   */
  @IsString()
  expiresIn = '10m';

  /**
   * Expiry time of generated authTokens in seconds
   */
  @IsString()
  refreshTokenExpiresIn = '1d';

  /**
   * Issuer of the token
   */
  @IsString()
  issuer?: string;
}

export const jwtAuthConfigFactory = getConfigFactory('jwtAuth', JwtAuthConfig);
