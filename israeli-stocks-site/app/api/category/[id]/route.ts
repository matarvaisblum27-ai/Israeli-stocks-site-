import { NextResponse } from 'next/server';
import { getCompaniesByCategory } from '@/lib/data';

export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const companies = await getCompaniesByCategory(Number(params.id));
  return NextResponse.json({ companies });
}
