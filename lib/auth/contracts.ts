import { z } from 'zod';
export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const loginSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
  name: z.string().trim().max(40).default(''),
  role: z.enum(['applicant', 'recruiter']),
});
export type LoginInput = z.infer<typeof loginSchema>;
