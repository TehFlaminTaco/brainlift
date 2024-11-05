import { Claimer } from "./brainchild";
import { Identifier } from "./identifier";
import { Scope } from "./Scope";
import { FuncType, VarType } from "./vartype";
import { Assignable, ReadWritable, Referenceable, SimpleAssignable, Variable } from "./variable";
import { Expression } from "./expression";
import { Simplifyable } from "./Simplifyable";

export class VariableDecleration
  extends Expression
  implements ReadWritable, Referenceable, Simplifyable, SimpleAssignable
{
  InformType(scope: Scope, anyType: VarType): void {
    if (this.Type!.TypeName === "var") {
      this.Type = anyType;
    }
  }
  Read(scope: Scope): string[] {
    return this.Evaluate(scope)[1];
  }
  GetPointer(scope: Scope): string[] {
    // Ensure we're set up.
    this.Evaluate(scope);
    return [`apush ${this.Label}`];
  }
  GetReferenceTypes(scope: Scope): VarType[] {
    return [this.Type!.WithDeltaPointerDepth(1)];
  }
  Type: VarType | null = null;
  Identifier: Identifier | null = null;
  Label: string = "";
  LastScope?: Scope;
  IsConstant: boolean = false;
  static Claim(claimer: Claimer): VariableDecleration | null {
    var flag = claimer.Flag();
    var typ: VarType | null;
    let isConst = false;
    if (claimer.Claim(/const\b/).Success) isConst = true;
    if (claimer.Claim(/var\b/).Success) {
      typ = VarType.Any;
    } else {
      typ = VarType.Claim(claimer);
      if (typ === null) {
        flag.Fail();
        return null;
      }
    }
    var ident = Identifier.Claim(claimer);
    if (ident === null) {
      flag.Fail();
      return null;
    }
    var vd = new VariableDecleration(claimer, flag);
    vd.Type = typ;
    vd.Identifier = ident;
    vd.IsConstant = isConst;
    return vd;
  }

  static ClaimAbstract(claimer: Claimer): VariableDecleration | null {
    var fnc = claimer.Claim(/abstract\b/);
    if (!fnc.Success) {
      return null;
    }
    if (!claimer.Claim(/function\b/).Success) {
      fnc.Fail();
      return null;
    }

    var target = Variable.ClaimAssignable(claimer, false);
    if (target === null) {
      fnc.Fail();
      return null;
    }
    if (!(target instanceof Identifier)) {
      fnc.Fail();
      return null;
    }

    if (!claimer.Claim(/\(/).Success) {
      fnc.Fail();
      return null;
    }
    var args: VariableDecleration[] = [];
    var c = VariableDecleration.Claim(claimer);
    while (c !== null) {
      args.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = VariableDecleration.Claim(claimer);
    }
    if (!claimer.Claim(/\)/).Success) {
      fnc.Fail();
      return null;
    }
    var retTypes = [];

    if (claimer.Claim(/->/).Success) {
      var retType = VarType.Claim(claimer);
      while (retType !== null) {
        retTypes.push(retType);
        if (!claimer.Claim(/,/).Success) break;
        retType = VarType.Claim(claimer);
      }
    }
    var funct = new VariableDecleration(claimer, fnc);
    var falseClaimer = new Claimer("");
    var falseFlag = falseClaimer.Flag();
    var typ = new FuncType(falseClaimer, falseFlag);
    typ.ArgTypes = args.map((c) => c.Type!);
    typ.RetTypes = retTypes;
    return funct;
  }

  Evaluate(scope: Scope): [VarType[], string[]] {
    if(this.Type!.TypeName === "discard")
      return [[VarType.Discard], ['apush 0']];
    if (this.IsConstant) {
      if (!this.Label) {
        scope.SetConstant(this.Identifier!.Name, this.Type!, 0, true);
        this.Label = scope.GetSafeName("constant_" + this.Identifier!.Name);
      }
      let v = scope.Get(this.Identifier!.Name);
      return [[this.Type!], [`apush ${v[2]}`]];
    }
    if (this.Type!.TypeName === "var")
      throw new Error(`Variable Decleration must explicitely define a type.`);
    if (scope !== this.LastScope) {
      this.Label = "";
      this.LastScope = scope;
    }
    this.Label ||= scope.Set(this.Identifier!.Name, this.Type!);
    return [[this.Type!], [`seta ${this.Label}`, ...this.Type!.Get("a","a")]];
  }

  Assign(scope: Scope, anyType: VarType): string[] {
    if (this.Type!.TypeName === "discard")
      return ['apop'];
    if (this.IsConstant) {
      throw new Error("Cannot assign non-constant value to constant variable");
    }
    if (this.Type!.TypeName === "var") {
      if (anyType.TypeName === "var")
        throw new Error(`Variable Decleration must explicitely define a type.`);
      this.Type = anyType;
    }
    if (scope !== this.LastScope) {
      this.Label = "";
      this.LastScope = scope;
    }
    this.Label ||= scope.Set(
      this.Identifier!.Name,
      this.Type!.TypeName === "var" ? anyType : this.Type!
    );
    return [`seta ${this.Label}`, ...this.Type!.Put("a","a")];
  }

  GetTypes(scope: Scope): VarType[] {
    // Potentially set up.
    if (scope !== this.LastScope) {
      this.Label = "";
      this.LastScope = scope;
    }
    this.Label ||= scope.Set(this.Identifier!.Name, this.Type!);
    return [this.Type!];
  }

  Simplify(scope: Scope): number | null {
    if(this.Type!.TypeName === "discard")
      return 0;
    if (!this.IsConstant) return null;
    if (!this.Label) {
      scope.SetConstant(this.Identifier!.Name, this.Type!, 0, true);
      this.Label = scope.GetSafeName("constant_" + this.Identifier!.Name);
      return 0;
    }
    let v = scope.Get(this.Identifier!.Name);
    return v[2];
  }

  AssignSimple(scope: Scope, val: number): boolean {
    if(this.Type!.TypeName === "discard") return true;
    if (!this.IsConstant) return false;
    if (!this.Label || scope !== this.LastScope) {
      scope.SetConstant(this.Identifier!.Name, this.Type!, val, true);
      this.Label = scope.GetSafeName("constant_" + this.Identifier!.Name);
      this.LastScope = scope;
    } else {
      let v = scope.Get(this.Identifier!.Name);
      v[2] = val;
    }
    return true;
  }

  DefinitelyReturns(scope: Scope): false {
    if (scope !== this.LastScope) {
      this.Label = "";
      this.LastScope = scope;
    }
    this.Label ||= scope.Set(this.Identifier!.Name, this.Type!);
    return false;
  }
}

Expression.Register(VariableDecleration.Claim);
Variable.RegisterReadWritable(VariableDecleration.Claim);
Variable.RegisterReferenceable(VariableDecleration.Claim);
