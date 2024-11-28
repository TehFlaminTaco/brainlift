/* eslint-disable */
import { ASMInterpreter } from "../brainasm";
import { Claim, Claimer, Keywords } from "./brainchild";
import { Include } from "./include";
import { Scope } from "./Scope";
import { Token } from "./token";
import {
  TypeVoid,
  TypeInt,
  GeneratePointerType,
  TypeDefinition,
  GenerateFuncType,
  TypeDiscard,
  TypeCompiler,
} from "./Types";

function hexPad(value: number, amount: number = 2) {
  value ??= 0;
  return ("0".repeat(amount) + value.toString(16).toUpperCase()).slice(-amount);
}

/*
  (FuncType | "int" | "void" | identifier) "*"*
*/
export class VarType extends Token {
  PointerDepth: number = 0;
  TypeName: string = "";
  Generics: VarType[] = [];

  static CurrentGenericArgs: { [key: string]: string } = {};

  static Int: VarType;
  static Void: VarType;
  static IntPtr: VarType;
  static VoidPtr: VarType;
  static Any: VarType;
  static Type: VarType;
  static String: VarType;
  static Discard: VarType;
  static Compiler: VarType;

  static Claim(claimer: Claimer): VarType | null {
    var ftype = FuncType.Claim(claimer);
    if (ftype !== null) return ftype;
    let flag = claimer.Flag();
    let depth = 0;
    let ptr = claimer.Claim(/@+/);
    if (ptr.Success) depth = ptr.Body![0].length;
    var c = claimer.Claim(/(int|void|discard|[a-zA-Z_]\w*)\b/);
    if (!c.Success) return null;
    if (
      Keywords.includes(c.Body![0]) &&
      c.Body![0] !== "int" &&
      c.Body![0] !== "void" &&
      c.Body![0] !== "discard"
    ) {
      flag.Fail();
      return null;
    }
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
    let vType = new VarType(claimer, flag);
    vType.TypeName = c.Body![0];
    if (VarType.CurrentGenericArgs[vType.TypeName] !== undefined) {
      vType.TypeName = VarType.CurrentGenericArgs[vType.TypeName];
    }
    vType.PointerDepth = depth;
    vType.Generics = generics;
    return vType;
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

  IsWide(): boolean {
    return this.IsDefined() && (this.GetDefinition()?.Wide ?? false);
  }

  CastableFrom(other: VarType): boolean {
    if (this.TypeName === "var") return true;
    if (this.TypeName === "discard") return true;
    if (other.TypeName === "discard") return false;
    if (this.TypeName === "void" || this.TypeName.startsWith("functiongeneric$")) {
      return this.PointerDepth <= other.PointerDepth;
    }
    if (other.TypeName === "void" || other.TypeName.startsWith("functiongeneric$")) {
      return this.PointerDepth >= other.PointerDepth;
    }
    if (
      !(other instanceof FuncType) &&
      this.TypeName === other.TypeName &&
      this.PointerDepth === other.PointerDepth
    )
      return true;
    var typeDef = this.GetDefinition();
    return false;
  }

  AssignableFrom(other: VarType): boolean {
    if (this.TypeName === "var") return true;
    if (this.TypeName === "discard") return true;
    if (other.TypeName === "discard") return false;
    if (this.TypeName === "void" || this.TypeName.startsWith("functiongeneric$")) {
      return !other.IsWide() && this.PointerDepth <= other.PointerDepth;
    }
    if (other.TypeName === "void" || other.TypeName.startsWith("functiongeneric$")) {
      return !this.IsWide() && this.PointerDepth >= other.PointerDepth;
    }
    if (
      !(other instanceof FuncType) &&
      this.TypeName === other.TypeName &&
      this.PointerDepth <= other.PointerDepth
    )
      return true;
    var typeDef = this.GetDefinition();
    return false;
  }

  ConvertFrom(other: VarType): string[] {
    if (!this.AssignableFrom(other))
      throw new Error(`Cannot convert from ${other} to ${this}!`);
    if (this.TypeName === "var") return [];
    var o: string[] = [];
    if (this.PointerDepth < other.PointerDepth) {
      o.push(`xpopa`);
      for (var i = this.PointerDepth; i < other.PointerDepth; i++) {
        o.push(`ptra`);
      }
      o.push(`xpusha`);
    }
    if (this.TypeName === "void" || other.TypeName === "void" || this.TypeName.startsWith("functiongeneric$") || other.TypeName.startsWith("functiongeneric$")) {
      return o;
    }
    return o;
  }

  Debug(
    scope: Scope,
    bs: ASMInterpreter,
    label: string,
    identifier: string,
    location: number
  ): string {
    let valAtLocation = ((bs.Heap[location*4]??0) << 24) + ((bs.Heap[location*4 + 1]??0) << 16) + ((bs.Heap[location*4 + 2]??0) << 8) + ((bs.Heap[location*4 + 3]??0));
    if (scope.DebuggedVals.has(location))
      return `<span class='var' title='${label}'><b>${this.ToHTML()}</b> ${identifier}</span> = ${hexPad(
        valAtLocation,
        8
      )}`;
    scope.DebuggedVals.add(location);
    let t: TypeDefinition;
    if (
      this.PointerDepth === 0 &&
      (t = scope.UserTypes[this.TypeName]) &&
      (t.Wide || valAtLocation > 0)
    ) {
      let ptr = t.Wide ? location : valAtLocation;
      let cls = t.Wide ? valAtLocation : bs.Heap[valAtLocation];
      let val = hexPad(ptr, 8);
      let s = `<span class='var' title='${label}'><b>${this.ToHTML()}</b> ${identifier}</span> = ${val} {<br>`;
      let childrenByOffset: [VarType, number, string, string][] = [];
      if (t && this.Generics.length > 0) t = t.WithGenerics(this.Generics);
      for (let ident in t.Children) {
        let child = t.Children[ident];
        childrenByOffset[child[1]] = [child[0], child[1], child[2], ident];
      }
      for (let i = 0; i < childrenByOffset.length; i++) {
        let child = childrenByOffset[i];
        if (!child) continue;
        let v = ((bs.Heap[(ptr + child[1])*4]??0) << 24) + ((bs.Heap[(ptr + child[1])*4 + 1]??0) << 16) + ((bs.Heap[(ptr + child[1])*4 + 2]??0) << 8) + ((bs.Heap[(ptr + child[1])*4 + 3]??0) << 0);
        let expected = +child[2];
        if (bs.Labels[child[2]]) expected = bs.Labels[child[2]];
        if (v !== expected)
          s +=
            "\t" +
            child[0]
              .Debug(scope, bs, "", child[3], ptr + child[1])
              .replace(/<br>(?!$)/g, "<br>\t") +
            "<br>";
      }
      return s + "}";
    }
    let val = hexPad(valAtLocation, 8);
    return `<span class='var' title='${label}'><b>${this}</b> ${identifier}</span> = ${val}`;
  }

  ToHTML() {
    return this.toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  static AllEquals(targetStack: VarType[], receivedStack: VarType[]) {
    if (targetStack.length != receivedStack.length) return false;
    for (var i = 0; i < targetStack.length; i++) {
      if (!targetStack[i].Equals(receivedStack[i])) return false;
    }
    return true;
  }

  static MostSimilar(a: false|VarType[], b: false|VarType[], potential: boolean = false): false|VarType[] {
    if(a === false || b === false)
        return potential ? a||b : false;
    let similarTypes: VarType[] = [];
    for (let i = 0; i < a.length && i < b.length; i++){
      if(VarType.CanCoax([a[i]],[b[i]])[1])
        similarTypes.push(b[i])
      else if(VarType.CanCoax([b[i]],[a[i]])[1])
        similarTypes.push(a[i])
      else
        break;
    }
    return similarTypes;
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

  static oldCanCoax(targetStack: VarType[], receivedStack: VarType[]): boolean {
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

  static CanCoaxSoft(
    targetStack: VarType[],
    receivedStack: VarType[]
  ): boolean {
    var receivedPtr = 0;
    for (let targetPtr = 0; targetPtr < targetStack.length; targetPtr++) {
      if (!targetStack[targetPtr].AssignableFrom(receivedStack[receivedPtr]))
        return false;
      receivedPtr++;
      targetPtr++;
    }
    return true;
  }

  static CanCoax(
    targetStack: VarType[],
    receivedStack: VarType[],
    restricted: Set<
      [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[], GenericArgs: string[], File: string]
    > = new Set(),
    sticky: boolean = false
  ): [success: boolean, count?: number] {
    let scope = Scope.CURRENT;
    var receivedPtr = 0;
    let targetPtr = 0;
    while (targetPtr < targetStack.length) {
      if (receivedPtr >= receivedStack.length) return [false];
      while (receivedPtr < receivedStack.length) {
        if (sticky && receivedPtr > 0) {
          return [false, 0];
        }
        // Directly assignable
        if (targetStack[targetPtr].AssignableFrom(receivedStack[receivedPtr])) {
          receivedPtr++;
          targetPtr++;
          break;
        }
        let cachehit: [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]|null;
        if(cachehit=scope.CacheGet("cast",receivedStack.slice(receivedPtr).map(c=>c.toString()).join(",")+"&"+targetStack.slice(targetPtr).map(c=>c.toString()).join(","))){
          targetPtr += cachehit[0].length;
          receivedPtr += VarType.CanCoax(
            cachehit[1],
            receivedStack.slice(receivedPtr),
            restricted,
            true
          )[1]!;
          break;
        }else{
          // Get all metamethods
          var metas: Set<
            [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[], GenericArgs: string[], File: string]
          > = new Set();
          scope.MetaMethods["cast"]?.forEach((c) => metas.add(c));
          // That are casts to and from
          let metasArr = [...metas]
            .filter(c=>c[4]==="GLOBAL" || c[4]===scope.CurrentFile || Include.Includes[scope.CurrentFile]?.has(c[4]))
            .filter((c) =>
            VarType.CanCoaxSoft(
              targetStack.slice(targetPtr, targetPtr + c[0].length),
              c[0]
            )
          ).map(m=>scope.RemapGenericMetamethod(m, receivedStack, false));
          metasArr = metasArr.filter((c) => !restricted.has(c));
          metasArr = metasArr.filter((c) => {
            let r = new Set(restricted);
            r.add(c);
            return VarType.CanCoax(
              c[1],
              receivedStack.slice(receivedPtr),
              r,
              true
            )[0];
          });

          // Score all metas by how good a match they are
          var scoreArr: [
            meta: [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[], GenericArgs: string[], File: string],
            score: number
          ][] = metasArr.map((c) => [
            c,
            VarType.CountMatches(targetStack.slice(targetPtr), c[0]) * 100 +
              VarType.CountMatches(c[1], receivedStack.slice(receivedPtr)),
          ]);
          scoreArr.sort((a, b) => b[1] - a[1]);
          if (scoreArr.length === 0) {
            receivedPtr++;
            continue;
          }
          let best = scoreArr[0][1];
          scoreArr = scoreArr.filter((c) => c[1] >= best);
          if (scoreArr.length > 1)
            return [false, 0];
          let m = scoreArr[0][0];
          targetPtr += m[0].length;
          let r = new Set(restricted);
          r.add(m);
          let stickyCoax = VarType.CanCoax(
            m[1],
            receivedStack.slice(receivedPtr),
            r,
            true
          );
          receivedPtr += stickyCoax[1]!;
          if(stickyCoax[0])
            scope.TrySlowCache("cast",receivedStack.slice(receivedPtr).map(c=>c.toString()).join(",")+"&"+targetStack.slice(targetPtr).map(c=>c.toString()).join(","),[m[0],m[1],m[2]]);
        }
        break;
      }
      sticky = false;
    }
    return [true, receivedPtr];
  }

  static Coax(
    targetStack: VarType[],
    receivedStack: VarType[],
    restricted: Set<
      [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[], GenericArgs: string[], File: string]
    > = new Set(),
    cleanup: boolean = true,
    sticky: boolean = false
  ): [asm: string[], used: number, converted: VarType[]] {
    let scope = Scope.CURRENT;
    var receivedPtr = 0;
    var asm: string[] = [];
    // Cycle everything to the B stack (So we handle it from left to right)
    for (let i = 0; i < receivedStack.length; i++) {
      asm.push(...receivedStack[i].FlipXY());
    }
    let converted: VarType[] = [];
    let targetPtr = 0;
    while (targetPtr < targetStack.length) {
      if (receivedPtr >= receivedStack.length)
        throw new Error(`Failed to Coax (Missed check?)`);
      while (receivedPtr < receivedStack.length) {
        if (sticky && receivedPtr > 0) {
          throw new Error(`Failed to Coax (Missed check?)`);
        }
        // Directly assignable
        if (targetStack[targetPtr].AssignableFrom(receivedStack[receivedPtr])) {
          asm.push(...receivedStack[receivedPtr].FlipYX());
          asm.push(
            ...targetStack[targetPtr].ConvertFrom(receivedStack[receivedPtr])
          );
          converted.push(receivedStack[receivedPtr]);
          receivedPtr++;
          targetPtr++;
          break;
        }
        let cachehit: [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]|null;
        if(cachehit=scope.CacheGet("cast",receivedStack.slice(receivedPtr).map(c=>c.toString()).join(",")+"&"+targetStack.slice(targetPtr).map(c=>c.toString()).join(","))){
          let c = VarType.CanCoax(
            cachehit[1],
            receivedStack.slice(receivedPtr),
            restricted,
            true
          )[1]!;
          for (let i = 0; i < c; i++) {
            asm.push(...receivedStack[receivedPtr+i].FlipYX());
          }
          asm.push(
            ...VarType.Coax(
              cachehit[1],
              receivedStack.slice(receivedPtr, receivedPtr + c),
              restricted,
              false,
              true
            )[0]
          );
          asm.push(...cachehit[2]);
          converted.push(...cachehit[0]);
          targetPtr += cachehit[0].length;
          receivedPtr += c;
        }else{
          // Get all metamethods
          var metas: Set<
            [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[], GenericArgs: string[], File: string]
          > = new Set();
          scope.MetaMethods["cast"]?.forEach((c) => metas.add(c));
          let metasArr = [...metas].map(m=>scope.RemapGenericMetamethod(m, receivedStack, false));
          // That are casts to and from
          metasArr = metasArr.filter((c) => !restricted.has(c));
          metasArr = metasArr.filter((c) =>
            VarType.CanCoaxSoft(
              targetStack.slice(targetPtr, targetPtr + c[0].length),
              c[0]
            )
          );
          metasArr = metasArr.filter((c) => {
            let r = new Set(restricted);
            r.add(c);
            return VarType.CanCoax(
              c[1],
              receivedStack.slice(receivedPtr),
              r,
              true
            )[0];
          });

          // Score all metas by how good a match they are
          var scoreArr: [
            meta: [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[], GenericArgs: string[], File: string],
            score: number
          ][] = metasArr.map((c) => [
            c,
            VarType.CountMatches(targetStack.slice(targetPtr), c[0]) * 100 +
              VarType.CountMatches(c[1], receivedStack.slice(receivedPtr)),
          ]);
          scoreArr.sort((a, b) => b[1] - a[1]);
          if (scoreArr.length === 0)
            throw new Error(`Failed to Coax (Missed check?)`);
          let best = scoreArr[0][1];
          scoreArr = scoreArr.filter((c) => c[1] >= best);
          if (scoreArr.length > 1)
            throw new Error(
              `Ambigious casts from ${receivedStack.slice(
                receivedPtr
              )} to ${targetStack.slice(targetPtr)} (${scoreArr.length} choices)`
            );
          let m = scoreArr[0][0];
          var r = new Set(restricted);
          r.add(m);
          let canCoax = VarType.CanCoax(
            m[1],
            receivedStack.slice(receivedPtr),
            r,
            true
          );
          for (let i = 0; i < canCoax[1]!; i++) {
            asm.push(...receivedStack[receivedPtr+i].FlipYX());
          }
          asm.push(
            ...VarType.Coax(
              m[1],
              receivedStack.slice(receivedPtr, receivedPtr + canCoax[1]!),
              r,
              false,
              true
            )[0]
          );
          asm.push(...m[2]);
          converted.push(...m[0]);
          if(canCoax[0])
            scope.TrySlowCache("cast",receivedStack.slice(receivedPtr).map(c=>c.toString()).join(",")+"&"+targetStack.slice(targetPtr).map(c=>c.toString()).join(","),[m[0],m[1],m[2]]);
          targetPtr += m[0].length;
          receivedPtr += canCoax[1]!;
          break;
        }
      }
      sticky = false;
    }
    if (cleanup) {
      while (receivedPtr < receivedStack.length) asm.push(...receivedStack[receivedPtr++].YPop());
    }
    return [asm, receivedPtr, converted];
  }

  toString(): string {
    if (this.TypeName.startsWith("classgeneric$")) {
    }
    if (this.Generics.length > 0)
      return `${"@".repeat(this.PointerDepth)}${this.TypeName}<${
        this.Generics
      }>`;
    return `${"@".repeat(this.PointerDepth)}${this.TypeName}`;
  }

  Clone(): VarType {
    var t = new VarType(this.Claimer, this.Claim);
    t.PointerDepth = this.PointerDepth;
    t.TypeName = this.TypeName;
    t.Generics = this.Generics.concat();
    return t;
  }

  WithPointerDepth(depth: number): VarType {
    var t = this.Clone();
    t.PointerDepth = depth;
    return t;
  }

  WithDeltaPointerDepth(delta: number): VarType {
    var t = this.Clone();
    t.PointerDepth += delta;
    if (t.PointerDepth < 0) throw new Error(`Pointer depth cannot be negative!`);
    return t;
  }

  HasDefinition(): boolean {
    if (this.PointerDepth > 0) true;
    if (this.TypeName === "int") return true;
    if (this.TypeName === "void") return true;
    var userType = Scope.CURRENT.UserTypes[this.TypeName];
    if (!userType) return false;
    return true;
  }

  IsDefined(): boolean {
    if (this.PointerDepth > 0) {
      return true;
    }
    if (this.TypeName === "int") return true;
    if (this.TypeName === "void") return true;
    if (this.TypeName === "discard") return true;
    if (this.TypeName === "COMPILER") return true;
    if (this.TypeName.startsWith("classgeneric$")) return true;
    if (this.TypeName.startsWith("metamethodgeneric$")) return true;
    if (this.TypeName.startsWith("functiongeneric$")) return true;
    if (this.TypeName.startsWith("symbolic$")) return true;
    return !!Scope.CURRENT.UserTypes[this.TypeName];
  }

  GetDefinition(): TypeDefinition {
    if (this.PointerDepth > 0) {
      return GeneratePointerType(this);
    }
    if (this.TypeName === "int") return TypeInt;
    if (this.TypeName === "void") return TypeVoid;
    if (this.TypeName === "discard") return TypeDiscard;
    if (this.TypeName === "COMPILER") return TypeCompiler;
    if (this.TypeName.startsWith("classgeneric$")) return TypeVoid;
    if (this.TypeName.startsWith("metamethodgeneric$")) return TypeVoid;
    if (this.TypeName.startsWith("functiongeneric$")) return TypeVoid;
    var userType = Scope.CURRENT.UserTypes[this.TypeName];
    if (!userType && this.TypeName.startsWith("symbolic$")){
      userType = new TypeDefinition();
      userType.Name = this.TypeName;
      userType.Wide = true;
      userType.Size = 0;
      Scope.CURRENT.UserTypes[this.TypeName] = userType;
    }
    if (!userType) throw new Error(`Undefined type ${this.TypeName}`);
    if (this.Generics.length > 0) {
      userType = userType.WithGenerics(this.Generics);
    }
    return userType;
  }

  WithGenerics(genericArgs: VarType[], recurse: boolean = true): VarType {
    if (this.TypeName.startsWith("classgeneric$")) {
      let v = genericArgs[+this.TypeName.substr(13)].Clone();
      if(v.IsWide()) throw new Error("Wide-Types may not be used in generics, use a pointer instead.");
      v.PointerDepth += this.PointerDepth;
      return v;
    } else {
      let v = this.Clone();
      if (recurse) {
        for (let i = 0; i < v.Generics.length; i++) {
          v.Generics[i] = v.Generics[i].WithGenerics(genericArgs, true);
        }
      }
      return v;
    }
  }
  WithFunctionGenerics(genericArgs: VarType[]): VarType {
    if (this.TypeName.startsWith("functiongeneric$")) {
      let v = genericArgs[+this.TypeName.substr(16)].Clone();
      if(v.IsWide()) throw new Error("Wide-Types may not be used in generics, use a pointer instead.");
      v.PointerDepth += this.PointerDepth;
      for (let i = 0; i < v.Generics.length; i++) {
        v.Generics[i] = v.Generics[i].WithFunctionGenerics(genericArgs);
      }
      return v;
    }
    return this;
  }

  XPop(): string[] {
    let def = this.GetDefinition();
    if(!def.Wide) return ['xpop'];
    return new Array(def.Size).fill('xpop');
  }
  YPop(): string[] {
    let def = this.GetDefinition();
    if(!def.Wide) return ['ypop'];
    return new Array(def.Size).fill('ypop');
  }
  // Flip from the A stack to the B stack
  FlipXY(): string[] {
    let def = this.GetDefinition();
    if(!def.Wide) return ['xpopa', 'ypusha'];
    return new Array(def.Size).fill(['xpopa', 'ypusha']).flat();
  }
  // Flip from the B stack to the A stack
  FlipYX(): string[] {
    let def = this.GetDefinition();
    if(!def.Wide) return ['ypopa', 'xpusha'];
    return new Array(def.Size).fill(['ypopa', 'xpusha']).flat();
  }
  // Puts the value from the top of the selected stack to the location pointed to by the selected register
  // Move the location register to the end of the value
  Put(fromStack: "x"|"y" = "x", toLocation: "a"|"b" = "b"): string[] {
    let def = this.GetDefinition();
    let other = toLocation === "a" ? "b" : "a";
    if(!def.Wide) return [`${fromStack}pop${other}`, `put${other}ptr${toLocation}`];
    return new Array(def.Size).fill([`${fromStack}pop${other}`, `put${other}ptr${toLocation}`, `inc${toLocation}`]).flat().slice(0,-1);
  }
  // Grabs the value from the location pointed to by the selected register and puts it on the selected stack
  // Move the location register to the end of the value
  // Reversed is used purely to allow flipping the stack order. It assumes the b register points to the START of the location.
  Get(toStack: "x"|"y" = "x", fromLocation: "a"|"b" = "b", reversed: boolean = false): string[] {
    let def = this.GetDefinition();
    let other = fromLocation === "a" ? "b" : "a";
    if(!def.Wide) return [`cpy${fromLocation}${other}`, `ptr${other}`, `${toStack}push${other}`];
    if(def.Size === 0) return [];
    let o:string[] = [];
    if(!reversed)
      o.push(`add${fromLocation} ${def.Size-1}`)
    o.push(...new Array(def.Size).fill([`cpy${fromLocation}${other}`, `ptr${other}`, `${toStack}push${other}`, reversed ? `inc${fromLocation}` : `dec${fromLocation}`]).flat().slice(0,-1));
    return o;
  }
  // Flip the top of the A stack, uses scratch as temporary storage
  FlipX(): string[] {
    let def = this.GetDefinition();
    if(!def.Wide) return []; // Do nothing :D
    if(def.Size === 0) return [];
    return [`setb ${Scope.CURRENT.GetScratch(def.Size)}`, ...this.Put(), `setb ${Scope.CURRENT.GetScratch(def.Size)}`, ...this.Get("x","b",true)]
  }
  // Flip the top of the B stack, uses scratch as temporary storage
  FlipY(): string[] {
    let def = this.GetDefinition();
    if(def.Wide) return []; // Do nothing :D
    if(def.Size === 0) return [];
    return [`setb ${Scope.CURRENT.GetScratch(def.Size)}`, ...this.Put("y"), `setb ${Scope.CURRENT.GetScratch(def.Size)}`, ...this.Get("y","a",true)]
  }
  // Clone the top of the A stack, uses scratch as temporary storage
  CloneA(): string[] {
    let def = this.GetDefinition();
    if(!def.Wide) return [`xpopa`,`xpusha`,`xpusha`]; // Do nothing :D
    if(def.Size === 0) return [];
    let scratch = Scope.CURRENT.GetScratch(def.Size);
    return [`setb ${scratch}`, ...this.Put(), `setb ${scratch}`, ...this.Get("x","b"), `setb ${scratch}`, ...this.Get("x","b")];
  }
  // Clone the top of the B stack, uses scratch as temporary storage
  CloneB(): string[] {
    let def = this.GetDefinition();
    if(!def.Wide) return [`xpopa`,`xpusha`,`xpusha`]; // Do nothing :D
    if(def.Size === 0) return [];
    let scratch = Scope.CURRENT.GetScratch(def.Size);
    return [`setb ${scratch}`, ...this.Put("y"), `setb ${scratch}`, ...this.Get("y","b"), `setb ${scratch}`, ...this.Get("y","b")];
  }

}

export class FuncType extends VarType {
  ArgTypes: VarType[] = [];
  RetTypes: VarType[] = [];
  static Claim(claimer: Claimer): FuncType | null {
    var flag = claimer.Flag();
    let depth = 0;
    let ptr = claimer.Claim(/@+/);
    if (ptr.Success) depth = ptr.Body![0].length;
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
    fType.PointerDepth = depth;
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
  CastableFrom(other: VarType): boolean {
    if (other.TypeName === "void" || other.TypeName.startsWith("functiongeneric$"))
      return this.PointerDepth >= other.PointerDepth;
    if (!(other instanceof FuncType)) return false;
    if (other.PointerDepth < this.PointerDepth) return false;
    if (this.ArgTypes.length != other.ArgTypes.length) return false;
    if (this.RetTypes.length != other.RetTypes.length) return false;
    for (let i = 0; i < this.ArgTypes.length; i++)
      if (!other.ArgTypes[i].CastableFrom(this.ArgTypes[i])) return false;
    for (let i = 0; i < this.RetTypes.length; i++)
      if (!this.RetTypes[i].CastableFrom(other.RetTypes[i])) return false;
    return true;
  }

  AssignableFrom(other: VarType): boolean {
    if (other.TypeName === "void" || other.TypeName.startsWith("functiongeneric$"))
      return this.PointerDepth >= other.PointerDepth;
    if (!(other instanceof FuncType)) return false;
    if (other.PointerDepth < this.PointerDepth) return false;
    if (this.ArgTypes.length != other.ArgTypes.length) return false;
    if (this.RetTypes.length != other.RetTypes.length) return false;
    for (let i = 0; i < this.ArgTypes.length; i++)
      if (!other.ArgTypes[i].CastableFrom(this.ArgTypes[i])) return false;
    for (let i = 0; i < this.RetTypes.length; i++)
      if (!this.RetTypes[i].CastableFrom(other.RetTypes[i])) return false;
    return true;
  }
  ConvertFrom(other: VarType): string[] {
    if (!this.AssignableFrom(other))
      throw new Error(`cannot cast from ${other} to ${this}`);
    return [];
  }

  toString(): string {
    if (this.PointerDepth === 0) {
      return `func(${this.ArgTypes})${
        this.RetTypes.length > 0 ? "->" + this.RetTypes : ""
      }`;
    }
    return `${"@".repeat(this.PointerDepth)}(func(${this.ArgTypes})${
      this.RetTypes.length > 0 ? "->" + this.RetTypes : ""
    })`;
  }

  Clone(): FuncType {
    var t = new FuncType(this.Claimer, this.Claim);
    t.PointerDepth = this.PointerDepth;
    t.TypeName = this.TypeName;
    t.ArgTypes = this.ArgTypes.concat();
    t.RetTypes = this.RetTypes.concat();
    t.Generics = this.Generics;
    return t;
  }

  GetDefinition(): TypeDefinition {
    if (this.PointerDepth > 0) {
      return GeneratePointerType(this);
    }
    return GenerateFuncType(this);
  }

  WithGenerics(genericArgs: VarType[]): VarType {
    let c = this.Clone();
    c.ArgTypes = c.ArgTypes.map((c) => c.WithGenerics(genericArgs));
    c.RetTypes = c.RetTypes.map((c) => c.WithGenerics(genericArgs));
    return c;
  }

  WithFunctionGenerics(genericArgs: VarType[]): VarType {
    let c = this.Clone();
    c.ArgTypes = c.ArgTypes.map((c) => c.WithFunctionGenerics(genericArgs));
    c.RetTypes = c.RetTypes.map((c) => c.WithFunctionGenerics(genericArgs));
    return c;
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
VarType.String = new VarType(falseClaimer, falseFlag);
VarType.String.TypeName = "string";
VarType.Discard = new VarType(falseClaimer, falseFlag);
VarType.Discard.TypeName = "discard";
VarType.Compiler = new VarType(falseClaimer, falseFlag);
VarType.Compiler.TypeName = "COMPILER";