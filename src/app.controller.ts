import { Controller, Get, Header, HttpException, HttpStatus, Param, Query, Req, Res, StreamableFile, Delete, Put, Post, Body, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express'
import { MinecraftService } from "./minecraft.service";
import { Buffer } from "buffer";
import { UserService } from './user.module';
import { BandageService } from './bandage.service';
import * as sharp from 'sharp';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthGuard } from './auth.guard';


export const UNAUTHORIZED = {
    status: "error",
    message: "UNAUTHORIZED",
    statusCode: 401
}

interface RequestSession extends Request {
    session: Session
}

@Controller('/api')
export class AppController {

    constructor(private readonly userService: UserService,
                private readonly bandageService: BandageService,
                private readonly minecraftService: MinecraftService
    ) { }

    @Get()
    async root(@Res({ passthrough: true }) res: Response){
        res.redirect(301, "/");
    }

    @Get("/profile/:name")
    async profile(@Param('name') name: string, @Res({ passthrough: true }) res: Response): Promise<ProfileResponse | DefaultResponse | void> {
        const data = await this.minecraftService.getUserData(name);
        if (!data) {
            res.status(404).send({message: 'Profile not found'});
            return;
        }
        const textures = atob(data.properties[0].value);
        const data_properties = JSON.parse(textures) as EncodedResponse;
        return {
            message: "",
            timestamp: data_properties.timestamp,
            uuid: data.id,
            nickname: data.name,
            textures: {
                SKIN: {
                    mojang: data_properties.textures.SKIN.url,
                    eldraxis: `https://new-eldraxis.andcool.ru/skin/${data.id}`
                },
                CAPE: {
                    mojang: data_properties.textures.CAPE?.url,
                    eldraxis: `https://new-eldraxis.andcool.ru/cape/${data.id}`
                }
            }
        };
    }

    @Get("/skin/:name")
    async skin(@Param('name') name: string, @Query() query: { cape: boolean }, @Res({ passthrough: true }) res: Response): Promise<CapeResponse | void> {
        const cache = await this.minecraftService.updateSkinCache(name);
        if (!cache) {
            res.status(404).send({message: 'Profile not found'});
            return;
        }
        if (!query.cape) {
            const skin_buff = Buffer.from(cache.data, "base64");
            res.set({ 'Content-Type': 'image/png', 'Content-Length': skin_buff.length });
            res.end(skin_buff);
            return;
        }
        return {
            message: "",
            data: {
                skin: {
                    data: cache.data,
                    slim: cache.slim
                },
                cape: cache.data_cape
            }
        };
    }

    @Get("/head/:name")
    @Header('Content-Type', 'image/png')
    async head(@Param('name') name: string): Promise<StreamableFile> {
        const cache = await this.minecraftService.updateSkinCache(name);
        if (!cache) {
            throw new HttpException({message: 'Profile not found'}, HttpStatus.NOT_FOUND);
        }
        return new StreamableFile(Buffer.from(cache.data_head, "base64"));
    }

    @Get("/cape/:name")
    @Header('Content-Type', 'image/png')
    async cape(@Param('name') name: string, @Res({ passthrough: true }) res: Response): Promise<StreamableFile | void> {
        const cache = await this.minecraftService.updateSkinCache(name);
        if (!cache) {
            res.status(404).send({message: 'Profile not found'});
            return;
        }
        if (!cache.data_cape) {
            res.status(404).send({message: 'No cape on this profile'});
            return;
        }
        const skin_buff = Buffer.from(cache.data_cape, "base64");
        return new StreamableFile(skin_buff);
    }


    @Get("/search/:name")
    async search(@Param('name') name: string, @Query() query: SearchQuery): Promise<Search> {
        const cache = await this.minecraftService.searchNicks({ fragment: name, take: parseInt(query.take as string) || 20, page: parseInt(query.page as string) || 0 });
        if (!cache) {
            throw new HttpException({message: 'No content'}, HttpStatus.NO_CONTENT);
        }
        return cache;
    }


