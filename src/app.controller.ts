import { Controller, Get, Header, HttpException, HttpStatus, Param, Query, Req, Res, StreamableFile, Delete, Put, Post, Body } from '@nestjs/common';
import type { Request, Response } from 'express'
import { MinecraftService } from "./minecraft.service";
import { Buffer } from "buffer";
import { UserService } from './user.module';
import { BandageService } from './bandage.service';
import * as sharp from 'sharp';
import { SkipThrottle, Throttle } from '@nestjs/throttler';


const UNAUTHORIZED = {
    status: "error",
    message: "UNAUTHORIZED",
    statusCode: 401
}

interface CreateBody {
    base64: string, 
    title: string, 
    description: string
}

const rate_limit = 5;

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
    async discord(@Param('code') code: string, @Res({ passthrough: true }) res: Response): Promise<void> {
        const data = await this.userService.login(code);
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
    async user_profile(@Req() request: Request, @Res() res: Response): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }
        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', session.cookie);

        const data = await this.userService.getUser(session.sessionId);
        res.send(data);
        return;
    }

    @Delete("/users/logout")
    async logout(@Req() request: Request, @Res() res: Response): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        this.userService.logout(session);
        res.status(200).send({"status": "success"});
    }

    @Get("/bandages")
    async bandages(@Req() request: Request, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        res.status(200).send(await this.bandageService.getBandages(request.cookies.sessionId, 
            parseInt(query.take as string) || 20, 
            parseInt(query.page as string) || 0, 
            query.search, 
            query.filters,
            query.sort));
    }

    @Put("/star/:id")
    async setStar(@Param('id') id: string, @Query() query: { set: string }, @Req() request: Request, @Res() res: Response): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }
        if (!query.set || !["true", "false"].includes(query.set)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "`Set` query param invalid",
                statusCode: 400
            });
            return;
        }
        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', session.cookie);

        const data = await this.bandageService.setStar(session, query.set === "true", id);
        res.status(data.statusCode).send(data);
    }


    @Post("/workshop/create")
    async create_bandage(@Req() request: Request, @Res() res: Response, @Body() body: CreateBody): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }
        
        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', session.cookie);
        if (!body.base64 || !body.title || !body.description) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Invalid Body",
                statusCode: 400
            });
            return;
        }

        if (body.title.length > 50) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Title cannot be longer than 50 symbols",
                statusCode: 400
            });
            return;
        }

        if (body.description.length > 300) {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Description cannot be longer than 300 symbols",
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
                    statusCode: 400
                });
                return;
            }
        } catch {
            res.status(HttpStatus.BAD_REQUEST).send({
                message: "Error while parcing base64",
                statusCode: 400
            });
            return;
        }

        const data = await this.bandageService.createBandage(body.base64, body.title, body.description, session.sessionId);
        res.status(data.statusCode).send(data);
    }

    @Get("/categories")
    async categories(@Req() request: Request, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        res.status(200).send(await this.bandageService.getCategories(query.for_edit === "true", request.cookies.sessionId));
    }

    @Get("/users/me/works")
    async getWork(@Req() request: Request, @Res() res: Response): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', session.cookie);

        const data = await this.bandageService.getWork(session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/users/me/stars")
    async getStars(@Req() request: Request, @Res() res: Response): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', session.cookie);

        const data = await this.bandageService.getStars(session);
        res.status(data.statusCode).send(data.data);
    }

    @Get("/users/me/connections")
    async minecraft(@Req() request: Request, @Res() res: Response): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', session.cookie);

        const data = await this.userService.getConnections(session);
        res.status(data.statusCode).send(data);
    }

    @Put("/users/me/connections/minecraft/set_valid")
    async set_valid(@Req() request: Request, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        if (!query.state || !["true", "false"].includes(query.state)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "`State` query param invalid",
                statusCode: 400
            });
            return;
        }
        const data = await this.minecraftService.changeValid(session, query.state === "true");
        res.status(data.statusCode).send(data);
    }

    @Put("/users/me/connections/minecraft/set_autoload")
    async set_autoload(@Req() request: Request, @Res() res: Response, @Query() query: SearchQuery): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        if (!query.state || !["true", "false"].includes(query.state)) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "`State` query param invalid",
                statusCode: 400
            });
            return;
        }
        const data = await this.minecraftService.changeAutoload(session, query.state === "true");
        res.status(data.statusCode).send(data);
    }

    @Post("/users/me/connections/minecraft/connect/:code")
    async connectMinecraft(@Param('code') code: string, @Req() request: Request, @Res() res: Response): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        if (code.length != 6) {
            res.status(HttpStatus.BAD_REQUEST).send({
                status: "error",
                message: "Invalid code",
                message_ru: "Код должен содержать 6 символов!"
            });
            return;
        }
        
        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', session.cookie);

        const data = await this.minecraftService.connect(session, code);
        res.status(data.statusCode).send(data);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post("/users/me/connections/cache/purge")
    async skinPurge(@Req() request: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        if (!session.user.profile) {
            res.status(400).send({
                message: "Could not find associated Minecraft account",
            });
            return;
        }

        const cache = await this.minecraftService.updateSkinCache(session.user.profile.uuid, true);
        if (!cache) {
            res.status(404).send({message: 'Profile not found'});
            return;
        }

        res.status(200).send({
            message: "Successfully purged",
        });
    }


    @Delete("/users/me/connections/minecraft/disconnect")
    async disconnectMinecraft(@Req() request: Request, @Res() res: Response): Promise<void> {
        const session = await this.userService.validateSession(request.cookies.sessionId);
        if (!session) {
            res.status(HttpStatus.UNAUTHORIZED).send(UNAUTHORIZED);
            return;
        }

        res.setHeader('Access-Control-Expose-Headers', 'SetCookie');
        res.setHeader('SetCookie', session.cookie);

        const data = await this.minecraftService.disconnect(session);
        res.status(data.statusCode).send(data);
    }

    @Get("/bandages/:id")
    async getBandage(@Param('id') id: string, @Req() request: Request, @Res() res: Response): Promise<void> {
        const data = await this.bandageService.getBandage(id, request.cookies.sessionId);
        res.status(data.statusCode).send(data);
    }

}
