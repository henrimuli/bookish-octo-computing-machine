import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PeriodBoard } from "@/components/board/period-board";
import { BoardSkeleton } from "@/components/board/week-board";
import { Container } from "@/components/ui/primitives";
import { formatMonthLabel, isMonthKey } from "@/lib/periods";

export async function generateMetadata(props: PageProps<"/month/[key]">): Promise<Metadata> {
  const { key } = await props.params;
  if (!isMonthKey(key)) return {};
  return {
    title: `Best new products of ${formatMonthLabel(key)}`,
    description: `Every product that debuted on DebutYard in ${formatMonthLabel(key)}, ranked by the community.`,
  };
}

export default function MonthPage(props: PageProps<"/month/[key]">) {
  return (
    <Suspense
      fallback={
        <Container className="max-w-4xl py-12">
          <BoardSkeleton />
        </Container>
      }
    >
      <Month params={props.params} />
    </Suspense>
  );
}

async function Month({ params }: { params: PageProps<"/month/[key]">["params"] }) {
  const { key } = await params;
  await connection();
  if (!isMonthKey(key) || key > new Date().toISOString().slice(0, 7)) notFound();
  return <PeriodBoard scope="month" periodKey={key} />;
}
