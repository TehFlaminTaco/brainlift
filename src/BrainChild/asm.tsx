import { Claimer } from "./brainchild";
import { Statement } from "./statement";
import { Scope } from "./Scope";

export class ASM extends Statement {
  Instructions: string[] = [];
  static Claim(claimer: Claimer) {
    var asm = claimer.Claim(/asm\b/);
    if (!asm.Success) {
      return null;
    }
    if (!claimer.Claim(/\{/).Success) {
      asm.Fail();
      return null;
    }
    var theRest = claimer.Claim(/([^}]*)\}/);
    if (!theRest.Success) {
      asm.Fail();
      return null;
    }
    var as = new ASM(claimer, asm);
    as.Instructions = theRest
      .Body![1].split("\n")
      .map((c) => c.replace(/^\s+/, ""));
    return as;
  }
  Evaluate(scope: Scope): string[] {
    return this.Instructions.map((c) =>
      c.replace(/\[([a-zA-Z_]\w*\b)\]/, (_, a) => scope.Get(a)[1])
    );
  }

  DefinitelyReturns(): boolean {
    return false;
  }
}
Statement.Register(ASM.Claim);
