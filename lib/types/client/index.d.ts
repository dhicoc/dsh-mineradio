/**
 * Mineradio client plugin body.
 * @module dsh-theme-mineradio/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';

/** Required services: theme override stack plus the settings-card surfaces. */
export declare const inject: string[];
/** Client plugin body. */
export declare function apply(ctx: ClientContext): void;