import { z } from 'zod';

// All fields nullable AND optional: the prompt instructs the model to use null
// for absent fields, so the schema must accept null (spec §5).
export const contactFieldsSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  phones: z.array(z.string()).nullable().optional(),
  emails: z.array(z.string()).nullable().optional(),
  website: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export type RawContactFields = z.infer<typeof contactFieldsSchema>;

export interface ContactFields {
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phones: string[];
  emails: string[];
  website?: string;
  address?: string;
}

const str = (v: string | null | undefined): string | undefined => (v == null || v === '' ? undefined : v);

export function normalizeContactFields(raw: RawContactFields): ContactFields {
  const out: ContactFields = {
    phones: raw.phones ?? [],
    emails: raw.emails ?? [],
  };
  const firstName = str(raw.firstName);
  if (firstName) out.firstName = firstName;
  const lastName = str(raw.lastName);
  if (lastName) out.lastName = lastName;
  const company = str(raw.company);
  if (company) out.company = company;
  const jobTitle = str(raw.jobTitle);
  if (jobTitle) out.jobTitle = jobTitle;
  const website = str(raw.website);
  if (website) out.website = website;
  const address = str(raw.address);
  if (address) out.address = address;
  return out;
}

export function emptyContactFields(): ContactFields {
  return { phones: [], emails: [] };
}
