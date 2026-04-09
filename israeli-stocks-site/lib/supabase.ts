import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});

export type Category = {
  id: number;
  name: string;
  position: number;
  intro: Record<string, string> | null;
};

export type Company = {
  id: number;
  category_id: number;
  name: string;
  position: number;
  ticker: string | null;
  reviews: Record<string, string>;
};

export type InterestingEntry = {
  id: number;
  year: string;
  num: number;
  name: string;
  html: string;
};

export type InterestingPreamble = {
  year: string;
  preamble: string;
};
