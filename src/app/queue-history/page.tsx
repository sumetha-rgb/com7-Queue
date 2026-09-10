// queue-history/page.tsx
import { QueueSidebar } from "@/components/interview-queue/queue-sidebar";
import { QueueHistory } from "@/components/interview-queue/queue-history";

export default function QueueHistoryPage() {
  return (
    <>
      <QueueSidebar />
      <div className="lg:pl-64">
        <QueueHistory />
      </div>
    </>
  );
}