import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ClipboardCheck, ExternalLink, Save, CheckCircle } from 'lucide-react';

const INSPECTABIKE_URL = 'https://www.inspectabike.com';

interface InspectionTaskProps {
  bike: any;
  onUpdate: () => void;
}

const isValidUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

export default function InspectionTask({ bike, onUpdate }: InspectionTaskProps) {
  const { profile } = useAuth();
  const [inspection, setInspection] = useState<any>(null);
  const [reportUrl, setReportUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [hasIssues, setHasIssues] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = !!profile && ['admin', 'mechanic'].includes(profile.role);

  useEffect(() => {
    loadInspection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bike.id]);

  const applyRecord = (record: any) => {
    setInspection(record);
    setReportUrl(record?.report_url || '');
    setNotes(record?.notes || '');
    setHasIssues(!!record?.has_issues);
  };

  const loadInspection = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inspections')
        .select('*')
        .eq('bike_id', bike.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        applyRecord(data);
      } else if (canEdit && bike.status === 'inspection') {
        const { data: created, error: createError } = await supabase
          .from('inspections')
          .insert({
            bike_id: bike.id,
            inspected_by: profile?.id ?? null,
            status: 'in_progress',
          })
          .select()
          .single();
        if (createError) throw createError;
        applyRecord(created);
      } else {
        setInspection(null);
      }
    } catch (error: any) {
      console.error('Error loading inspection:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load inspection record',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!inspection) return;
    if (reportUrl && !isValidUrl(reportUrl)) {
      toast({
        title: 'Invalid URL',
        description: 'Enter a full http(s) link to the inspection report',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('inspections')
        .update({
          report_url: reportUrl || null,
          notes: notes || null,
          has_issues: hasIssues,
          inspected_by: inspection.inspected_by ?? profile?.id ?? null,
        })
        .eq('id', inspection.id)
        .select()
        .single();

      if (error) throw error;
      applyRecord(data);
      toast({ title: 'Saved', description: 'Inspection record updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!inspection) return;
    if (reportUrl && !isValidUrl(reportUrl)) {
      toast({
        title: 'Invalid URL',
        description: 'Enter a full http(s) link to the inspection report',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const nextStatus = hasIssues ? 'pending_approval' : 'ready';

      const { data, error } = await supabase
        .from('inspections')
        .update({
          report_url: reportUrl || null,
          notes: notes || null,
          has_issues: hasIssues,
          status: 'completed',
          completed_at: new Date().toISOString(),
          inspected_by: inspection.inspected_by ?? profile?.id ?? null,
        })
        .eq('id', inspection.id)
        .select()
        .single();

      if (error) throw error;

      const { error: bikeError } = await supabase
        .from('bikes')
        .update({ status: nextStatus as any })
        .eq('id', bike.id);

      if (bikeError) throw bikeError;

      applyRecord(data);
      toast({
        title: 'Inspection complete',
        description: hasIssues
          ? 'Issues flagged — bike moved to Awaiting Approval'
          : 'No issues — bike moved to Ready for Sale',
      });
      onUpdate();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading inspection...</CardContent>
      </Card>
    );
  }

  if (!inspection) return null;

  const completed = inspection.status === 'completed';
  const readOnly = completed || !canEdit;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Inspection
          </span>
          {completed ? (
            <Badge variant={inspection.has_issues ? 'destructive' : 'default'}>
              {inspection.has_issues ? 'Completed — issues found' : 'Completed — no issues'}
            </Badge>
          ) : (
            <Badge variant="secondary">In progress</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readOnly && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open(INSPECTABIKE_URL, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Open inspectabike.com
          </Button>
        )}

        <div className="space-y-2">
          <Label htmlFor="inspection-url">Inspection report URL</Label>
          {readOnly ? (
            inspection.report_url ? (
              <a
                href={inspection.report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-primary underline break-all"
              >
                {inspection.report_url}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">No report link recorded</p>
            )
          ) : (
            <Input
              id="inspection-url"
              type="url"
              placeholder="https://www.inspectabike.com/report/..."
              value={reportUrl}
              onChange={(e) => setReportUrl(e.target.value)}
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="inspection-notes">Notes</Label>
          {readOnly ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {inspection.notes || 'No notes recorded'}
            </p>
          ) : (
            <Textarea
              id="inspection-notes"
              placeholder="Findings, faults, recommended work..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          )}
        </div>

        {!readOnly && (
          <>
            <Separator />
            <div className="flex items-start gap-3">
              <Checkbox
                id="inspection-issues"
                checked={hasIssues}
                onCheckedChange={(checked) => setHasIssues(checked === true)}
              />
              <div className="space-y-1">
                <Label htmlFor="inspection-issues" className="cursor-pointer">
                  Issues found — needs approval
                </Label>
                <p className="text-xs text-muted-foreground">
                  {hasIssues
                    ? 'Completing will move this bike to Awaiting Approval.'
                    : 'Completing will move this bike to Ready for Sale.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={handleSave} disabled={saving} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button onClick={handleComplete} disabled={saving} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Complete inspection
              </Button>
            </div>
          </>
        )}

        {completed && inspection.completed_at && (
          <p className="text-xs text-muted-foreground">
            Completed {new Date(inspection.completed_at).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
