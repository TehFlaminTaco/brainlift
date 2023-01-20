/* eslint-disable */
import { Claim, Claimer, Keywords } from "./brainchild";
import { Scope } from "./Scope";
import { Token } from "./token";
import {
  TypeVoid,
  TypeInt,
  GeneratePointerType,
  TypeDefinition,
  GenerateFuncType,
} from "./Types";

/*
  (FuncType | "int" | "void" | identifier) "*"*
*/
export class VarType extends Token {
  PointerDepth: number = 0;
  TypeName: string = "";

  static Int: VarType;
  static Void: VarType;
  static IntPtr: VarType;
  static VoidPtr: VarType;
  static Any: VarType;
  static Type: VarType;

  static Claim(claimer: Claimer): VarType | null {
    var ftype = FuncType.Claim(claimer);
    if (ftype !== null) return VarType.Point(ftype, claimer);
    var c = claimer.Claim(/(int|void|[a-zA-Z_]\w*)\b/);
    if (!c.Success) return null;
    if (
      Keywords.includes(c.Body![0]) &&
      c.Body![0] !== "int" &&
      c.Body![0] !== "void"
    ) {
      c.Fail();
      return null;
    }
    var vType = new VarType(claimer, c);
    vType.TypeName = c.Body![0];
    return VarType.Point(vType, claimer);
  }

  static Point(typ: VarType, claimer: Claimer) {
    var d = 0;
    var c: Claim;
    while ((c = claimer.Claim(/\*/)).Success) {
      d++;
    }
    typ.PointerDepth = d;
    typ.End += d;
    return typ;
  }

  Equals(other: VarType): boolean {
    if (this.TypeName === "var") return true;
    if (other instanceof FuncType) {
      return false;
    }
    return (
      this.TypeName! === other.TypeName! &&
      this.PointerDepth === other.PointerDepth
    );
  }

  AssignableFrom(other: VarType, directly: boolean = false): boolean {
    if (this.TypeName === "var") return true;
    if (this.TypeName === "void") {
      return this.PointerDepth <= other.PointerDepth;
    }
    if (
      !(other instanceof FuncType) &&
      this.TypeName === other.TypeName &&
      this.PointerDepth <= other.PointerDepth
    )
      return true;
    if (!directly) {
      var typeDef = this.GetDefinition();
      var meta = typeDef.GetMetamethod("cast", [other], true, true);
      var otherType = other.GetDefinition();
      if (meta && meta[0].length > 0 && this.AssignableFrom(meta[0][0], true)) {
        return true;
      }
      meta = otherType.GetMetamethod("cast", [other], true, true);
      if (meta && meta[0].length > 0 && this.AssignableFrom(meta[0][0], true)) {
        return true;
      }
    }
    if (other instanceof FuncType) {
      return false;
    }
    return false;
  }

  ConvertFrom(other: VarType): string[] {
    if (!this.AssignableFrom(other))
      throw new Error(`Cannot convert from ${other} to ${this}!`);
    var o: string[] = [];
    if (this.TypeName === "void") {
      return o;
    }
    var typeDef = this.GetDefinition();
    var otherType = other.GetDefinition();
    var meta = typeDef.GetMetamethod("cast", [other]);
    if (
      meta !== null &&
      meta[0].length > 0 &&
      this.AssignableFrom(meta[0][0], true)
    ) {
      o.push(...meta[2]);
      for (var i = 1; i < meta[0].length; i++) o.push(`apop`);
      o.push(...this.ConvertFrom(meta[0][0]));
      return o;
    }
    meta = otherType.GetMetamethod("cast", [other]);
    if (
      meta !== null &&
      meta[0].length > 0 &&
      this.AssignableFrom(meta[0][0], true)
    ) {
      o.push(...meta[2]);
      for (var i = 1; i < meta[0].length; i++) o.push(`apop`);
      o.push(...this.ConvertFrom(meta[0][0]));
      return o;
    }
    if (this.PointerDepth < other.PointerDepth) {
      o.push(`apopa`);
      for (var i = this.PointerDepth; i < other.PointerDepth; i++) {
        o.push(`ptra`);
      }
      o.push(`apusha`);
    }
    return o;
  }

  static AllEquals(targetStack: VarType[], receivedStack: VarType[]) {
    if (targetStack.length != receivedStack.length) return falseClaimer;
    for (var i = 0; i < targetStack.length; i++) {
      if (!targetStack[i].Equals(receivedStack[i])) return false;
    }
    return true;
  }

  static CountMatches(
    targetStack: VarType[],
    receivedStack: VarType[]
  ): number {
    var n = Math.min(targetStack.length, receivedStack.length);
    var o = 0;
    for (var i = 0; i < n; i++) {
      if (targetStack[i].Equals(receivedStack[i])) o++;
    }
    return o;
  }

  static CanCoax(targetStack: VarType[], receivedStack: VarType[]): boolean {
    var maxRet = 0;
    for (let i = 0; i < targetStack.length; i++) {
      while (
        maxRet < receivedStack.length &&
        !targetStack[i].AssignableFrom(receivedStack[maxRet])
      )
        maxRet++;
      if (maxRet >= receivedStack.length) {
        return false;
      }
    }
    return true;
  }

