import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function generateStrongPassword(length = 16): string {
  const sets = [
    'ABCDEFGHJKLMNPQRSTUVWXYZ',
    'abcdefghijkmnpqrstuvwxyz',
    '23456789',
    '!@#$%^&*',
  ];
  const all = sets.join('');
  const rand = (max: number) => {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0] % max;
  };
  // Guarantee one char from each set, then fill the rest.
  const chars = sets.map((s) => s[rand(s.length)]);
  while (chars.length < length) chars.push(all[rand(all.length)]);
  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  hint: string | null;
}

export function assessPassword(pw: string): PasswordStrength {
  if (!pw) return { score: 0, label: '', hint: null };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  // Penalise common weak patterns
  if (/^(.)\1+$/.test(pw) || /^(password|letmein|qwerty|123456)/i.test(pw)) score = 0;
  const capped = Math.min(4, Math.max(0, score - 1)) as 0 | 1 | 2 | 3 | 4;
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  const hints: (string | null)[] = [
    'Use at least 8 characters with a mix of letters, numbers and symbols.',
    'Add upper and lower case letters, numbers and symbols.',
    'Make it longer — 12+ characters is much stronger.',
    'Good — a little longer would make it very strong.',
    null,
  ];
  return { score: capped, label: labels[capped], hint: hints[capped] };
}

const STRENGTH_COLORS = [
  'bg-destructive',
  'bg-destructive/80',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-emerald-600',
];

interface PasswordFieldsProps {
  password: string;
  confirm: string;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  disabled?: boolean;
  passwordId?: string;
  confirmId?: string;
  passwordLabel?: string;
  minLength?: number;
}

export function PasswordFields({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  disabled,
  passwordId = 'new-password',
  confirmId = 'confirm-password',
  passwordLabel = 'Password',
  minLength = 6,
}: PasswordFieldsProps) {
  const [show, setShow] = useState(false);
  const strength = useMemo(() => assessPassword(password), [password]);
  const mismatch = confirm.length > 0 && confirm !== password;

  const suggest = () => {
    const pw = generateStrongPassword();
    onPasswordChange(pw);
    onConfirmChange(pw);
    setShow(true); // reveal so the user can see/copy the suggestion
  };

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={passwordId}>{passwordLabel}</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={suggest}
            disabled={disabled}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Suggest strong password
          </Button>
        </div>
        <div className="relative">
          <Input
            id={passwordId}
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            disabled={disabled}
            className="pr-10"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={show ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {password.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1.5 flex-1 rounded-full transition-colors',
                    i < strength.score ? STRENGTH_COLORS[strength.score] : 'bg-muted'
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{strength.label}</span>
              {strength.hint ? ` — ${strength.hint}` : ''}
            </p>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={confirmId}>Confirm password</Label>
        <Input
          id={confirmId}
          type={show ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => onConfirmChange(e.target.value)}
          required
          disabled={disabled}
          autoComplete="new-password"
        />
        {mismatch && (
          <p className="text-xs text-destructive">Passwords do not match.</p>
        )}
        {password.length > 0 && password.length < minLength && (
          <p className="text-xs text-destructive">Use at least {minLength} characters.</p>
        )}
      </div>
    </>
  );
}
