import {
    Body,
    Controller,
    Delete,
    Get,
    Post,
    Put,
    UseGuards
} from '@nestjs/common';
import { Roles } from 'src/decorators/access.decorator';
import { Auth } from 'src/decorators/auth.decorator';
import { AuthGuard } from 'src/guards/auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { AuthEnum, RolesEnum } from 'src/interfaces/types';
import { EventsService } from 'src/workshop/events/events.service';
import { CreateEventDTO, DeleteEventDTO, EditEventDTO } from './dto/events.dto';

@Controller({ version: '1', path: 'admin/events' })
@UseGuards(AuthGuard, RolesGuard)
export class EventsController {
    constructor(private readonly eventsService: EventsService) {}

    @Get()
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.ManageEvents])
    async getAllEvents() {
        return await this.eventsService.getEvents();
    }

    @Post()
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.ManageEvents])
    async createEvent(@Body() body: CreateEventDTO) {
        return await this.eventsService.createEvent(body);
    }

    @Put()
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.ManageEvents])
    async updateEvent(@Body() body: EditEventDTO) {
        return await this.eventsService.editEvent(body);
    }

    @Delete()
    @Auth(AuthEnum.Strict)
    @Roles([RolesEnum.ManageEvents])
    async deleteEvent(@Body() body: DeleteEventDTO) {
        return await this.eventsService.deleteEvent(body);
    }
}
