import { meta, gameFor } from './logic.js';

export { meta };
export const start = (root, ctx) => gameFor(ctx.difficulty).start(root, ctx);
