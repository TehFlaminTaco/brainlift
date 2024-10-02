import { Claimer } from "./brainchild";
import { Expression, LeftDonor } from "./expression";
import { Identifier } from "./identifier";
import { Scope } from "./Scope";
import { Simplifyable } from "./Simplifyable";
import {
  ReadWritable,
  Referenceable,
  SimpleAssignable,
  Variable,
} from "./variable";
import { VarType } from "./vartype";

export class Index
  extends Expression
  implements
    LeftDonor,
    ReadWritable,
    Referenceable,
    Simplifyable,
    SimpleAssignable
{
  Simplify(scope: Scope): number | null {
    let valRes = this.Left!.GetTypes(scope);
    if (valRes.length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    let vType = valRes[0];
    let typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (!(this.Target instanceof Identifier)) return null;
    let targetName = this.Target!.Name;
    let constChild = typeDef.ConstantChildren[targetName];
    if (constChild) {
      return constChild[1];
    }
    return null;
  }
  AssignSimple(scope: Scope, value: number): boolean {
    let valRes = this.Left!.GetTypes(scope);
    if (valRes.length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    let vType = valRes[0];
    let typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (!(this.Target instanceof Identifier)) return false;
    let targetName = this.Target!.Name;
    let constChild = typeDef.ConstantChildren[targetName];
    if (constChild) {
      constChild[1] = value;
      return true;
    }
    return false;
  }
  Left: Expression | null = null;
  Target: Identifier | Expression[] | null = null;
  Precedence: number = 17;
  LeftRightAssociative: boolean = true;
  Curry: boolean = false;
  Generics: VarType[] = [];

  static Claim(claimer: Claimer): Index | null {
    var flg = claimer.Flag();
    var exp = Expression.Claim(claimer);
    if (!(exp instanceof Index)) {
      flg.Fail();
      return null;
    }
    return exp;
  }

  static RightClaim(left: Expression, claimer: Claimer): Index | null {
    let generics: VarType[] = [];
    let f = claimer.Flag();
    if (claimer.Claim(/</).Success) {
      while (true) {
        let t = VarType.Claim(claimer);
        if (t === null) {
          generics = [];
          f.Fail();
          break;
        }
        generics.push(t);
        if (!claimer.Claim(/,/).Success) {
          break;
        }
      }
      if (!claimer.Claim(/>/).Success) {
        generics = [];
        f.Fail();
      }
    }
    var dot = claimer.Claim(/\./);
    if (!dot.Success) {
      f.Fail();
      return null;
    }
    var name = Identifier.Claim(claimer);
    var indx = new Index(claimer, left.Claim);
    indx.Left = left;
    indx.Target = name;
    indx.Generics = generics;
    return indx;
  }

  static RightClaimBrack(left: Expression, claimer: Claimer): Index | null {
    let generics: VarType[] = [];
    let f = claimer.Flag();
    if (claimer.Claim(/</).Success) {
      while (true) {
        let t = VarType.Claim(claimer);
        if (t === null) {
          generics = [];
          f.Fail();
          break;
        }
        generics.push(t);
        if (!claimer.Claim(/,/).Success) {
          break;
        }
      }
      if (!claimer.Claim(/>/).Success) {
        generics = [];
        f.Fail();
      }
    }
    var lbrack = claimer.Claim(/\[/);
    if (!lbrack.Success) {
      f.Fail();
      return null;
    }
    var args: Expression[] = [];
    var c = Expression.Claim(claimer);
    while (c !== null) {
      args.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = Expression.Claim(claimer);
    }
    if (!claimer.Claim(/\]/).Success) {
      lbrack.Fail();
      return null;
    }
    var indx = new Index(claimer, lbrack);
    indx.Left = left;
    indx.Target = args;
    indx.Generics = generics;
    return indx;
  }

  CurryType: VarType | null = null;
  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var o: string[] = [this.GetLine()];
    var valRes = this.Left!.TryEvaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(`apop`);
    }
    var vType = valRes[0][0];
    var typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (this.Target instanceof Identifier) {
      if (this.Curry) {
        o.push(`apopa`, `apusha`, `apusha`);
        this.CurryType = valRes[0][0];
      }
      var targetName = this.Target!.Name;
      let meta = scope.GetMetamethod("get_" + targetName, [vType]);
      if (meta) {
        o.push(...meta[2]);
        return [meta[0], o];
      }
      var virtualChild = typeDef.VirtualChildren[targetName];
      if (virtualChild) {
        o.push(
          `apop`,
          `seta ${virtualChild[1].ClassLabel}`,
          `adda ${virtualChild[2]}`,
          `ptra`,
          `apusha`
        );
        return [[virtualChild[0]], o];
      }
      let constChild = typeDef.ConstantChildren[targetName];
      if (constChild) {
        o.push(`apop`, `apush ${(constChild[1] & 0xffffffff) >>> 0}`);
        return [[constChild[0]], o];
      }
      var child = typeDef.Children[targetName];
      if (!child) throw new Error(`Value does not have member ${targetName}`);
      o.push(`apopa`, `adda ${child[1]}`, `ptra`, `apusha`);
      return [[child[0]], o];
    } else {
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        var res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        o.push(...res[1]);
      }
      let meta = scope.GetMetamethod("getindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot index Type ${vType} with types (${indexTypes}).`
        );
      }
      o.push(...meta[2]);
      return [meta[0], o];
    }
  }

  Assign(scope: Scope, anyType: VarType): string[] {
    var o: string[] = [this.GetLine()];
    var valRes = this.Left!.TryEvaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    var vType = valRes[0][0];
    var typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (this.Target instanceof Identifier) {
      var targetName = this.Target!.Name;
      var meta = scope.GetMetamethod("set_" + targetName, [vType, anyType]);
      if (meta) {
        o.push(`apopb`, `bpushb`);
        o.push(...valRes[1]);
        for (let i = 1; i < valRes[0].length; i++) {
          o.push(`apop`);
        }
        o.push(`bpopb`, `apushb`);
        o.push(...meta[2]);
        return o;
      }
      o.push(...valRes[1]);
      for (var i = 1; i < valRes[0].length; i++) {
        o.push(`apop`);
      }
      var virtualChild = typeDef.VirtualChildren[targetName];
      if (virtualChild) {
        o.push(
          `apopb`,
          `apop`,
          `seta ${virtualChild[1].ClassLabel}`,
          `adda ${virtualChild[2]}`,
          `putbptra`
        );
        return o;
      }
      let constChild = typeDef.ConstantChildren[targetName];
      if (constChild) {
        throw new Error(
          `Cannon assign non-constant value to constant variable ${targetName}`
        );
      }
      var child = typeDef.Children[targetName];
      if (!child) throw new Error(`Value does not have member ${targetName}`);
      o.push(`apopa`, `apopb`, `adda ${child[1]}`, `putbptra`);
      return o;
    } else {
      o.push(`apopb`, `bpushb`);
      o.push(...valRes[1]);
      for (let i = 1; i < valRes[0].length; i++) {
        o.push(`apop`);
      }
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        let res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        o.push(...res[1]);
      }
      indexTypes.push(anyType);
      let meta = scope.GetMetamethod("setindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot set index Type ${vType} with types (${indexTypes.slice(
            0,
            indexTypes.length - 1
          )}).`
        );
      }
      o.push(`bpopb`, `apushb`);
      o.push(...meta[2]);
      return o;
    }
  }
  Read(scope: Scope): string[] {
    var o: string[] = [this.GetLine()];
    var valRes = this.Left!.TryEvaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(`apop`);
    }
    var vType = valRes[0][0];
    var typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (this.Target instanceof Identifier) {
      var targetName = this.Target!.Name;
      var meta = scope.GetMetamethod("get_" + targetName, [vType]);
      if (meta) {
        o.push(...meta[2]);
        return o;
      }
      var virtualChild = typeDef.VirtualChildren[targetName];
      if (virtualChild) {
        o.push(
          `apop`,
          `seta ${virtualChild[1].ClassLabel}`,
          `adda ${virtualChild[2]}`,
          `ptra`,
          `apusha`
        );
        return o;
      }
      let constChild = typeDef.ConstantChildren[targetName];
      if (constChild) {
        o.push(`apop`, `apush ${(constChild[1] & 0xffffffff) >>> 0}`);
        return o;
      }
      var child = typeDef.Children[targetName];
      if (!child) throw new Error(`Value does not have member ${targetName}`);
      o.push(`apopa`, `adda ${child[1]}`, `ptra`, `apusha`);
      return o;
    } else {
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        var res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        o.push(...res[1]);
      }
      let meta = scope.GetMetamethod("getindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot index Type ${vType} with types (${indexTypes}).`
        );
      }
      o.push(...meta[2]);
      return o;
    }
  }
  GetPointer(scope: Scope): string[] {
    var o: string[] = [this.GetLine()];
    var valRes = this.Left!.TryEvaluate(scope);
    if (valRes[0].length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    o.push(...valRes[1]);
    for (var i = 1; i < valRes[0].length; i++) {
      o.push(`apop`);
    }
    var vType = valRes[0][0];
    var typeDef = this.Generics.length
      ? vType.GetDefinition().WithGenerics(this.Generics)
      : vType.GetDefinition();
    if (!(this.Target instanceof Identifier)) {
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        var res = this.Target![i].TryEvaluate(scope);
        indexTypes.push(...res[0]);
        o.push(...res[1]);
      }
      let meta = scope.GetMetamethod("ptrindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot derefence Type ${vType} with types (${indexTypes}).`
        );
      }
      o.push(...meta[2]);
      return o;
    }
    var targetName = this.Target!.Name;
    var meta = scope.GetMetamethod("set_" + targetName, [vType]);
    if (meta) {
      throw new Error("Cannot dereference property.");
    }
    var virtualChild = typeDef.VirtualChildren[targetName];
    if (virtualChild) {
      o.push(
        `apop`,
        `seta ${virtualChild[1].ClassLabel}`,
        `adda ${virtualChild[2]}`,
        `apusha`
      );
      return o;
    }
    let constChild = typeDef.ConstantChildren[targetName];
    if (constChild) {
      throw new Error(`Cannot get pointer to a constant value ${targetName}`);
    }
    var child = typeDef.Children[targetName];
    if (!child) throw new Error(`Value does not have member ${targetName}`);
    o.push(`apopa`, `adda ${child[1]}`, `apusha`);
    return o;
  }
  GetReferenceTypes(scope: Scope): VarType[] {
    if (!(this.Target instanceof Identifier)) {
      var vType = this.Left!.GetTypes(scope)[0];
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        indexTypes.push(...this.Target![i].GetTypes(scope));
      }
      let meta = scope.GetMetamethod("ptrindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot derefence Type ${vType} with types (${indexTypes}).`
        );
      }
      return meta[0];
    }
    var ts = this.GetTypes(scope);
    var oTypes: VarType[] = [];
    ts.forEach((r) => {
      let dereferenced = r.Clone();
      dereferenced.PointerDepth++;
      oTypes.push(dereferenced);
    });
    return oTypes;
  }

  TryCurry(scope: Scope) {
    if (this.Left instanceof Identifier) {
      if (scope.UserTypes[this.Left.Name]) return; // Static method
    }
    if (this.Target instanceof Identifier) this.Curry = true;
  }

  GetTypes(scope: Scope): VarType[] {
    var valRes = this.Left!.GetTypes(scope);
    if (valRes.length === 0)
      throw new Error(`Cannot index expression that does not resolve in value`);
    if (this.Curry) {
      this.CurryType = valRes[0];
    }
    var vType = valRes[0];
    var typeDef = vType.GetDefinition();
    if (this.Target instanceof Identifier) {
      var targetName = this.Target!.Name;
      var meta = scope.GetMetamethod("get_" + targetName, [vType]);
      if (meta) {
        return meta[0];
      }
      var virtualChild = typeDef.VirtualChildren[targetName];
      if (virtualChild) {
        return [virtualChild[0]];
      }
      let constChild = typeDef.ConstantChildren[targetName];
      if (constChild) {
        return [constChild[0]];
      }
      var child = typeDef.Children[targetName];
      if (!child) throw new Error(`Value does not have member ${targetName}`);
      return [child[0]];
    } else {
      var indexTypes: VarType[] = [vType];
      for (let i = 0; i < this.Target!.length; i++) {
        indexTypes.push(...this.Target![i].GetTypes(scope));
      }
      let meta = scope.GetMetamethod("getindex", indexTypes);
      if (meta === null) {
        throw new Error(
          `Cannot index Type ${vType} with types (${indexTypes}).`
        );
      }
      return meta[0];
    }
  }
}
Variable.RegisterReadWritable(Index.Claim);
Variable.RegisterReferenceable(Index.Claim);
Expression.RegisterRight(Index.RightClaim);
Expression.RegisterRight(Index.RightClaimBrack);
