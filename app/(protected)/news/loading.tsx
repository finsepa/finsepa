import { NewsTableSkeleton } from "@/components/news/news-table";

export default function Loading() {
  return (
    <div className="px-9 py-6">
      <div className="mb-6 h-10 w-64 rounded bg-[#F4F4F5]" />
      <NewsTableSkeleton rows={25} />
    </div>
  );
}

