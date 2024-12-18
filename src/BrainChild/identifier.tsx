import { Claimer, Keywords } from "./brainchild";
import { Expression } from "./expression";
import { Scope } from "./Scope";
import { Simplifyable } from "./Simplifyable";
import {
  ReadWritable,
  Referenceable,
  SimpleAssignable,
  Variable,
} from "./variable";
import { VarType } from "./vartype";

const forbiddenClasses = ["int", "void", "discard"];

export class Identifier
  extends Expression
  implements ReadWritable, Referenceable, SimpleAssignable, Simplifyable
{
  InformType(scope: Scope, anyType: VarType): void {}
  AssignSimple(scope: Scope, value: number): boolean {
    let res = scope.Get(this.Name);
    if(res[0].TypeName === "discard") return true;
    return scope.SetConstant(this.Name, null, value, false);
  }
  Simplify(scope: Scope): number | null {
    try {
      var res = scope.Get(this.Name);
      if(res[0].TypeName === "discard")
        return 0;
      return res[2] ?? null;
    } catch {
      return null;
    }
  }
  Name: string = "";
  static Claim(
    claimer: Claimer,
    allowForbiddenClasses: boolean = false
  ): Identifier | null {
    var c = claimer.Claim(/[a-zA-Z_]\w*\b/);
    if (!c.Success) return null;
    if (Keywords.includes(c.Body![0])) {
      if (!(allowForbiddenClasses && forbiddenClasses.includes(c.Body![0]))) {
        c.Fail();
        return null;
      }
    }
    var ident = new Identifier(claimer, c);
    ident.Name = c.Body![0];
    return ident;
  }

  Assign(scope: Scope): string[] {
    var res = scope.Get(this.Name);
    let t = res[0].GetDefinition();
    if (res[0].TypeName === "discard")
      return ["apop"];
    if (res[2] !== null)
      throw new Error(
        "Cannot override constant value with non-constant value!"
      );
    if (t.Name.startsWith("type")) {
      throw new Error("Cannot assign over class");
    }
    return [`setb ${res[1]}`, ...res[0].Put("a","b")];//[`apopb`, `seta ${res[1]}`, `putbptra`];
  }

  Read(scope: Scope): string[] {
    var res = scope.Get(this.Name);
    if(res[0].TypeName === "discard")
      return ["apush 0"];
    if (res[2] !== null) return [`apush ${(res[2] & 0xffffffff) >>> 0}`];
    return [`seta ${res[1]}`, ...res[0].Get("a", "a")];
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    var res = scope.Get(this.Name);
    if(res[0].TypeName === "discard")
      return [[VarType.Discard], ["apush 0"]];
    if (res[2] !== null)
      return [[res[0]], [`apush ${(res[2] & 0xffffffff) >>> 0}`]];
    return [[res[0]], [this.GetLine(), `seta ${res[1]}`, ...res[0].Get("a", "a")]];
  }

  GetPointer(scope: Scope): string[] {
    var res = scope.Get(this.Name);
    if (res[0].TypeName === "discard")
      throw new Error("Cannot get pointer to discard value");
    if (res[2] !== null)
      throw new Error("Cannot get pointer to constant value");
    return [`apush ${res[1]}`];
  }
  GetReferenceTypes(scope: Scope): VarType[] {
    var res = scope.Get(this.Name);
    var t = res[0].Clone();
    t.PointerDepth++;
    return [t];
  }

  GetTypes(scope: Scope): VarType[] {
    let res = scope.Get(this.Name);
    return [res[0]];
  }
}

Variable.RegisterReadWritable(Identifier.Claim);
Variable.RegisterReferenceable(Identifier.Claim);
Expression.Register(Identifier.Claim);
