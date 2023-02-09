import { Claimer } from "./brainchild";
import { Expression } from "./expression";
import { Identifier } from "./identifier";
import { Include } from "./include";
import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { Statement } from "./statement";
import { StringConstant } from "./stringconstant";
import { Token } from "./token";
import { IsAssignable, Variable } from "./variable";
import { VarType } from "./vartype";

abstract class MDesc extends Token {
  LowCount: number = 1;
  HighCount: number = 1;
  static Claimers: Function[] = [];

  static Claim(claimer: Claimer): MDesc | null {
    var s: MDesc | null = null;
    var i = 0;
    while (s === null && i < MDesc.Claimers.length) {
      s = MDesc.Claimers[i++](claimer);
    }
    if (s === null) return null;
    let range = MDesc.Countify(claimer);
    s.LowCount = range[0];
    s.HighCount = range[1];
    return s;
  }

  static ClaimMany(claimer: Claimer): MDesc[] {
    let o: MDesc[] = [];
    let m = MDesc.Claim(claimer);
    while (m !== null) {
      o.push(m);
      m = MDesc.Claim(claimer);
    }
    return o;
  }

  static Countify(claimer: Claimer): [low: number, high: number] {
    if (claimer.Claim(/\*/).Success) return [0, Infinity];
    if (claimer.Claim(/\+/).Success) return [1, Infinity];
    if (claimer.Claim(/\?/).Success) return [0, 1];
    let ex = claimer.Claim(/\{(\d+)\}/);
    if (ex.Success) return [+ex.Body![1], +ex.Body![1]];
    ex = claimer.Claim(/\{(\d+),(\d+)\}/);
    if (ex.Success) return [+ex.Body![1], +ex.Body![2]];
    return [1, 1];
  }

  static Register(f: Function): void {
    MDesc.Claimers.push(f);
  }

  abstract TryClaim(claimer: Claimer, groups: string[]): string | null;

  static TryClaimAll(
    all: MDesc[],
    claimer: Claimer,
    groups: string[]
  ): string | null {
    if (groups.length === 0) groups[0] = "";
    let allstrings = "";
    let flag = claimer.Flag();
    for (let i = 0; i < all.length; i++) {
      let m = all[i];
      let j = 0;
      for (; j < m.HighCount; j++) {
        let s = m.TryClaim(claimer, groups);
        if (s === null) break;
        allstrings += s;
      }
      if (j < m.LowCount) {
        flag.Fail();
        return null;
      }
    }
    groups[0] = allstrings;
    return allstrings;
  }
  static TryRightClaimAll(
    left: Expression,
    all: MDesc[],
    claimer: Claimer,
    groups: string[]
  ): string | null {
    if (groups.length === 0) groups[0] = "";
    let allstrings = "";
    let flag = claimer.Flag();
    for (let i = 0; i < all.length; i++) {
      let m = all[i];
      let j = 0;
      for (; j < m.HighCount; j++) {
        if (j === 0 && i === 0) {
          let s = m.TryRightClaim(left, claimer, groups);
          if (s === null) return null;
          allstrings += s;
        } else {
          let s = m.TryClaim(claimer, groups);
          if (s === null) break;
          allstrings += s;
        }
      }
      if (j < m.LowCount) {
        flag.Fail();
        return null;
      }
    }
    groups[0] = allstrings;
    return allstrings;
  }

  abstract AllowRightClaim(): boolean;
  abstract OnlyRightClaim(): boolean;
  abstract TryRightClaim(
    left: Expression,
    claimer: Claimer,
    groups: string[]
  ): string | null;
}

class Regex extends MDesc {
  Body?: RegExp;
  static Claim(claimer: Claimer): Regex | null {
    let reg = claimer.Claim(/\/((?:\\.|[^/\\])*?)\//);
    if (!reg.Success) return null;
    let regex = new Regex(claimer, reg);
    regex.Body = new RegExp(reg.Body![1], "y");
    return regex;
  }

  TryClaim(claimer: Claimer): string | null {
    let c = claimer.Claim(this.Body!);
    if (c.Success) return c.Body![0];
    return null;
  }

  TryRightClaim(): string | null {
    return null;
  }

  AllowRightClaim(): boolean {
    return false;
  }

  OnlyRightClaim(): boolean {
    return false;
  }
}
MDesc.Register(Regex.Claim);

class DescString extends MDesc {
  Body?: RegExp;
  static Claim(claimer: Claimer): DescString | null {
    let st = claimer.Claim(/"((\\[bfnrt"\\]|.)+?)"/);
    let keyword = "";
    if (!st.Success) {
      st = claimer.Claim(/'((\\[bfnrt"\\]|.)+?)'/);
      if (!st.Success) return null;
      if (st.Body![1].match(/\w$/)) keyword = "\\b";
    }
    let str = new DescString(claimer, st);
    str.Body = new RegExp(
      st.Body![1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + keyword,
      "y"
    );
    return str;
  }

