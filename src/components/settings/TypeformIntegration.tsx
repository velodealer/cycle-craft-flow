import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, Link2, Unlink, AlertCircle, ChevronDown, Map } from 'lucide-react';
import { toast } from 'sonner';
import {
  getTypeformStatus,
  getTypeformAuthUrl,
  listTypeformForms,
  listTypeformFormFields,
  setTypeformFormEnabled,
  saveTypeformFieldMap,
  disconnectTypeform,
  TYPEFORM_FIELD_KEYS,
  type TypeformStatus,
  type TypeformForm,
  type TypeformField,
} from '@/services/typeform';

export default function TypeformIntegration() {
  const [status, setStatus] = useState<TypeformStatus | null>(null);
  const [forms, setForms] = useState<TypeformForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingForms, setLoadingForms] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [openMap, setOpenMap] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, TypeformField[]>>({});
  const [maps, setMaps] = useState<Record<string, Record<string, string>>>({});
  const [savingMap, setSavingMap] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const result = await getTypeformStatus();
      setStatus(result);
      setError(null);
      return result;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const loadForms = useCallback(async () => {
    setLoadingForms(true);
    try {
      const { forms: list } = await listTypeformForms();
      setForms(list);
      setMaps((prev) => {
        const next = { ...prev };
        for (const f of list) if (!next[f.id]) next[f.id] = f.field_map ?? {};
        return next;
      });
    } catch (e) {
      toast.error(`Could not load Typeform forms: ${(e as Error).message}`);
    } finally {
      setLoadingForms(false);
    }
  }, []);

  useEffect(() => {
    loadStatus().then((s) => {
      if (s?.connected) loadForms();
    });
  }, [loadStatus, loadForms]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'typeform-connected') {
        toast.success('Typeform connected');
        loadStatus().then((s) => {
          if (s?.connected) loadForms();
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadStatus, loadForms]);

  const handleConnect = async () => {
    try {
      const { url } = await getTypeformAuthUrl();
      window.open(url, 'typeform-oauth', 'width=620,height=760');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectTypeform();
      setForms([]);
      toast.success('Typeform disconnected');
      loadStatus();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleToggle = async (form: TypeformForm, enabled: boolean) => {
    setToggling(form.id);
    try {
      await setTypeformFormEnabled(form.id, form.title, enabled);
      setForms((prev) => prev.map((f) => (f.id === form.id ? { ...f, enabled } : f)));
      toast.success(enabled ? `Receiving responses from "${form.title}"` : `Stopped receiving responses from "${form.title}"`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setToggling(null);
    }
  };

  const openMapping = async (form: TypeformForm) => {
    if (openMap === form.id) {
      setOpenMap(null);
      return;
    }
    setOpenMap(form.id);
    if (!fields[form.id]) {
      try {
        const { fields: list } = await listTypeformFormFields(form.id);
        setFields((prev) => ({ ...prev, [form.id]: list }));
      } catch (e) {
        toast.error(`Could not load form questions: ${(e as Error).message}`);
      }
    }
  };

  const handleSaveMap = async (form: TypeformForm) => {
    setSavingMap(form.id);
    try {
      await saveTypeformFieldMap(form.id, form.title, maps[form.id] ?? {});
      toast.success(`Field mapping saved for "${form.title}"`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSavingMap(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading Typeform status…
        </CardContent>
      </Card>
    );
  }

  const connected = status?.connected;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              Typeform
              {connected ? (
                <Badge variant="default">Connected{status?.account_name ? ` · ${status.account_name}` : ''}</Badge>
              ) : (
                <Badge variant="secondary">Not connected</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Receive bike sale and part-exchange submissions from your Typeform forms into the Submissions inbox.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {connected ? (
              <>
                <Button variant="outline" size="sm" onClick={loadForms} disabled={loadingForms}>
                  {loadingForms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh forms
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect}>
                  <Unlink className="mr-2 h-4 w-4" /> Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleConnect}>
                <Link2 className="mr-2 h-4 w-4" /> Connect Typeform
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {connected && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              <p>
                Create a Typeform app at developer.typeform.com and add this OAuth redirect URI, then enter the client
                ID and secret in Project Settings when prompted:
              </p>
              <code className="block break-all rounded bg-muted p-2 text-xs">{status?.redirect_uri}</code>
            </AlertDescription>
          </Alert>
        )}

        {connected && forms.length === 0 && !loadingForms && (
          <p className="text-sm text-muted-foreground">
            No forms found in the connected Typeform account. Create a form first, then refresh.
          </p>
        )}

        {connected && forms.length > 0 && (
          <div className="space-y-2">
            {forms.map((form) => {
              const map = maps[form.id] ?? {};
              const mappedCount = TYPEFORM_FIELD_KEYS.filter((f) => map[f.key]).length;
              const formFields = fields[form.id] ?? [];
              return (
                <div key={form.id} className="rounded-lg border">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{form.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {form.enabled ? 'Receiving responses' : 'Not receiving responses'}
                        {mappedCount > 0 && ` · ${mappedCount} field${mappedCount === 1 ? '' : 's'} mapped`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Collapsible open={openMap === form.id} onOpenChange={() => openMapping(form)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Map className="mr-2 h-4 w-4" /> Map fields
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </CollapsibleTrigger>
                      </Collapsible>
                      <Switch
                        checked={form.enabled}
                        disabled={toggling === form.id}
                        onCheckedChange={(checked) => handleToggle(form, checked)}
                        aria-label={`Receive responses from ${form.title}`}
                      />
                    </div>
                  </div>

                  {openMap === form.id && (
                    <div className="border-t bg-muted/30 p-3">
                      {formFields.length === 0 ? (
                        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" /> Loading form questions…
                        </p>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {TYPEFORM_FIELD_KEYS.map((target) => (
                              <div key={target.key} className="space-y-1.5">
                                <p className="text-sm font-medium">{target.label}</p>
                                <Select
                                  value={map[target.key] ?? ''}
                                  onValueChange={(value) =>
                                    setMaps((prev) => ({
                                      ...prev,
                                      [form.id]: { ...(prev[form.id] ?? {}), [target.key]: value },
                                    }))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a question" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[280px] overflow-y-auto">
                                    {formFields.map((field) => (
                                      <SelectItem key={field.ref} value={field.ref}>
                                        {field.title} ({field.type})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">{target.hint}</p>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Photos uploaded in the form are picked up automatically — no mapping needed.
                          </p>
                          <Button size="sm" onClick={() => handleSaveMap(form)} disabled={savingMap === form.id}>
                            {savingMap === form.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save mapping
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
