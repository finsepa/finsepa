import { PlayCircle, FileText, MonitorPlay, FileBarChart } from "lucide-react";

type EventRow = {
  name: string;
  date: string;
  upcoming?: boolean;
  recording?: boolean;
  transcript?: boolean;
  slides?: boolean;
  report?: boolean;
};

const events2024: EventRow[] = [
  { name: "Q3 2024",                                       date: "Oct 31, 2024", upcoming: true  },
  { name: "Q2 2024",                                       date: "July 30",      recording: true, transcript: true, slides: true, report: true },
  { name: "2024 RBC Capital Markets Financial Technology…", date: "June 11",     recording: true, transcript: true },
  { name: "BofA Securities 2024 Global Technology…",       date: "June 6",       recording: true, transcript: true },
  { name: "ASM 2024",                                      date: "May 22",       recording: true, transcript: true },
  { name: "Q1 2024",                                       date: "30 April",     recording: true, transcript: true, slides: true, report: true },
  { name: "Wolfe Research FinTech Forum",                   date: "March 13",    recording: true, transcript: true },
  { name: "Morgan Stanley's Technology, Media &…",         date: "March 5",      recording: true, transcript: true },
  { name: "Innovation Day 2024",                           date: "January 25",   recording: true, transcript: true, report: true },
];

const events2023: EventRow[] = [
  { name: "Q4 2023",                                       date: "Feb 7, 2024",  recording: true, transcript: true, slides: true, report: true },
  { name: "Q3 2023",                                       date: "Oct 26, 2023", recording: true, transcript: true, slides: true, report: true },
  { name: "Goldman Sachs Communacopia & Technology…",      date: "Sep 12, 2023", recording: true, transcript: true },
  { name: "Q2 2023",                                       date: "July 26, 2023",recording: true, transcript: true, slides: true, report: true },
];

function IconCell({ available, icon }: { available?: boolean; icon: React.ReactNode }) {
  if (!available) return <td className="px-6 text-center text-[14px] text-[#A1A1AA]">-</td>;
  return (
    <td className="px-6 text-center">
      <button className="inline-flex items-center justify-center text-[#71717A] hover:text-[#09090B] transition-colors">
        {icon}
      </button>
    </td>
  );
}

function EventsGroup({ year, rows }: { year: string; rows: EventRow[] }) {
  return (
    <>
      <tr className="border-b border-[#E4E4E7]">
        <td colSpan={6} className="px-6 py-2 text-[13px] font-semibold text-[#09090B]">
          {year}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.name} className="group h-[60px] border-b border-[#E4E4E7] transition-colors hover:bg-neutral-50 last:border-b-0">
          {/* Report name */}
          <td className="px-6 py-0">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#009cde] text-white text-[11px] font-bold">
                P
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium leading-5 text-[#09090B]">{row.name}</span>
                {row.upcoming && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[12px] font-medium text-orange-600">
                    Upcoming
                  </span>
                )}
              </div>
            </div>
          </td>

          {/* Date */}
          <td className="px-6 text-[14px] leading-5 text-[#09090B] tabular-nums">{row.date}</td>

          <IconCell available={row.recording} icon={<PlayCircle className="h-5 w-5" />} />
          <IconCell available={row.transcript} icon={<FileText className="h-5 w-5" />} />
          <IconCell available={row.slides}    icon={<MonitorPlay className="h-5 w-5" />} />
          <IconCell available={row.report}    icon={<FileBarChart className="h-5 w-5" />} />
        </tr>
      ))}
    </>
  );
}

export function EventsTab() {
  return (
    <div className="overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-t border-b border-[#E4E4E7] bg-white">
            {["Report", "Date", "Recording", "Transcript", "Slides", "Report"].map((h, i) => (
              <th
                key={`${h}-${i}`}
                className={`px-6 py-3 text-[14px] font-semibold leading-5 text-[#71717A] ${
                  i === 0 ? "text-left" : "text-center"
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <EventsGroup year="2024" rows={events2024} />
          <EventsGroup year="2023" rows={events2023} />
        </tbody>
      </table>
    </div>
  );
}