  TryClaim(claimer: Claimer): string | null {
    let c = claimer.Claim(this.Body!);
    if (c.Success) return c.Body![0];
    return null;
  }

  TryRightClaim(): string | null {
    return null;
  }

  AllowRightClaim(): boolean {
    return false;
  }

  OnlyRightClaim(): boolean {
    return false;
  }
}
MDesc.Register(DescString.Claim);

class TokenType extends MDesc {
  Name?: string;
  static Claim(claimer: Claimer): TokenType | null {
    let flg = claimer.Claim(/[a-zA-Z_]\w*/);
    if (!flg.Success) return null;
    let tty = new TokenType(claimer, flg);
    tty.Name = flg.Body![0];
    return tty;
  }

  TryClaim(claimer: Claimer): string | null {
    switch (this.Name!.toLowerCase()) {
      case "expression": {
        let start = claimer.Ptr;
        let e = Expression.Claim(claimer);
        if (e === null) return null;
        return claimer.Code.substr(start, claimer.Ptr - start);
      }
      case "assignable": {
        let start = claimer.Ptr;
        let a = Variable.ClaimAssignable(claimer);
        if (a === null) return null;
        return claimer.Code.substr(start, claimer.Ptr - start);
      }
      case "identifier": {
        let start = claimer.Ptr;
        let s = Identifier.Claim(claimer);
        if (s === null) return null;
        return claimer.Code.substr(start, claimer.Ptr - start);
      }
      case "type": {
        let start = claimer.Ptr;
        let e = VarType.Claim(claimer);
        if (e === null) return null;
        return claimer.Code.substr(start, claimer.Ptr - start);
      }
      case "number": {
        let start = claimer.Ptr;
        let e = Expression.Claim(claimer);
        if (e === null) return null;
        if (!IsSimplifyable(e)) return null;
        let r = (e as unknown as Simplifyable).Simplify();
        if (r === null) return null;
        return claimer.Code.substr(start, claimer.Ptr - start);
      }
      case "string": {
        let start = claimer.Ptr;
        let s = StringConstant.Claim(claimer);
        if (s === null) return null;
        return claimer.Code.substr(start, claimer.Ptr - start);
      }
    }
    let macros = Macro.Macros[claimer.File] ?? [];
    Include.Includes[claimer.File]?.forEach((c) =>
      macros.push(...(Macro.Macros[c] ?? []))
    );
    macros = macros.filter((c) => c.Name);
    macros = macros.filter((c) => c.Name!.Name === this.Name!);
    for (let i = 0; i < macros.length; i++) {
      let mac = macros[i];
      let groups: string[] = [];
      let code = MDesc.TryClaimAll(mac.Description, claimer, groups);
      if (code !== null) {
        return code;
      }
    }
    throw new Error(`Unknown type ${this.Name!}`);
  }

  TryRightClaim(left: Expression, claimer: Claimer): string | null {
    let l = this.Name!.toLowerCase();
    if (["expression", "assignable", "number"].includes(l)) {
      if (l === "expression") return left.toString();
      if (l === "assignable") return IsAssignable(left) ? left.toString() : null;
      if (l === "number")
        if (IsSimplifyable(left))
          return (left as any).Simplify()?.toString()
    }
    return null;
  }

  AllowRightClaim(): boolean {
    return ["expression", "assignable", "number"].includes(
      this.Name!.toLowerCase()
    );
  }
  OnlyRightClaim(): boolean {
    return ["expression", "assignable", "number"].includes(
      this.Name!.toLowerCase()
    );
  }
}
MDesc.Register(TokenType.Claim);

class Parenthetical extends MDesc {
  Options: MDesc[][] = [];
  GroupID?: number;
  static Claim(claimer: Claimer): Parenthetical | null {
    let lParen = claimer.Claim(/\(/);
    if (!lParen.Success) return null;
    let options: MDesc[][] = [];
    options.push(MDesc.ClaimMany(claimer));
    while (claimer.Claim(/\|/).Success) {
      options.push(MDesc.ClaimMany(claimer));
    }
    if (!claimer.Claim(/\)/).Success) {
      lParen.Fail();
      return null;
    }
    if (options.length === 0) {
      lParen.Fail();
      return null;
    }
    let parenth = new Parenthetical(claimer, lParen);
    parenth.Options = options;
    return parenth;
  }

