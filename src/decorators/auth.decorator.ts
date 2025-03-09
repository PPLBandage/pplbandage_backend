import { Reflector } from '@nestjs/core';
import { AuthEnumType } from 'src/interfaces/types';

export const Auth = Reflector.createDecorator<AuthEnumType>();
