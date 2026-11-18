import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { UserRole } from '../../../graphql/enums.js';

/** Same fields as USER_PROFILE_SELECT; never any password data. */
@ObjectType('UserProfile')
export class UserProfileModel {
  @Field(() => ID) id: string;
  @Field() email: string;
  @Field(() => String, { nullable: true }) phone: string | null;
  @Field() firstName: string;
  @Field() lastName: string;
  @Field(() => UserRole) role: UserRole;
  @Field() isEmailVerified: boolean;
  @Field() isActive: boolean;
  @Field(() => Int) loyaltyPoints: number;
  @Field() referralCode: string;
  @Field() createdAt: Date;
  @Field() updatedAt: Date;
}
