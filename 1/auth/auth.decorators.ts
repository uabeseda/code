import { SetMetadata } from '@nestjs/common';

export const NO_AUTH_CHECK_META_KEY = Symbol.for('NO_AUTH_CHECK_META_KEY');
export const NoAuthCheck = () => SetMetadata(NO_AUTH_CHECK_META_KEY, true);
