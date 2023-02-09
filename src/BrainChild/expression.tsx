import { Claimer } from "./brainchild";
import { ExpressionStatement } from "./expressionstatement";
import { Scope } from "./Scope";
import { Token, TokenError } from "./token";
import { VarType } from "./vartype";

function IsRightDonor(e: Expression | null) {
  if (e === null) return false;
  return "Right" in e && "Precedence" in e && "LeftRightAssociative" in e;
}
function IsLeftDonor(e: Expression | null) {
  if (e === null) return false;
  return "Left" in e && "Precedence" in e && "LeftRightAssociative" in e;
}

export abstract class Expression extends Token {
  static ExpressionClaimers: Function[] = [];
  static ExpressionRightClaimers: Function[] = [];

  static Claim(claimer: Claimer): Expression | null {
    var s: Expression | null = null;
    var i = 0;
    while (s === null && i < Expression.ExpressionClaimers.length) {
      s = Expression.ExpressionClaimers[i++](claimer);
    }
    if (s !== null) {
      s = Expression.LBalance(s);
      s = Expression.RightClaim(s, claimer) ?? s;
    }
    return s;
  }

  static RightClaim(left: Expression, claimer: Claimer): Expression | null {
    var s: Expression | null = null;
    var i = 0;
    while (s === null && i < Expression.ExpressionRightClaimers.length) {
      s = Expression.ExpressionRightClaimers[i++](left, claimer);
    }
    if (s === null) return left;
    if (s !== null) {
      s = Expression.LBalance(s);
      s = Expression.RightClaim(s, claimer) ?? s;
    }
    return s;
  }

  static Register(method: Function) {
    Expression.ExpressionClaimers.splice(0, 0, method);
  }

  static RegisterRight(method: Function) {
    Expression.ExpressionRightClaimers.splice(0, 0, method);
  }

  static Balance(r: Expression): Expression {
    if (!IsLeftDonor(r)) return r;
    var right = r as unknown as LeftDonor;
    var l = right.Left;
    if (!IsRightDonor(l)) return r;
    var left = l as unknown as RightDonor;
    if (
      right.Precedence > left.Precedence ||
      (right.Precedence === left.Precedence && !right.LeftRightAssociative)
    ) {
      var lr = left.Right;
      left.Right = right as unknown as Expression;
      right.Left = lr;
      return left as unknown as Expression;
    }
    return right as unknown as Expression;
  }

  static LBalance(l: Expression): Expression {
    if (!IsRightDonor(l)) return l;
    var left = l as unknown as RightDonor;
    var r = left.Right;
    if (!IsLeftDonor(r)) return l;
    var right = r as unknown as LeftDonor;
    if (
      left.Precedence > right.Precedence ||
      (right.Precedence === left.Precedence && right.LeftRightAssociative)
    ) {
      var rl = right.Left;
      right.Left = left as unknown as Expression;
      left.Right = rl;
      return right as unknown as Expression;
    }
    return left as unknown as Expression;
  }

  abstract Evaluate(scope: Scope): [stack: VarType[], body: string[]];

  abstract GetTypes(scope: Scope): VarType[];

  TryEvaluate(scope: Scope): [stack: VarType[], body: string[]] {
    try {
      var o = this.Evaluate(scope);
      scope.InformType(this, o[0]);
      return o;
    } catch (e) {
      if (e instanceof TokenError) {
        let E = new TokenError(e.CallStack.concat(this), e.message);
        E.stack = e.stack;
        E.name = e.name;
        throw E;
      }
      if (e instanceof Error) {
        let E = new TokenError([this], e.message);
        E.stack = e.stack;
        E.name = e.name;
        throw E;
      } else {
        throw new TokenError([this], "" + e);
      }
    }
  }

  DefinitelyReturns(): boolean {
    return false;
  }
}

export interface Donor {
  Precedence: number;
  LeftRightAssociative: boolean;
}

export interface RightDonor extends Donor {
  Right: Expression | null;
}

export interface LeftDonor extends Donor {
  Left: Expression | null;
}
