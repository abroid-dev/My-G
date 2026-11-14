/**
 * CONTENT SCHEMA
 * ----------------------------------------------------------------------------
 * Every fact on the site lives in /src/content. Components never hard-code
 * biography. To add information from Geleta's CV, edit or add files there;
 * the schema below will reject anything malformed at build time.
 *
 * Rule of the house: a figure is only allowed in `reconciliation` if it names
 * its `source`. Anything not yet known goes in `pending` and renders as a
 * visible placeholder (toggle with `showPlaceholders` in profile.yaml).
 */
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';

/** "YYYY-MM" month stamp, the precision LinkedIn gives us. */
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');

/** Chart-of-accounts codes. Add a new code here and in accounts.yaml together. */
const accountCode = z.enum(['1000', '2000', '3000', '4000', '5000']);

/** Chapters of the journey, in order. Defined in chapters.yaml. */
const chapterId = z.enum(['foundation', 'market', 'frontline', 'system', 'revenue']);

/** A measured outcome. Never add one without a source. */
const figure = z.object({
  figure: z.string(),          // e.g. "+38%"
  label: z.string(),           // e.g. "growth in active wallets, 2022"
  source: z.string(),          // e.g. "CV, 2026" — required on purpose
});

const status = z.enum(['draft', 'published']);

const profile = defineCollection({
  loader: file('src/content/profile.yaml'),
  schema: z.object({
    name: z.object({ first: z.string(), last: z.string() }),
    positioning: z.object({
      title: z.string(),
      provisional: z.boolean().default(false),
      alternatives: z.array(z.string()).default([]),
    }),
    linkedinHeadline: z.string(),
    location: z.string(),
    thesis: z.object({ lead: z.string(), mark: z.string() }),
    statement: z.array(z.string()),
    statementPending: z.array(z.string()).default([]),
    portraitAlt: z.string(),
    annotations: z.array(
      z.object({ key: z.string(), label: z.string(), detail: z.string(), study: z.string().optional() }),
    ),
    contact: z.object({
      email: z.string(),
      linkedin: z.string().url(),
      formEndpoint: z.string().default(''),
      /** Other profiles. Leave empty to hide; each shows with its official icon. */
      socials: z.object({
        instagram: z.string().default(''),
        x: z.string().default(''),
        telegram: z.string().default(''),
        whatsapp: z.string().default(''),
        facebook: z.string().default(''),
        tiktok: z.string().default(''),
      }).default({ instagram: '', x: '', telegram: '', whatsapp: '', facebook: '', tiktok: '' }),
      prompt: z.string(),
    }),
    seo: z.object({ title: z.string(), description: z.string(), siteUrl: z.string().url() }),
    showPlaceholders: z.boolean().default(true),
    topSkills: z.array(z.string()).default([]),
    skills: z.array(z.string()).default([]),
    languages: z.array(z.object({ name: z.string(), level: z.string() })).default([]),
  }),
});

const chapters = defineCollection({
  loader: file('src/content/chapters.yaml'),
  schema: z.object({
    order: z.number(),
    numeral: z.string(),
    title: z.string(),
    span: z.string(),
    carriedForward: z.string().optional(),
  }),
});

const entries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/entries' }),
  schema: z.object({
    org: z.string(),
    role: z.string(),
    roleNote: z.string().optional(),
    start: month,
    end: month.nullable().default(null), // null = present
    location: z.string().default('Addis Ababa, Ethiopia'),
    chapter: chapterId,
    current: z.boolean().default(false),
    featured: z.boolean().default(false), // the "Current entry" spread
    customerSide: z.array(z.string()).default([]),
    companySide: z.array(z.string()).default([]),
    /** Two short phrases for the opening spread's mini-ledger (optional). */
    brief: z.object({ customer: z.string(), company: z.string() }).optional(),
    accounts: z.array(accountCode).default([]),
    reconciliation: z.array(figure).default([]),
    pending: z.array(z.string()).default([]),
    status: status.default('published'),
  }),
});

const studies = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/studies' }),
  schema: z.object({
    institution: z.string(),
    award: z.string(),
    field: z.string(),
    kind: z.enum(['degree', 'diploma', 'certificate']),
    start: month.optional(),
    end: month.optional(),
    chapter: chapterId.optional(),
    items: z.array(z.string()).default([]),
    order: z.number().default(0),
  }),
});

const accounts = defineCollection({
  loader: file('src/content/accounts.yaml'),
  schema: z.object({
    code: accountCode,
    title: z.string(),
    note: z.string(),
    studies: z.array(z.string()).default([]),
  }),
});

/** Case studies. Only `published` ones get a page and appear on the home page. */
const cases = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cases' }),
  schema: z.object({
    title: z.string(),
    entry: z.string(), // id of the related entry, e.g. "ebirr-marketing"
    debit: z.string(), // the business need / challenge
    contribution: z.string(),
    execution: z.array(z.string()).default([]),
    reconciliation: z.array(figure).default([]),
    status: status.default('draft'),
  }),
});

/** Testimonials. Only real, permitted quotes; only `published` ones render. */
const references = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/references' }),
  schema: z.object({
    quote: z.string(),
    name: z.string(),
    title: z.string(),
    relationship: z.string(),
    permission: z.boolean().default(false),
    status: status.default('draft'),
  }),
});

export const collections = { profile, chapters, entries, studies, accounts, cases, references };
