import { Controller, Get, HttpException, HttpStatus, Param, Query, Req, Res } from '@nestjs/common';
import type { Response} from 'express'
import { getUserData, updateSkinCache, searchNicks } from "./app.service";
import { Buffer } from "buffer";

@Controller()
export class AppController {

	@Get()
	async root(): Promise<DefaultResponse> {
		return {status: "success", message: "Welcome to new Eldraxis project!"};
	}

	@Get("/profile/:name")
	async profile(@Param('name') name: string, @Res({ passthrough: true }) res: Response): Promise<ProfileResponse | DefaultResponse> {
		const data = await getUserData(name);
		if (!data){
			throw new HttpException('Profile not found', HttpStatus.NOT_FOUND);
		}
		const textures = atob(data.properties[0].value);
    	const data_properties = JSON.parse(textures) as EncodedResponse;
		return {
			status: "success",
			message: "",
			timestamp: data_properties.timestamp,
			uuid: data.id,
			nickname: data.name,
			textures: {
				SKIN: {
					mojang: data_properties.textures.SKIN.url,
					eldraxis: `https://new-eldraxis.andcool.ru/skin/${data.id}`
				},
				CAPE:{
					mojang: data_properties.textures.CAPE?.url,
					eldraxis: `https://new-eldraxis.andcool.ru/cape/${data.id}`
				}
			}
		};
	}

	@Get("/skin/:name")
	async skin(@Param('name') name: string, @Query() query: {cape: boolean}, @Res({ passthrough: true }) res: Response): Promise<CapeResponse | void> {
		const cache = await updateSkinCache(name);
		if (!cache){
			throw new HttpException('Profile not found', HttpStatus.NOT_FOUND);
		}
		if (!query.cape){
			const skin_buff = Buffer.from(cache.data, "base64");
			res.set({'Content-Type': 'image/png', 'Content-Length': skin_buff.length});
			res.end(skin_buff);
			return;
		}
		return {
			status: "success",
			message: "",
			data: {
				skin: cache.data,
				cape: cache.data_cape
			}
		};
	}

	@Get("/head/:name")
	async head(@Param('name') name: string, @Res({ passthrough: true }) res: Response): Promise<void> {
		const cache = await updateSkinCache(name);
		if (!cache){
			throw new HttpException('Profile not found', HttpStatus.NOT_FOUND);
		}
		const skin_buff = Buffer.from(cache.data_head, "base64");
		res.set({'Content-Type': 'image/png', 'Content-Length': skin_buff.length});
		res.end(skin_buff);
	}

	@Get("/cape/:name")
	async cape(@Param('name') name: string, @Res({ passthrough: true }) res: Response): Promise<void> {
		const cache = await updateSkinCache(name);
		if (!cache){
			throw new HttpException('Profile not found', HttpStatus.NOT_FOUND);
		}
		if (!cache.data_cape){
			throw new HttpException('No cape on this profile', HttpStatus.NOT_FOUND);
		}
		const skin_buff = Buffer.from(cache.data_cape, "base64");
		res.set({'Content-Type': 'image/png', 'Content-Length': skin_buff.length});
		res.end(skin_buff);
	}


	@Get("/search/:name")
	async search(@Param('name') name: string, @Query() query: SearchQuery): Promise<Search> {
		const cache = await searchNicks({fragment: name, take: parseInt(query.take) || 20, page: parseInt(query.page) || 0});
		if (!cache){
			throw new HttpException('No content', HttpStatus.NO_CONTENT);
		}
		return cache;
	}
}
