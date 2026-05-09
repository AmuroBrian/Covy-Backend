import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Syncs a user from Supabase to Prisma.
   * Finds the user by their Supabase providerId (sub), or creates a new one.
   */
  async syncUser(supabaseUserId: string, email?: string) {
    let user = await this.prisma.user.findFirst({
      where: { providerId: supabaseUserId },
    });

    if (!user) {
      const inviteCode = await this.generateUniqueInviteCode();
      user = await this.prisma.user.create({
        data: {
          providerId: supabaseUserId,
          email: email,
          inviteCode: inviteCode,
        },
      });
    }

    return user;
  }

  /**
   * Generates a unique 6-character alphanumeric invite code.
   */
  private async generateUniqueInviteCode(): Promise<string> {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    let isUnique = false;

    while (!isUnique) {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existingUser = await this.prisma.user.findUnique({
        where: { inviteCode: code },
      });

      if (!existingUser) {
        isUnique = true;
      }
    }

    return code;
  }

  async findByInviteCode(inviteCode: string) {
    return this.prisma.user.findUnique({
      where: { inviteCode },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }
}
