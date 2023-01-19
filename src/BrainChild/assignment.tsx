import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Identifier } from "./identifier";
import { Statement } from "./statement";
import { Scope } from "./Scope";
import { VariableDecleration } from "./variabledefinition";
import { VarType } from "./vartype";
import { Assignable } from "./variable";

export class Assignment extends Statement {
  Targets: Assignable[] = [];
  Value: Expression | null = null;
  DeferenceCount: number = 0;
  static Claim(claimer: Claimer): Assignment | null {
    var flag = claimer.Flag();
    var target: Assignable | null =
      VariableDecleration.Claim(claimer, true) ?? Identifier.Claim(claimer);
    if (target === null) {
      flag.Fail();
      return null;
    }
    var targets: Assignable[] = [];
    while (target !== null) {
      targets.push(target);
      if (!claimer.Claim(/,/).Success) break;
      target =
        VariableDecleration.Claim(claimer, true) ?? Identifier.Claim(claimer);
    }
    var deferences = claimer.Claim(/\**/)?.Body![0].length ?? 0;
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
    ass.DeferenceCount = deferences;
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
}

Statement.Register(Assignment.Claim);