  TryClaim(claimer: Claimer, groups: string[]): string | null {
    this.GroupID ??= groups.length;
    let flag = claimer.Flag();
    for (let i = 0; i < this.Options.length; i++) {
      let res = MDesc.TryClaimAll(this.Options[i], claimer, groups);
      if (res !== null) return (groups[this.GroupID] = res);
      flag.Fail(true);
    }
    flag.Fail();
    return null;
  }

  TryRightClaim(
    left: Expression,
    claimer: Claimer,
    groups: string[]
  ): string | null {
    this.GroupID ??= groups.length;
    let flag = claimer.Flag();
    for (let i = 0; i < this.Options.length; i++) {
      if (this.Options[i].length === 0) continue;
      if (!this.Options[i][0].AllowRightClaim()) continue;
      let res = MDesc.TryRightClaimAll(left, this.Options[i], claimer, groups);
      if (res !== null) return (groups[this.GroupID] = res);
      flag.Fail(true);
    }
    flag.Fail();
    return null;
  }

  AllowRightClaim(): boolean {
    for (let i = 0; i < this.Options.length; i++) {
      if (this.Options[i].length === 0) continue;
      if (this.Options[i][0].AllowRightClaim()) return true;
    }
    return false;
  }
  OnlyRightClaim(): boolean {
    for (let i = 0; i < this.Options.length; i++) {
      if (this.Options[i].length === 0) continue;
      if (!this.Options[i][0].OnlyRightClaim()) return false;
    }
    return true;
  }
}
MDesc.Register(Parenthetical.Claim);

class BackReference extends MDesc {
  GroupID: number = 0;
  static Claim(claimer: Claimer): BackReference | null {
    let backslash = claimer.Claim(/\\(\d+)/);
    if (!backslash.Success) return null;
    let br = new BackReference(claimer, backslash);
    br.GroupID = +backslash.Body![1];
    return br;
  }

  TryClaim(claimer: Claimer, groups: string[]): string | null {
    if (groups[this.GroupID] === undefined) {
      throw new Error(
        "Backreference must refer to a previously matched group!"
      );
    }
    let source = groups[this.GroupID].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let c = claimer.Claim(new RegExp(source, "y"));
    if (c.Success) return c.Body![0];
    return null;
  }

  AllowRightClaim(): boolean {
    return false;
  }
  TryRightClaim(): string | null {
    return null;
  }
  OnlyRightClaim(): boolean {
    return false;
  }
}
MDesc.Register(BackReference.Claim);

class MBody extends Token {
  Chunks: [number, string][] = [];
  static Claim(claimer: Claimer): MBody | null {
    let s = "";
    let chunks: [number, string][] = [];
    let d = 0;
    let flag = claimer.Flag();
    while (claimer.Ptr < claimer.Code.length && d >= 0) {
      let c = claimer.Code[claimer.Ptr++];
      switch (c) {
        case "$": {
          if (claimer.Code[claimer.Ptr].match(/\d/)) {
            chunks.push([0, s]);
            let cl = claimer.Claim(/\d+/);
            chunks.push([1, `${cl.Body![0]}`]);
            s = "";
          } else {
            s += claimer.Code[claimer.Ptr++] ?? "";
          }
          break;
        }
        case "#": {
          if (claimer.Code[claimer.Ptr].match(/\d/)) {
            chunks.push([0, s]);
            let cl = claimer.Claim(/\d+/);
            chunks.push([2, `${cl.Body![0]}`]);
            s = "";
          } else {
            s += "#";
          }
          break;
        }
        case "{": {
          d++;
          s += "{";
          break;
        }
        case "}": {
          d--;
          if (d < 0) {
            claimer.Ptr--;
            break;
          }
          s += "}";
          break;
        }
        default: {
          s += c;
        }
      }
    }
    if (s.length > 0) {
      chunks.push([0, s]);
    }
    if (d >= 0) {
      flag.Fail();
      return null;
    }
    let m = new MBody(claimer, flag);
    m.Chunks = chunks;
    return m;
  }

