import { Claim, Claimer } from "./brainchild";

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
    return this.Claimer.Code.substr(this.Start, this.End - this.Start);
  }

  GetLineNo(): number {
    return this.Claimer.Code.substring(0, this.Start).split("\n").length - 1;
  }

  GetLine(): string {
    return `line ${this.GetLineNo()}`;
  }
}
