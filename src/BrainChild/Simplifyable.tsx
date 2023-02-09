export interface Simplifyable {
  Simplify(): number | null;
}

export function IsSimplifyable(a: any) {
  return "Simplify" in a;
}