    @Get("/oauth/discord/:code")
    async discord(@Param('code') code: string, @Req() request: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        const user_agent = request.headers['user-agent'] as string;
        const data = await this.userService.login(code, user_agent);
        if (!data) {
            res.status(400).send({status: "error", message: "could not login"});
            return;
        }
        if (data.statusCode !== 200) {
            res.status(data.statusCode).send(data);
            return;
        }

        const date = new Date((new Date()).getTime() + (Number(process.env.SESSION_TTL) * 1000));
        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', `sessionId=${data.sessionId}; Path=/; Expires=${date.toUTCString()}; SameSite=Strict`);

        res.send(data);
    }

    @Get("/users/me")
    @UseGuards(AuthGuard)
    async user_profile(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        const data = await this.userService.getUser(request.session.sessionId);
        res.status(data.statusCode).send(data);
    }

    @Delete("/users/me")
    async logout(@Req() request: Request, @Res() res: Response): Promise<void> {
        const user_agent = request.headers['user-agent'];
        const session = await this.userService.validateSession(request.cookies.sessionId, user_agent as string);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        await this.userService.logout(session);
        res.status(200).send({"status": "success"});
    }

    
    @Get("/users/me/works")
    @UseGuards(AuthGuard)
    async getWork(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        const data = await this.bandageService.getWork(request.session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/users/me/stars")
    @UseGuards(AuthGuard)
    async getStars(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        const data = await this.bandageService.getStars(request.session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/users/me/connections")
    @UseGuards(AuthGuard)
    async minecraft(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        const data = await this.userService.getConnections(request.session);
        res.status(data.statusCode).send(data);
    }

    @Put("/users/me/connections/minecraft/set_valid")
    @UseGuards(AuthGuard)
    async set_valid(@Req() request: RequestSession, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        if (!query.state || !["true", "false"].includes(query.state)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "`State` query param invalid",
                statusCode: 400
            });
            return;
        }
        const data = await this.minecraftService.changeValid(request.session, query.state === "true");
        res.status(data.statusCode).send(data);
    }

    @Put("/users/me/connections/minecraft/set_autoload")
    @UseGuards(AuthGuard)
    async set_autoload(@Req() request: RequestSession, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        if (!query.state || !["true", "false"].includes(query.state)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "`State` query param invalid",
                statusCode: 400
            });
            return;
        }
        const data = await this.minecraftService.changeAutoload(request.session, query.state === "true");
        res.status(data.statusCode).send(data);
    }

