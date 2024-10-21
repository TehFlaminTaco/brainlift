import { Scope } from "./Scope";

export interface Simplifyable {
  Simplify(scope: Scope): number | null;
}

export function IsSimplifyable(a: any) {
  return "Simplify" in a;
}
