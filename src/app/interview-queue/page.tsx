// interview-queue/page.tsx
import { QueueSidebar } from "@/components/interview-queue/queue-sidebar";
import { QueueDashboard } from "@/components/interview-queue/queue-dashboard";

export default function InterviewQueuePage() {
  return (
    <>
      <QueueSidebar />
      <div className="lg:pl-64">
        <QueueDashboard />
      </div>
    </>
  );
}