  Stringify(groups: string[]): string {
    let s = "";
    for (let i = 0; i < this.Chunks.length; i++) {
      let g = this.Chunks[i];
      switch (g[0]) {
        case 1:
          s += groups[+g[1]] ?? "";
          break;
        case 2:
          s += JSON.stringify(groups[+g[1]] ?? "");
          break;
        default:
          s += g[1];
      }
    }
    return s;
  }
}

export class Macro extends Statement {
  Name?: Identifier;
  Description: MDesc[] = [];
  Body?: MBody;

  static Macros: { [file: string]: Macro[] } = {};

  static Claim(claimer: Claimer): Macro | null {
    let mac = claimer.Claim(/macro\b/);
    if (!mac.Success) {
      return null;
    }
    let name = Identifier.Claim(claimer);
    if (!claimer.Claim(/\(/).Success) {
      mac.Fail();
      return null;
    }
    let description = MDesc.ClaimMany(claimer);
    if (description.length === 0) {
      mac.Fail();
      return null;
    }
    if (!claimer.Claim(/\)/).Success) {
      mac.Fail();
      return null;
    }
    if (!claimer.Claim(/\{/).Success) {
      mac.Fail();
      return null;
    }
    let body = MBody.Claim(claimer);
    if (!body) {
      mac.Fail();
      return null;
    }
    if (!claimer.Claim(/\}/).Success) {
      mac.Fail();
      return null;
    }
    let macro = new Macro(claimer, mac);
    macro.Name = name ?? undefined;
    macro.Description = description;
    macro.Body = body;
    Macro.Macros[claimer.File] ??= [];
    Macro.Macros[claimer.File].push(macro);
    return macro;
  }

  Evaluate(): string[] {
    return [];
  }

  DefinitelyReturns(): boolean {
    return false;
  }
}

let MacroDepth: number = 0;
export class Macrod extends Expression {
  Text: string = "";

  static Claim(claimer: Claimer): Macrod | null {
    let macros = Macro.Macros[claimer.File] ?? [];
    Include.Includes[claimer.File]?.forEach((c) =>
      macros.push(...(Macro.Macros[c] ?? []))
    );
    let flag = claimer.Flag();
    for (let i = 0; i < macros.length; i++) {
      let mac = macros[i];
      if (mac.Description[0].OnlyRightClaim()) continue;
      let groups: string[] = [];
      let code = MDesc.TryClaimAll(mac.Description, claimer, groups);
      if (code !== null) {
        let macrod = new Macrod(claimer, flag);
        macrod.Text = mac.Body!.Stringify(groups);
        return macrod;
      }
    }
    return null;
  }

  static RightClaim(left: Expression, claimer: Claimer): Macrod | null {
    let macros = Macro.Macros[claimer.File] ?? [];
    Include.Includes[claimer.File]?.forEach((c) =>
      macros.push(...(Macro.Macros[c] ?? []))
    );
    let flag = claimer.Flag();
    for (let i = 0; i < macros.length; i++) {
      let mac = macros[i];
      let groups: string[] = [];
      let code = MDesc.TryRightClaimAll(left, mac.Description, claimer, groups);
      if (code !== null) {
        let macrod = new Macrod(claimer, flag);
        macrod.Text = mac.Body!.Stringify(groups);
        return macrod;
      }
    }
    return null;
  }

  Unpacked?: Expression;
  Evaluate(scope: Scope): [VarType[], string[]] {
    if (MacroDepth >= 1001) {
      throw new Error("Exceeded maximum Macro-depth!");
    }
    try {
      MacroDepth++;
      if (!this.Unpacked) {
        let claimer = new Claimer(this.Text, this.Claimer.File);
        let exp = Expression.Claim(claimer);
        if (exp === null)
          throw new Error(
            `Failed to resolve macro to expression! Expanded: ${this.Text}`
          );
        this.Unpacked = exp;
      }

      let res = this.Unpacked.Evaluate(scope);
      MacroDepth--;
      return res;
    } catch (e) {
      MacroDepth--;
      throw e;
    }
  }

  GetTypes(scope: Scope): VarType[] {
    if (!this.Unpacked) {
      let claimer = new Claimer(this.Text, this.Claimer.File);
      let exp = Expression.Claim(claimer);
      if (exp === null)
        throw new Error(
          `Failed to resolve macro to expression! Expanded: ${this.Text}`
        );
      this.Unpacked = exp;
    }
    return this.Unpacked.GetTypes(scope);
  }
}

Statement.RegisterTopLevel(Macro.Claim);
Expression.Register(Macrod.Claim);
Expression.RegisterRight(Macrod.RightClaim);