  static Coax(targetStack: VarType[], receivedStack: VarType[]): string[] {
    var o = [];
    var targetLookup: { [id: number]: number } = {};
    var maxRet = 0;
    for (let i = 0; i < targetStack.length; i++) {
      if (targetStack[i].TypeName === "var") {
        targetStack[i] = receivedStack[maxRet];
        targetLookup[maxRet++] = i;
        continue;
      }
      while (
        maxRet < receivedStack.length &&
        !targetStack[i].AssignableFrom(receivedStack[maxRet])
      )
        maxRet++;
      if (maxRet >= receivedStack.length) {
        throw new Error(
          `Too many/Incorrect targets for expression. Expected: ${targetStack} Got: ${receivedStack}`
        );
      }
      targetLookup[maxRet++] = i;
    }

    for (let i = receivedStack.length - 1; i >= 0; i--) {
      if (targetLookup[i] !== undefined) {
        o.push(...targetStack[targetLookup[i]].ConvertFrom(receivedStack[i]));
        if (i > 0) o.push(`apopa`, `bpusha`);
      } else {
        o.push(`apop`);
        if (i === 0) {
          o.push(`bpopa`, `apusha`);
        }
      }
    }
    for (var i = 1; i < targetStack.length; i++) {
      o.push(`bpopa`, `apusha`);
    }
    return o;
  }

  toString(): string {
    return `${this.TypeName}${"*".repeat(this.PointerDepth)}`;
  }

  Clone(): VarType {
    var t = new VarType(this.Claimer, this.Claim);
    t.PointerDepth = this.PointerDepth;
    t.TypeName = this.TypeName;
    return t;
  }

  GetDefinition(): TypeDefinition {
    if (this.PointerDepth > 0) {
      return GeneratePointerType(this);
    }
    if (this.TypeName === "int") return TypeInt;
    if (this.TypeName === "void") return TypeVoid;
    var userType = Scope.CURRENT.UserTypes[this.TypeName];
    if (!userType) throw new Error(`Undefined type ${this.TypeName}`);
    return userType;
  }
}

export class FuncType extends VarType {
  ArgTypes: VarType[] = [];
  RetTypes: VarType[] = [];
  static Claim(claimer: Claimer): FuncType | null {
    var flag = claimer.Flag();
    var leftParen = claimer.Claim(/\(/);
    var fnc = claimer.Claim(/func\b/);
    if (!fnc.Success) {
      flag.Fail();
      return null;
    }

    if (!claimer.Claim(/\(/).Success) {
      flag.Fail();
      return null;
    }

    var argTypes: VarType[] = [];
    var c = VarType.Claim(claimer);
    while (c !== null) {
      argTypes.push(c);
      if (!claimer.Claim(/,/).Success) break;
      c = VarType.Claim(claimer);
    }
    if (!claimer.Claim(/\)/).Success) {
      flag.Fail();
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
    if (leftParen.Success && !claimer.Claim(/\)/).Success) {
      flag.Fail();
      return null;
    }

    var fType = new FuncType(claimer, flag);
    fType.ArgTypes = argTypes;
    fType.RetTypes = retTypes;
    return fType;
  }

  Equals(other: VarType): boolean {
    if (!(other instanceof FuncType)) {
      return false;
    }
    if (other.ArgTypes.length != this.ArgTypes.length) return false;
    if (other.RetTypes.length != this.RetTypes.length) return false;
    if (other.PointerDepth != this.PointerDepth) return false;
    for (var i = 0; i < this.ArgTypes.length; i++) {
      if (!this.ArgTypes[i].Equals(other.ArgTypes[i])) return false;
    }
    for (var i = 0; i < this.RetTypes.length; i++) {
      if (!this.RetTypes[i].Equals(other.RetTypes[i])) return false;
    }
    return true;
  }

  AssignableFrom(other: VarType): boolean {
    if (!(other instanceof FuncType)) return false;
    if (other.ArgTypes.length != this.ArgTypes.length) return false;
    if (other.RetTypes.length != this.RetTypes.length) return false;
    if (other.PointerDepth < this.PointerDepth) return false;
    for (var i = 0; i < this.ArgTypes.length; i++) {
      if (!this.ArgTypes[i].Equals(other.ArgTypes[i])) return false;
    }
    for (var i = 0; i < this.RetTypes.length; i++) {
      if (!this.RetTypes[i].Equals(other.RetTypes[i])) return false;
    }
    return true;
  }

  toString(): string {
    if (this.PointerDepth === 0) {
      return `func(${this.ArgTypes})${
        this.RetTypes.length > 0 ? "->" + this.RetTypes : ""
      }`;
    }
    return `(func(${this.ArgTypes})${
      this.RetTypes.length > 0 ? "->" + this.RetTypes : ""
    })${"*".repeat(this.PointerDepth)}`;
  }

  Clone(): FuncType {
    var t = new FuncType(this.Claimer, this.Claim);
    t.PointerDepth = this.PointerDepth;
    t.TypeName = this.TypeName;
    t.ArgTypes = this.ArgTypes.concat();
    t.RetTypes = this.RetTypes.concat();
    return t;
  }

  GetDefinition(): TypeDefinition {
    if (this.PointerDepth > 0) {
      return GeneratePointerType(this);
    }
    return GenerateFuncType(this);
  }
}

var falseClaimer = new Claimer("");
var falseFlag = falseClaimer.Flag();
VarType.Int = new VarType(falseClaimer, falseFlag);
VarType.Int.TypeName = "int";
VarType.Void = new VarType(falseClaimer, falseFlag);
VarType.Void.TypeName = "void";
VarType.IntPtr = new VarType(falseClaimer, falseFlag);
VarType.IntPtr.TypeName = "int";
VarType.IntPtr.PointerDepth = 1;
VarType.VoidPtr = new VarType(falseClaimer, falseFlag);
VarType.VoidPtr.TypeName = "void";
VarType.VoidPtr.PointerDepth = 1;
VarType.Any = new VarType(falseClaimer, falseFlag);
VarType.Any.TypeName = "var";
