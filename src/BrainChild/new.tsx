import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Identifier } from "./identifier";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export class New extends Expression {
  Type: Identifier | null = null;
  Arguments: Expression[] = [];
  static Claim(claimer: Claimer): Expression | null {
    var nw = claimer.Claim(/new\b/);
    if (!nw.Success) {
      return null;
    }
    var type = Identifier.Claim(claimer);
    if (type === null) {
      nw.Fail();
      return null;
    }
    if (!claimer.Claim(/\(/)) {
      nw.Fail();
      return null;
    }
    var args: Expression[] = [];
    var c = Expression.Claim(claimer);
    while (c !== null) {
      args.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = Expression.Claim(claimer);
    }
    if (!claimer.Claim(/\)/).Success) {
      nw.Fail();
      return null;
    }
    var NewE = new New(claimer, nw);
    NewE.Type = type;
    NewE.Arguments = args;
    return NewE;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var o: string[] = [];
    var objectType = scope.UserTypes[this.Type!.Name];
    if (objectType === undefined)
      throw new Error(`Cannot find type ${this.Type!.Name}`);
    var classType = objectType.TypeType;
    if (!classType)
      throw new Error(`Cannot find type type for ${this.Type!.Name}`);
    var targTypeNewMethod = classType.Children["new"];
    if (targTypeNewMethod === undefined)
      throw new Error(`Cannot find new method for type ${this.Type!.Name}`);
    o.push(
      `seta ${classType.ClassLabel}`,
      `adda ${targTypeNewMethod[1]}`,
      `ptra`,
      `calla`,
      `apopa`,
      `apusha`,
      `bpusha`
    );
    var falseClaimer = new Claimer("");
    var falseFlag = falseClaimer.Flag();
    var vType = new VarType(falseClaimer, falseFlag);
    vType.TypeName = this.Type!.Name;
    var argTypes: VarType[] = [];
    for (let i = 0; i < this.Arguments.length; i++) {
      var arg = this.Arguments[i].Evaluate(scope);
      o.push(...arg[1]);
      argTypes.push(...arg[0]);
    }
    argTypes.push(vType);
    var constructorMetamethod = objectType.GetMetamethod(
      this.Type!.Name,
      argTypes
    );
    if (!constructorMetamethod)
      throw new Error(`Cannot find constructor new ${argTypes}`);
    o.push(`bpopa`, `apusha`);
    o.push(...constructorMetamethod[2]);
    return [[vType], o];
  }
}
Expression.Register(New.Claim);
