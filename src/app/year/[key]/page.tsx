import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PeriodBoard } from "@/components/board/period-board";
import { BoardSkeleton } from "@/components/board/week-board";
import { Container } from "@/components/ui/primitives";
import { isYearKey } from "@/lib/periods";

export async function generateMetadata(props: PageProps<"/year/[key]">): Promise<Metadata> {
  const { key } = await props.params;
  if (!isYearKey(key)) return {};
  return {
    title: `Best new products of ${key}`,
    description: `The top products that debuted on DebutYard in ${key}, ranked by the community.`,
  };
}

export default function YearPage(props: PageProps<"/year/[key]">) {
  return (
    <Suspense
      fallback={
        <Container className="max-w-4xl py-12">
          <BoardSkeleton />
        </Container>
      }
    >
      <Year params={props.params} />
    </Suspense>
  );
}

async function Year({ params }: { params: PageProps<"/year/[key]">["params"] }) {
  const { key } = await params;
  if (!isYearKey(key) || Number(key) > new Date().getUTCFullYear() || Number(key) < 2026) notFound();
  return <PeriodBoard scope="year" periodKey={key} />;
}
