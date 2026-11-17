import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloDriver } from '@nestjs/apollo';
import { ConfigService } from '@nestjs/config';
import type { GqlOptionsFactory } from '@nestjs/graphql';
import { Injectable } from '@nestjs/common';
import { join } from 'node:path';
import { TokenService } from '../common/services/token/token.service.js';
import type { GqlContext } from '../common/utilities/execution-context.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';
import { UserRepository } from '../models/repositories/user.repository.js';

/**
 * Code-first GraphQL at /graphql (outside the /api/v1 REST prefix).
 * Resolvers go through the same guards/pipes/filter as REST; see
 * common/utilities/execution-context.ts for how req/res are reached.
 * Nest middleware is mounted under /api/v1 only, so the context factory
 * authenticates GraphQL requests itself.
 */
@Injectable()
export class GraphqlConfigService implements GqlOptionsFactory<ApolloDriverConfig> {
  private readonly auth: AuthMiddleware;

  constructor(
    private readonly config: ConfigService,
    tokens: TokenService,
    users: UserRepository,
  ) {
    this.auth = new AuthMiddleware(tokens, users);
  }

  createGqlOptions(): ApolloDriverConfig {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    return {
      driver: ApolloDriver,
      path: '/graphql',
      // Written on startup in dev; production serves the schema from memory.
      autoSchemaFile: isProduction ? true : join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // Same Bearer-token check as AuthMiddleware does for REST.
      context: async ({ req, res }: GqlContext): Promise<GqlContext> => {
        if (!req.user) await this.auth.authenticate(req);
        return { req, res };
      },
      playground: false,
      introspection: !isProduction,
      plugins: isProduction ? [] : [ApolloServerPluginLandingPageLocalDefault()],
      // Errors come from AllExceptionsFilter; never add server stack traces.
      includeStacktraceInErrorResponses: false,
    };
  }
}
