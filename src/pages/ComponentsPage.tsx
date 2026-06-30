import ComponentList from '@/components/components/ComponentList';

export default function ComponentsPage() {
  return (
    <div className="container mx-auto py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Components Library</h1>
        <p className="text-sm text-muted-foreground">
          Reusable parts catalogue — any bike specification can reference these components.
        </p>
      </div>
      <ComponentList />
    </div>
  );
}
