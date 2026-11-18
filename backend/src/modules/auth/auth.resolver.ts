import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../common/decorators/index.js';
import { AuthService } from './auth.service.js';
import { UpdateProfileDto } from './dto/index.js';
import { UserProfileModel } from './entities/user-profile.model.js';

/** Login/refresh stay REST (cookies); GraphQL reads the session via the Bearer token. */
@Resolver(() => UserProfileModel)
export class AuthResolver {
  constructor(private readonly auth: AuthService) {}

  @Query(() => UserProfileModel, { description: '1.8 The logged-in user (Bearer token required)' })
  me(@CurrentUser('id') userId: string) {
    return this.auth.getProfile(userId);
  }

  @Mutation(() => UserProfileModel, { description: '10.1' })
  updateProfile(@CurrentUser('id') userId: string, @Args('input') input: UpdateProfileDto) {
    return this.auth.updateProfile(userId, input);
  }
}
