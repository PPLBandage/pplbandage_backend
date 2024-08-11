import { Reflector } from '@nestjs/core';
import { RolesEnumType } from 'src/interfaces/types';

export const Roles = Reflector.createDecorator<RolesEnumType>();