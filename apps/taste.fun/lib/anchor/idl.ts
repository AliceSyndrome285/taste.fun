import type { Idl } from '@coral-xyz/anchor';
import tasteFunCoreIdl from '@/lib/idl/taste_fun_core.json';
import tasteFunSettlementIdl from '@/lib/idl/taste_fun_settlement.json';
import tasteFunTokenIdl from '@/lib/idl/taste_fun_token.json';

export function loadTasteFunCoreIdl(): Idl {
  return tasteFunCoreIdl as Idl;
}

export function loadTasteFunSettlementIdl(): Idl {
  return tasteFunSettlementIdl as Idl;
}

export function loadTasteFunTokenIdl(): Idl {
  return tasteFunTokenIdl as Idl;
}
