import { Claim, Claimer } from "./brainchild";

function IsRightDonor(e: Token | null) {
  if (e === null) return false;
  if (!(e instanceof Token)) return false;
  return "Right" in e && "Precedence" in e && "LeftRightAssociative" in e;
}
function IsLeftDonor(e: Token | null) {
  if (e === null) return false;
  if (!(e instanceof Token)) return false;
  return "Left" in e && "Precedence" in e && "LeftRightAssociative" in e;
}

export abstract class Token {
  Start: number;
  End: number;
  Claimer: Claimer;
  Claim: Claim;
  constructor(claimer: Claimer, claim: Claim) {
    this.Start = claim.StartIndex;
    this.End = claimer.Ptr;
    this.Claimer = claimer;
    this.Claim = claim;
  }

  toString(): string {
    let end: number = this.End;
    let start: number = this.Start;
    let l = this;
    let r = this;
    while (IsRightDonor(r)) {
      end = Math.max(r.End, end);
      r = (r as any).Right;
    }
    while (IsLeftDonor(l)) {
      start = Math.min(l.Start, start);
      l = (l as any).Start;
    }
    return this.Claimer.Code.substr(start, end - start);
  }

  GetLineNo(): number {
    return this.Claimer.Code.substring(0, this.Start).split("\n").length - 1;
  }

  GetColumn(): number {
    var l = this.Claimer.Code.substring(0, this.Start).split("\n");
    return l[l.length - 1].length;
  }

  GetLine(): string {
    return `line ${this.GetLineNo()}`;
  }
}

export class TokenError extends Error {
  CallStack: Token[];
  constructor(t: Token[], s: string) {
    super(s);
    this.CallStack = t;
  }
}