    @Post("/users/me/connections/minecraft/connect/:code")
    @UseGuards(AuthGuard)
    async connectMinecraft(@Param('code') code: string, @Req() request: RequestSession, @Res() res: Response): Promise<void> {
        if (code.length != 6) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "Invalid code",
                message_ru: "Код должен содержать 6 символов!"
            });
            return;
        }

        const data = await this.minecraftService.connect(request.session, code);
        res.status(data.statusCode).send(data);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post("/users/me/connections/minecraft/cache/purge")
    @UseGuards(AuthGuard)
    async skinPurge(@Req() request: RequestSession, @Res({ passthrough: true }) res: Response): Promise<void> {
        if (!request.session.user.profile) {
            res.status(400).send({
                message: "Could not find associated Minecraft account",
            });
            return;
        }

        const cache = await this.minecraftService.updateSkinCache(request.session.user.profile.uuid, true);
        if (!cache) {
            res.status(404).send({message: 'Profile not found'});
            return;
        }

        res.status(200).send({
            message: "Successfully purged",
        });
    }

    @Delete("/users/me/connections/minecraft")
    @UseGuards(AuthGuard)
    async disconnectMinecraft(@Req() request: RequestSession, @Res() res: Response): Promise<void> {
        const data = await this.minecraftService.disconnect(request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/workshop")
    async bandages(@Req() request: Request, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        const user_agent = request.headers['user-agent'] as string;
        res.status(200).send(await this.bandageService.getBandages(request.cookies.sessionId, 
            parseInt(query.take as string) || 20, 
            parseInt(query.page as string) || 0,
            user_agent, 
            query.search, 
            query.filters,
            query.sort));
    }


    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post("/workshop")
    @UseGuards(AuthGuard)
    async create_bandage(@Req() request: RequestSession, @Res() res: Response, @Body() body: CreateBody): Promise<void> {
       if (!body.base64 || !body.title) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Invalid Body",
                statusCode: 400
            });
            return;
        }

        if (body.title.length > 50) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Title cannot be longer than 50 symbols",
                message_ru: "Заголовок не может быть длиннее 50 символов",
                statusCode: 400
            });
            return;
        }

        if (body.description.length > 300) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Description cannot be longer than 300 symbols",
                message_ru: "Описание не может быть длиннее 300 символов",
                statusCode: 400
            });
            return;
        }

        try {
            const bandage_buff = Buffer.from(body.base64, 'base64');
            const bandage_sharp = sharp(bandage_buff);
            const metadata = await bandage_sharp.metadata();
            const width = metadata.width as number;
            const height = metadata.height as number;
            if (width != 16 || (height < 2 || height > 24 || height % 2 != 0) || metadata.format != 'png'){
                res.status(HttpStatus.BAD_REQUEST).send({
                    message: "Invalid bandage size or format!",
                    message_ru: "Повязка должна иметь ширину 16 пикселей, высоту от 2 до 24 пикселей и четную высоту",
                    statusCode: 400
                });
                return;
            }
        } catch {
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
                message: "Error while processing base64",
                statusCode: 500
            });
            return;
        }

        const data = await this.bandageService.createBandage(body, request.session);
        res.status(data.statusCode).send(data);
    }

    @Get("/workshop/:id")
    @SkipThrottle()
    async getBandage(@Param('id') id: string, @Req() request: Request, @Res() res: Response): Promise<void> {
        if (request.headers['unique-access'] !== process.env.WORKSHOP_TOKEN) {
            res.redirect(307, `/workshop/${id}`);
            return;
        } 
        const user_agent = request.headers['user-agent'] as string;
        const data = await this.bandageService.getBandage(id, request.cookies.sessionId, user_agent);
        res.status(data.statusCode).send(data);
    }

    @Get("/workshop/:id/as_image")
    @Header('Content-Type', 'image/png')
    async getBandageImage(@Param('id') id: string, @Req() request: Request, @Res({ passthrough: true }) res: Response): Promise<StreamableFile | void> {
        const user_agent = request.headers['user-agent'] as string;
        const data = await this.bandageService.getBandage(id, request.cookies.sessionId, user_agent);
        if (data.statusCode !== 200 || !data.data?.base64) {
            res.status(data.statusCode).send(data);
            return;
        }
        const bandage_buff = Buffer.from(data.data.base64, "base64");

        const sharp_obj = sharp(bandage_buff);
        const metadata = await sharp_obj.metadata();
        const width = (metadata.width as number) * 16;
        const height = (metadata.height as number) * 16;
        sharp.kernel.nearest
        const buffer = await sharp_obj.resize(width, height, { kernel: sharp.kernel.nearest }).toBuffer();
        return new StreamableFile(buffer);
    }

    @Put("/workshop/:id")
    @UseGuards(AuthGuard)
    async editBandage(@Param('id') id: string, @Req() request: RequestSession, @Res() res: Response, @Body() body: CreateBody) {
        if (!body) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Invalid Body",
                statusCode: 400
            });
            return;
        }

        if (body.title?.length > 50) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Title cannot be longer than 50 symbols",
                statusCode: 400
            });
            return;
        }

        if (body.description?.length > 300) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Description cannot be longer than 300 symbols",
                statusCode: 400
            });
            return;
        }

        const data = await this.bandageService.updateBandage(id, body, request.session);
        res.status(data.statusCode).send(data);

    }

    @Delete("/workshop/:id")
    @UseGuards(AuthGuard)
    async deleteBandage(@Param('id') id: string, @Req() request: RequestSession, @Res() res: Response) {
        const data = await this.bandageService.deleteBandage(request.session, id);
        res.status(data.statusCode).send(data);

    }

    @Get("/categories")
    async categories(@Req() request: Request, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        const user_agent = request.headers['user-agent'] as string;
        res.status(200).send(await this.bandageService.getCategories(query.for_edit === "true", request.cookies.sessionId, user_agent));
    }


    @Put("/star/:id")
    @UseGuards(AuthGuard)
    async setStar(@Param('id') id: string, @Query() query: { set: string }, @Req() request: RequestSession, @Res() res: Response): Promise<void> {
        if (!query.set || !["true", "false"].includes(query.set)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "`Set` query param invalid",
                statusCode: 400
            });
            return;
        }
        const data = await this.bandageService.setStar(request.session, query.set === "true", id);
        res.status(data.statusCode).send(data);
    }

}
