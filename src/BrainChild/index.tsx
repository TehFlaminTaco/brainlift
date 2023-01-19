import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export class Index extends Expression {
  static Claim(claimer: Claimer): Index|null {

    return null;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    throw new Error("Method not implemented.");
  }

  //Assign(): string[] {
    //return [`apopb`, `seta ${this.Label}`, `putbptra`];
  //}

}
