import { Injectable } from '@nestjs/common';
import { Session } from 'src/auth/auth.service';
import { DiscordAuthService } from 'src/auth/providers/discord/discord.service';
import { GoogleAuthService } from 'src/auth/providers/google/google.service';
import { TwitchAuthService } from 'src/auth/providers/twitch/twitch.service';
import { LocaleException } from 'src/interceptors/localization.interceptor';
import responses_minecraft from 'src/localization/minecraft.localization';
import { MinecraftService } from 'src/minecraft/minecraft.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ConnectionsService {
    constructor(
        private prisma: PrismaService,
        public minecraftService: MinecraftService,
        private discordAuthService: DiscordAuthService,
        private googleAuthService: GoogleAuthService,
        private twitchAuthService: TwitchAuthService
    ) {}

    /** Get list of connected accounts */
    async getConnections(session: Session) {
        const user = await this.prisma.user.findUniqueOrThrow({
            where: { id: session.user.id },
            include: {
                profile: true,
                DiscordAuth: true,
                GoogleAuth: true,
                TwitchAuth: true
            }
        });

        const minecraft = user.profile
            ? {
                  nickname: user.profile.default_nick,
                  uuid: user.profile.uuid,
                  last_cached:
                      Number(user.profile.expires) -
                      parseInt(process.env.TTL as string),
                  valid: user.profile.valid,
                  autoload: session.user.UserSettings?.autoload
              }
            : null;

        const discord = user.DiscordAuth
            ? {
                  user_id: user.DiscordAuth.discord_id,
                  name: user.DiscordAuth.name,
                  username: user.DiscordAuth.username,
                  connected_at: user.DiscordAuth.connected_at
              }
            : null;

        const google = user.GoogleAuth
            ? {
                  sub: user.GoogleAuth.sub,
                  email: user.GoogleAuth.email,
                  name: user.GoogleAuth.name,
                  connected_at: user.GoogleAuth.connected_at
              }
            : null;

        const twitch = user.TwitchAuth
            ? {
                  uid: user.TwitchAuth.uid,
                  login: user.TwitchAuth.login,
                  name: user.TwitchAuth.name,
                  connected_at: user.TwitchAuth.connected_at
              }
            : null;

        return {
            userID: user.id,
            google,
            twitch,
            discord,
            minecraft
        };
    }

    /** Connect minecraft account to a user profile */
    async connectMinecraft(session: Session, code: string) {
        if (session.user.profile)
            throw new LocaleException(
                responses_minecraft.ALREADY_CONNECTED,
                409
            );

        const data = await this.minecraftService.getByCode(code);
        const skin_data = await this.minecraftService.updateSkinCache(
            data.UUID,
            true
        );

        if (skin_data.userId)
            throw new LocaleException(
                responses_minecraft.ANOTHER_ALREADY_CONNECTED,
                409
            );

        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { profile: { connect: { id: skin_data.id } } }
        });

        return { uuid: skin_data.uuid };
    }

    /** Disconnect minecraft account */
    async disconnectMinecraft(session: Session) {
        if (!session.user.profile)
            throw new LocaleException(
                responses_minecraft.ACCOUNT_NOT_CONNECTED,
                404
            );

        await this.prisma.user.update({
            where: { id: session.user.id },
            data: { profile: { disconnect: { id: session.user.profile.id } } }
        });
    }

    /** Connect discord account */
    async connectDiscord(session: Session, code: string) {
        const data = await this.discordAuthService.getData(
            code,
            process.env.DISCORD_REDIRECT_CONNECT as string
        );
        const record = await this.prisma.discordAuth.findFirst({
            where: { discord_id: data.id }
        });

        if (record)
            throw new LocaleException(
                responses_minecraft.ALREADY_CONNECTED,
                409
            );

        const avatar = await this.discordAuthService.updateAvatar(
            data.avatar,
            data.id
        );

        await this.prisma.discordAuth.create({
            data: {
                discord_id: data.id,
                name: data.global_name || data.username,
                username: data.username,
                avatar_id: avatar,
                user: { connect: { id: session.user.id } }
            }
        });
    }

    /** Disconnect discord account */
    async disconnectDiscord(session: Session) {
        const record = await this.prisma.discordAuth.findFirst({
            where: { userid: session.user.id }
        });

        if (!record)
            throw new LocaleException(
                responses_minecraft.ACCOUNT_NOT_CONNECTED,
                400
            );

        await this.prisma.discordAuth.delete({ where: { id: record.id } });
        if (record.avatar_id)
            this.discordAuthService.deleteAvatar(record.avatar_id);
    }

    /** Connect google account */
    async connectGoogle(session: Session, code: string) {
        const data = await this.googleAuthService.getData(
            code,
            process.env.GOOGLE_REDIRECT_CONNECT as string
        );
        const record = await this.prisma.googleAuth.findFirst({
            where: { sub: data.sub }
        });

        if (record)
            throw new LocaleException(
                responses_minecraft.ALREADY_CONNECTED,
                409
            );

        const avatar = await this.googleAuthService.updateAvatar(data.picture);
        const name = this.googleAuthService.getName(data);

        await this.prisma.googleAuth.create({
            data: {
                sub: data.sub,
                email: this.googleAuthService.maskEmail(data.email),
                name,

                avatar_id: avatar,
                user: { connect: { id: session.user.id } }
            }
        });
    }

    /** Disconnect google account */
    async disconnectGoogle(session: Session) {
        const record = await this.prisma.googleAuth.findFirst({
            where: { userid: session.user.id }
        });

        if (!record)
            throw new LocaleException(
                responses_minecraft.ACCOUNT_NOT_CONNECTED,
                400
            );

        await this.prisma.googleAuth.delete({ where: { id: record.id } });
        if (record.avatar_id)
            this.googleAuthService.deleteAvatar(record.avatar_id);
    }

    /** Connect twitch account */
    async connectTwitch(session: Session, code: string) {
        const data = await this.twitchAuthService.getData(
            code,
            process.env.TWITCH_REDIRECT_CONNECT as string
        );
        const record = await this.prisma.twitchAuth.findFirst({
            where: { uid: data.id }
        });

        if (record)
            throw new LocaleException(
                responses_minecraft.ALREADY_CONNECTED,
                409
            );

        const avatar = await this.twitchAuthService.updateAvatar(
            data.profile_image_url
        );

        await this.prisma.twitchAuth.create({
            data: {
                uid: data.id,
                login: data.login,
                name: data.display_name || data.login,

                avatar_id: avatar,
                user: { connect: { id: session.user.id } }
            }
        });
    }

    /** Disconnect twitch account */
    async disconnectTwitch(session: Session) {
        const record = await this.prisma.twitchAuth.findFirst({
            where: { userid: session.user.id }
        });

        if (!record)
            throw new LocaleException(
                responses_minecraft.ACCOUNT_NOT_CONNECTED,
                400
            );

        await this.prisma.twitchAuth.delete({ where: { id: record.id } });
        if (record.avatar_id)
            this.twitchAuthService.deleteAvatar(record.avatar_id);
    }
}

