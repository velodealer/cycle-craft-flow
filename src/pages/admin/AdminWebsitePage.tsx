import { PageHeader } from '@/components/velo/PageShell';
import BlogManager from '@/components/settings/BlogManager';
import JobOpeningsManager from '@/components/settings/JobOpeningsManager';

export default function AdminWebsitePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Website" description="Blog posts and job openings on the public site." />
      <BlogManager />
      <JobOpeningsManager />
    </div>
  );
}
