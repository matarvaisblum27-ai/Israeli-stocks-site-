import { supabase, Category, Company, InterestingEntry, InterestingPreamble } from './supabase';

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('position');
  if (error) throw error;
  return data || [];
}

export async function getCompaniesByCategory(categoryId: number): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('category_id', categoryId)
    .order('position');
  if (error) throw error;
  return data || [];
}

export async function getAllCompanies(): Promise<Company[]> {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .order('category_id')
    .order('position');
  if (error) throw error;
  return data || [];
}

export async function getInteresting(year: string): Promise<{
  preamble: string;
  companies: InterestingEntry[];
}> {
  const [{ data: pre }, { data: list }] = await Promise.all([
    supabase.from('interesting_preamble').select('*').eq('year', year).maybeSingle(),
    supabase.from('interesting_index').select('*').eq('year', year).order('num'),
  ]);
  return {
    preamble: pre?.preamble || '',
    companies: list || [],
  };
}

export async function getInterestingYears(): Promise<string[]> {
  const { data } = await supabase
    .from('interesting_preamble')
    .select('year')
    .order('year', { ascending: false });
  return (data || []).map((r) => r.year);
}
