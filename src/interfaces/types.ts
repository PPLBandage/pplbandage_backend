type ValueOf<T> = T[keyof T];

export const RolesEnum = {
    SuperAdmin: 99,
    Default: 0
} as const;

export type RolesEnumType = ValueOf<typeof RolesEnum>;

export const AuthEnum = {
    Strict: 'Strict',
    Weak: 'Weak'
} as const;

export type AuthEnumType = ValueOf<typeof AuthEnum>;
