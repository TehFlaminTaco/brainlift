import { Expression } from "./expression";
import { Scope } from "./Scope";
import { VarType } from "./vartype";
import { ReadWritable, Referenceable, Variable } from "./variable";
import { Claimer } from "./brainchild";

export class Dereference extends Expression implements ReadWritable {
  Target: Expression | null = null;
  static Claim(claimer: Claimer): Expression | null {
    var ref = claimer.Claim(/\*/);
    if (!ref.Success) return null;
    var target = Expression.Claim(claimer);
    if (target === null) {
      ref.Fail();
      return null;
    }
    var derefer = new Dereference(claimer, ref);
    derefer.Target = target;
    return derefer;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var o: string[] = [this.GetLine()];
    var res = this.Target!.Evaluate(scope);
    o.push(...res[1]);
    if (res[0].length <= 0) {
      throw new Error("Cannot dereference non-returning value");
    }
    for (var i = 1; i < res[0].length; i++) {
      o.push(`apop`);
    }
    if (res[0][0].PointerDepth <= 0) {
      throw new Error(`Cannot dereference non-pointer. Got ${res[0][0]}`);
    }
    o.push(`apopa`, `ptra`, `apusha`);
    var dereferenced = res[0][0].Clone();
    dereferenced.PointerDepth--;
    return [[dereferenced], o];
  }
  Assign(scope: Scope, anyType: VarType): string[] {
    var o: string[] = [];
    var res = this.Target!.Evaluate(scope);
    o.push(...res[1]);
    if (res[0].length <= 0) {
      throw new Error("Cannot dereference non-returning value");
    }
    for (var i = 1; i < res[0].length; i++) {
      o.push(`apop`);
    }
    if (res[0][0].PointerDepth <= 0) {
      throw new Error(`Cannot dereference non-pointer. Got ${res[0][0]}`);
    }
    o.push(`apopa`, `apopb`, `putbptra`);
    return o;
  }
  Read(scope: Scope): string[] {
    var o: string[] = [];
    var res = this.Target!.Evaluate(scope);
    o.push(...res[1]);
    if (res[0].length <= 0) {
      throw new Error("Cannot dereference non-returning value");
    }
    for (var i = 1; i < res[0].length; i++) {
      o.push(`apop`);
    }
    if (res[0][0].PointerDepth <= 0) {
      throw new Error(`Cannot dereference non-pointer. Got ${res[0][0]}`);
    }
    o.push(`apopa`, `ptra`, `apusha`);
    var dereferenced = res[0][0].Clone();
    dereferenced.PointerDepth--;
    return o;
  }
  GetType(scope: Scope): VarType {
    var res = this.Target!.Evaluate(scope);
    var dereferenced = res[0][0].Clone();
    dereferenced.PointerDepth--;
    return dereferenced;
  }
}

Expression.Register(Dereference.Claim);
Variable.RegisterAssignable(Dereference.Claim);
