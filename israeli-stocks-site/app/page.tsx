import Shell from '@/components/Shell';
import categoriesData from '../public/data/categories.json';
import yearsData from '../public/data/interesting-years.json';

export default function Home() {
  return <Shell categories={categoriesData as any} interestingYears={yearsData} />;
}
