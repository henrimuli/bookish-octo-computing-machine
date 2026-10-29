import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BoardSkeleton, WeekBoard, WeekNav } from "@/components/board/week-board";
import { Container, Heading } from "@/components/ui/primitives";
import { addWeeks, formatWeekLabel, formatWeekRange, isWeekKey, weekKeyFor } from "@/lib/weeks";

export async function generateMetadata(props: PageProps<"/week/[key]">): Promise<Metadata> {
  const { key } = await props.params;
  if (!isWeekKey(key)) return {};
  return {
    title: `Debuts of ${formatWeekLabel(key)}`,
    description: `Products that debuted on DebutYard in ${formatWeekLabel(key)} (${formatWeekRange(key)}), ranked by the community.`,
  };
}

export default function WeekPage(props: PageProps<"/week/[key]">) {
  return (
    <Container className="max-w-4xl py-12">
      <Suspense fallback={<BoardSkeleton />}>
        <Week params={props.params} />
      </Suspense>
    </Container>
  );
}

async function Week({ params }: { params: PageProps<"/week/[key]">["params"] }) {
  const { key } = await params;
  await connection();
  const current = weekKeyFor(new Date());
  if (!isWeekKey(key) || key > current) notFound();
  return (
    <>
      <Heading>{formatWeekLabel(key)}</Heading>
      <p className="mt-2 text-muted-foreground">
        {formatWeekRange(key)}
        {key === current ? " · competition open" : " · final ranking"}
      </p>
      <div className="mt-8">
        <WeekBoard weekKey={key} emptyCta={key === current} />
      </div>
      <div className="mt-8">
        <WeekNav prev={addWeeks(key, -1)} next={key < current ? addWeeks(key, 1) : undefined} />
      </div>
    </>
  );
}
