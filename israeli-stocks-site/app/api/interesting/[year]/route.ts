import { NextResponse } from 'next/server';
import { getInteresting } from '@/lib/data';

export const revalidate = 300;

export async function GET(
  _req: Request,
  { params }: { params: { year: string } }
) {
  const data = await getInteresting(params.year);
  return NextResponse.json(data);
}
