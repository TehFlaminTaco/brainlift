import { Claimer } from "./brainchild";
import { Expression, RightDonor, LeftDonor } from "./expression";
import { Scope } from "./Scope";
import { IsSimplifyable, Simplifyable } from "./Simplifyable";
import { VarType } from "./vartype";

export let operators: [
  Match: RegExp,
  Meta: string,
  Precedence: number,
  LeftRightAssociative: boolean
][] = [
  [/\^/, "pow", 13, false],
  [/\*/, "mul", 12, true],
  [/\/%/, "divmod", 12, true],
  [/\//, "div", 12, true],
  [/%/, "mod", 12, true],
  [/\+/, "add", 11, true],
  [/-/, "sub", 11, true],
  [/<</, "bshl", 10, true],
  [/>>/, "bshr", 10, true],
  [/<=/, "le", 9, true],
  [/>=/, "ge", 9, true],
  [/</, "lt", 9, true],
  [/>/, "gt", 9, true],
  [/==/, "eq", 8, true],
  [/!=/, "ne", 8, true],
  [/&&/, "and", 4, true],
  [/\|\|/, "or", 3, true],

  [/&/, "band", 7, true],
  [/~/, "bxor", 6, true],
  [/\|/, "bor", 5, true],
];

export let unaryOperators: [Match: RegExp, Meta: string, Precedence: number][] =
  [
    [/!/, "not", 14],
    [/-/, "unm", 14],
    [/\+/, "unp", 14],
    [/~/, "bnot", 14],
  ];

export class MathExp
  extends Expression
  implements RightDonor, LeftDonor, Simplifyable
{
  Precedence: number = 0;
  LeftRightAssociative: boolean = true;
  Left: Expression | null = null;
  Right: Expression | null = null;
  Operator: string = "";

  static RightClaim(left: Expression, claimer: Claimer): MathExp | null {
    let flag = claimer.Flag();
    for (let i = 0; i < operators.length; i++) {
      let op = operators[i];
      if (claimer.Claim(op[0]).Success) {
        let right = Expression.Claim(claimer);
        if (right === null) {
          flag.Fail();
          return null;
        }

        let math = new MathExp(claimer, flag);
        math.Left = left;
        math.Right = right;
        math.Operator = op[1];
        math.Precedence = op[2];
        math.LeftRightAssociative = op[3];
        return math;
      }
    }
    return null;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    let v = this.Simplify(scope);
    if (v !== null)
      return [
        [VarType.Int],
        [this.GetLine(), `apush ${(v & 0xffffffff) >>> 0}`],
      ];
    let o: string[] = [this.GetLine()];
    if (this.Operator === "and") {
      let leftRes = this.Left!.TryEvaluate(scope);
      let rightRes = this.Right!.TryEvaluate(scope);
      // Run any truthy metamethod on the left
      let meta = scope.GetMetamethod("truthy", leftRes[0]);
      if (meta === null) throw new Error(`No truthy metamethod for type ${leftRes[0]}`);
      o.push(...leftRes[1]);
      o.push(...VarType.Coax(meta[1], leftRes[0])[0]);
      o.push(...meta[2]);
      o.push(...VarType.Coax([VarType.Int], meta[0])[0]);
      // If the top of the astack is truthy, run the right side and leave it's truthy value on the stack
      // Otherwise, leave this falsey value on the stack
      let rightSideLabel = scope.GetSafeName("rightSide");
      let afterRightSideLabel = scope.GetSafeName("afterRightSide");
      o.push(`apopa`, `jnza ${rightSideLabel}`, `apush 0`, `jmp ${afterRightSideLabel}`, `${rightSideLabel}:`);
      o.push(...rightRes[1]);
      meta = scope.GetMetamethod("truthy", rightRes[0]);
      if (meta === null) throw new Error(`No truthy metamethod for type ${rightRes[0]}`);
      o.push(...VarType.Coax(meta[1], rightRes[0])[0]);
      o.push(...meta[2]);
      o.push(...VarType.Coax([VarType.Int], meta[0])[0]);
      o.push(`${afterRightSideLabel}:`);
      return [[VarType.Int], o];
    }
    if (this.Operator === "or") {
      // Like and, but opposite
      let leftRes = this.Left!.TryEvaluate(scope);
      let rightRes = this.Right!.TryEvaluate(scope);
      // Run any truthy metamethod on the left
      let meta = scope.GetMetamethod("truthy", leftRes[0]);
      if (meta === null) throw new Error(`No truthy metamethod for type ${leftRes[0]}`);
      o.push(...leftRes[1]);
      o.push(...VarType.Coax(meta[1], leftRes[0])[0]);
      o.push(...meta[2]);
      o.push(...VarType.Coax([VarType.Int], meta[0])[0]);
      // If the top of the astack is truthy, leave this truthy value on the stack
      // Otherwise, run the right side and leave it's truthy value on the stack
      // We have to leave the truthy value on the stack  by duplicating it, and destroying it if the left side is falsey
      let afterRightSideLabel = scope.GetSafeName("afterRightSide");
      o.push(`apopa`, `apusha`, `jnza ${afterRightSideLabel}`);
      o.push(`apop`);
      o.push(...rightRes[1]);
      meta = scope.GetMetamethod("truthy", rightRes[0]);
      if (meta === null) throw new Error(`No truthy metamethod for type ${rightRes[0]}`);
      o.push(...VarType.Coax(meta[1], rightRes[0])[0]);
      o.push(...meta[2]);
      o.push(...VarType.Coax([VarType.Int], meta[0])[0]);
      o.push(`${afterRightSideLabel}:`);
      return [[VarType.Int], o];
    }
    let left = this.Left!.TryEvaluate(scope);
    if (left[0].length < 1)
      throw new Error(`Leftside expression does not resolve to any value.`);
    let bothArgs = [left[0][0]];
    o.push(...left[1]);
    for (let i = 1; i < left[0].length; i++) o.push(`apop`);
    let right = this.Right!.TryEvaluate(scope);
    o.push(...right[1]);
    bothArgs.push(...right[0]);

    let metamethod:
      | [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]
      | null = null;
    metamethod = scope.GetMetamethod(this.Operator, bothArgs);
    if (metamethod === null) {
      throw new Error(
        `No method for operator '${this.Operator}' for types ${bothArgs}`
      );
    }
    o.push(...VarType.Coax(metamethod[1], bothArgs)[0]);
    o.push(...metamethod[2]);
    return [metamethod[0], o];
  }

  GetTypes(scope: Scope): VarType[] {
    if (this.Simplify(scope) !== null) return [VarType.Int];
    if (this.Operator === "and" || this.Operator === "or") return [VarType.Int];
    let left = this.Left!.GetTypes(scope);
    if (left.length < 1)
      throw new Error(`Leftside expression does not resolve to any value.`);
    let bothArgs = [left[0]];
    let right = this.Right!.GetTypes(scope);
    bothArgs.push(...right);

    let metamethod:
      | [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]
      | null = null;
    metamethod = scope.GetMetamethod(this.Operator, bothArgs);
    if (metamethod === null) {
      throw new Error(
        `No method for operator '${this.Operator}' for types ${bothArgs}`
      );
    }
    return metamethod[0];
  }

  Simplify(scope: Scope): number | null {
    if (this.Operator === "and" || this.Operator === "or") {
      if (!IsSimplifyable(this.Left)) return null;
      let left = this.Left!.TrySimplify(scope);
      if (left === null) return null;
      if (this.Operator === "or" && left) return left;
      if (this.Operator === "and" && !left) return 0;
      if (!IsSimplifyable(this.Right)) return null;
      return this.Right!.TrySimplify(scope);
    }
    if (IsSimplifyable(this.Left) && IsSimplifyable(this.Right)) {
      let left = (this.Left!).TrySimplify(scope);
      let right = (this.Right!).TrySimplify(scope);
      if (left !== null && right !== null) {
        switch (this.Operator) {
          case "pow":
            return (Math.pow(left, right) & 0xffffffff) >>> 0;
          case "bshl":
            return ((left << right) & 0xffffffff) >>> 0;
          case "bshr":
            return ((left >> right) & 0xffffffff) >>> 0;
          case "band":
            return ((left & right) & 0xffffffff) >>> 0;
          case "bxor":
            return ((left ^ right) & 0xffffffff) >>> 0;
          case "bor":
            return ((left | right) & 0xffffffff) >>> 0;
          case "mul":
            return ((left * right) & 0xffffffff) >>> 0;
          case "div":
            return ((left / right) & 0xffffffff) >>> 0;
          case "mod":
            return (left % right & 0xffffffff) >>> 0;
          case "add":
            return ((left + right) & 0xffffffff) >>> 0;
          case "sub":
            return ((left - right) & 0xffffffff) >>> 0;
          case "le":
            return ((left <= right ? 1 : 0) & 0xffffffff) >>> 0;
          case "ge":
            return ((left >= right ? 1 : 0) & 0xffffffff) >>> 0;
          case "lt":
            return ((left < right ? 1 : 0) & 0xffffffff) >>> 0;
          case "gt":
            return ((left > right ? 1 : 0) & 0xffffffff) >>> 0;
          case "eq":
            return ((left === right ? 1 : 0) & 0xffffffff) >>> 0;
          case "ne":
            return ((left !== right ? 1 : 0) & 0xffffffff) >>> 0;
          case "and":
            return ((left && right) & 0xffffffff) >>> 0;
          case "or":
            return ((left || right) & 0xffffffff) >>> 0;
        }
      }
    }
    return null;
  }
}

export class UnaryMathExp
  extends Expression
  implements RightDonor, Simplifyable
{
  Precedence: number = 0;
  LeftRightAssociative: boolean = true;
  Right: Expression | null = null;
  Operator: string = "";

  static Claim(claimer: Claimer): UnaryMathExp | null {
    let flag = claimer.Flag();
    for (let i = 0; i < unaryOperators.length; i++) {
      let op = unaryOperators[i];
      if (claimer.Claim(op[0]).Success) {
        let right = Expression.Claim(claimer);
        if (right === null) {
          flag.Fail();
          return null;
        }

        let math = new UnaryMathExp(claimer, flag);
        math.Right = right;
        math.Operator = op[1];
        math.Precedence = op[2];
        return math;
      }
    }
    return null;
  }

  Evaluate(scope: Scope): [stack: VarType[], body: string[]] {
    let v = this.Simplify(scope);
    if (v !== null)
      return [
        [VarType.Int],
        [this.GetLine(), `apush ${(v & 0xffffffff) >>> 0}`],
      ];
    let o: string[] = [this.GetLine()];
    let bothArgs = [];
    let right = this.Right!.TryEvaluate(scope);
    o.push(...right[1]);
    bothArgs.push(...right[0]);

    let metamethod:
      | [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]
      | null = null;
    metamethod = scope.GetMetamethod(this.Operator, bothArgs);
    if (metamethod === null) {
      throw new Error(
        `No method for operator '${this.Operator}' for types ${bothArgs}`
      );
    }
    o.push(...VarType.Coax(metamethod[1], bothArgs)[0]);
    o.push(...metamethod[2]);
    return [metamethod[0], o];
  }

  GetTypes(scope: Scope): VarType[] {
    if (this.Simplify(scope) !== null) return [VarType.Int];
    let bothArgs = [];
    let right = this.Right!.GetTypes(scope);
    bothArgs.push(...right);

    let metamethod:
      | [ReturnTypes: VarType[], ArgTypes: VarType[], Code: string[]]
      | null = null;
    metamethod = scope.GetMetamethod(this.Operator, bothArgs);
    if (metamethod === null) {
      throw new Error(
        `No method for operator '${this.Operator}' for types ${bothArgs}`
      );
    }
    return metamethod[0];
  }

  Simplify(scope: Scope): number | null {
    if (IsSimplifyable(this.Right)) {
      let right = (this.Right as unknown as Simplifyable).Simplify(scope);
      if (right !== null) {
        switch (this.Operator) {
          case "not":
            return !right ? 1 : 0;
          case "unm":
            return -right;
          case "unp":
            return +right;
          case "bnot":
            return ~right;
        }
      }
    }
    return null;
  }
}

Expression.Register(UnaryMathExp.Claim);
Expression.RegisterRight(MathExp.RightClaim);
