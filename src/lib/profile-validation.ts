import { z } from 'zod';

export const usernameSchema = z.string()
  .trim()
  .min(2, 'Username must be at least 2 characters.')
  .max(24, 'Username must be 24 characters or fewer.')
  .regex(/^[a-z0-9 ._-]+$/i, 'Use English letters, numbers, spaces, dots, underscores, or hyphens.');

export const updateUsernameBodySchema = z.object({
  username: usernameSchema,
}).strict();
