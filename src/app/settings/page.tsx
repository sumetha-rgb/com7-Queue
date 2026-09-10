import { QueueSidebar } from "@/components/interview-queue/queue-sidebar";
import { SheetConnectionSettings } from "@/components/interview-queue/sheet-connection-settings";

export default function SettingsPage() {
  return (
    <>
      <QueueSidebar />
      <div className="lg:pl-64">
        <SheetConnectionSettings />
      </div>
    </>
  );
}