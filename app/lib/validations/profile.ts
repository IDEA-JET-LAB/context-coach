import { z } from "zod";

export const profileFormSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(255, "Name must be less than 255 characters")
    .trim(),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;
