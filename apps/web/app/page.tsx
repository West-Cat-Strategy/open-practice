import { renderOpenPracticeHome, type HomeSearchParams } from "./open-practice-home";

export const dynamic = "force-dynamic";

export default function Home({ searchParams }: { searchParams?: HomeSearchParams }) {
  return renderOpenPracticeHome({ searchParams });
}
