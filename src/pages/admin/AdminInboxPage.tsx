import { PageHeader } from '@/components/velo/PageShell';
import SupportInbox from '@/components/settings/SupportInbox';

export default function AdminInboxPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Inbox" description="Customer enquiries and job applications from the website." />
      <SupportInbox />
    </div>
  );
}
