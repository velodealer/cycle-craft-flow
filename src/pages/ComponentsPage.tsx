import ComponentList from '@/components/components/ComponentList';
import { PageHeader } from '@/components/velo/PageShell';

export default function ComponentsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Components"
        description="Reusable parts catalogue — any bike specification can reference these components."
      />
      <ComponentList />
    </div>
  );
}
