import { getCategories, getInterestingYears } from '@/lib/data';
import Shell from '@/components/Shell';

export const revalidate = 300;

export default async function Home() {
  const [categories, interestingYears] = await Promise.all([
    getCategories(),
    getInterestingYears(),
  ]);
  return <Shell categories={categories} interestingYears={interestingYears} />;
}
