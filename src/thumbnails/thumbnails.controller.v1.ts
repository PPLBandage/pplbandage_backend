import { Controller, Get, StreamableFile, UseGuards } from '@nestjs/common';
import { ThumbnailsService } from './thumbnails.service';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { Roles } from 'src/decorators/access.decorator';
import { Auth } from 'src/decorators/auth.decorator';

@Controller({ version: '1', path: 'beta/thumbnails' })
@UseGuards(AuthGuard, RolesGuard)
export class ThumbnailsController {
    constructor(private readonly thumbnailsService: ThumbnailsService) {}

    @Get('/')
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.SuperAdmin])
    async get() {
        return new StreamableFile(
            Buffer.from(
                await this.thumbnailsService.render(
                    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAKCAYAAAC9vt6cAAAACXBIWXMAAAsTAAALEwEAmpwYAAABdElEQVR4nIWQTUsCURSG5ye0bdumdi0K0RJNGItCDSyKsk20EIqsFFTwA4XSbBFCuahlEFi/IogWEa2qhRKkjU2hzozmbKrFG+fWDGZQBx7u5XLe53APF+dbICaT95jLqjr21DvDlZYZkeUn+DwVbM/U4R+9gnf4DOv8JTj90lG9h3X0ZZvsXVYaUN8+fvRsuhoIjRXArVjPf4U7iwSlR+HfPlba1Pb6M5ybr4P3lcBnSujZF9GdaTLoC4Tl4A4Wr4KctYCTKRm74yrC9gtQLmi4AeefrmDD8IKl/gb7c1dIwkSqBmesCmNSxkBehSEgwbvaYkuk/qBDQMReRnykDC7wLSA0gWOrBlesClNCxmBehSiKbIlrCyKoP+wUEOXLSAwp4PxugRkpbMu/6qcz+iWwnSooFotMQgHqp5OImB/A7ThrbKoW1gSEKaHoglmPiD3bLY7dzyxMOYItkQRauB1jXGJLNC8WkO6/xhEvMUhC0yn7CXdVWHBG4dMbAAAAAElFTkSuQmCC',
                    false
                ),
                'base64'
            ),
            { type: 'image/png' }
        );
    }
}
