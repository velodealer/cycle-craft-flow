import { assertEquals } from 'jsr:@std/assert@1';
import { handoverAllowed } from './handover.ts';

Deno.test('no deferred jobs: handover allowed', () => assertEquals(handoverAllowed(0, 'mechanic', ''), true));
Deno.test('deferred job without reason blocks even owner', () => assertEquals(handoverAllowed(1, 'owner', '  '), false));
Deno.test('deferred job: mechanic cannot override', () => assertEquals(handoverAllowed(2, 'mechanic', 'customer agreed'), false));
Deno.test('deferred job: admin with reason overrides', () => assertEquals(handoverAllowed(1, 'admin', 'customer agreed'), true));
