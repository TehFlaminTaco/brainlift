import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Identifier } from "./identifier";
import { Statement } from "./statement";
import { Scope } from "./Scope";
import { VariableDecleration } from "./variabledefinition";
import { VarType } from "./vartype";
import { Variable, Assignable } from "./variable";

export class Assignment extends Statement {
  Targets: Assignable[] = [];
  Value: Expression | null = null;
  static Claim(claimer: Claimer): Assignment | null {
    var flag = claimer.Flag();
    var target: Assignable | null = Variable.ClaimAssignable(claimer);
    if (target === null) {
      flag.Fail();
      return null;
    }
    var targets: Assignable[] = [];
    while (target !== null) {
      targets.push(target);
      if (!claimer.Claim(/,/).Success) break;
      target = Variable.ClaimAssignable(claimer);
    }
    /* TODO: Add operator here */
    if (!claimer.Claim(/=/).Success) {
      flag.Fail();
      return null;
    }
    var val = Expression.Claim(claimer);
    if (val === null) {
      flag.Fail();
      return null;
    }
    var ass = new Assignment(claimer, flag);
    ass.Targets = targets;
    ass.Value = val;
    return ass;
  }

  Evaluate(scope: Scope): string[] {
    var o: string[] = [];
    var res = this.Value!.Evaluate(scope);
    o.push(...res[1]);
    var targetTypes: VarType[] = [];
    for (let i = 0; i < this.Targets.length; i++) {
      targetTypes.push(this.Targets[i].GetType(scope));
    }
    // Match targetTypes to next fit returnType.
    o.push(...VarType.Coax(targetTypes, res[0]));
    for (let i = this.Targets.length - 1; i >= 0; i--) {
      o.push(...this.Targets[i].Assign(scope, targetTypes[i]));
    }

    return o;
  }

  DefinitelyReturns(): boolean {
    return false;
  }
}

Statement.Register(Assignment.Claim);
