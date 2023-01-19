import { Claimer } from "./brainchild";
import { Statement } from "./statement";
import { Scope } from "./Scope";
import { Token } from "./token";
import { VarType } from "./vartype";

function IsRightDonor(e: Expression|null){
  if(e===null)return false;
  return 'Right' in e && 'Precedence' in e && 'LeftRightAssociative' in e;
}
function IsLeftDonor(e: Expression|null){
  if(e===null)return false;
  return 'Left' in e && 'Precedence' in e && 'LeftRightAssociative' in e;
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
    if(s!==null) s = Expression.RightClaim(s, claimer)??s;
    return s;
  }

  static RightClaim(left: Expression, claimer: Claimer) : Expression | null {
    var s: Expression | null = null;
    var i = 0;
    while (s === null && i < Expression.ExpressionRightClaimers.length) {
      s = Expression.ExpressionRightClaimers[i++](left, claimer);
    }
    if(s === null)return left;
    if(s!==null){
      s = Expression.Balance(s);
      s = Expression.RightClaim(s, claimer)??s;
    }
    return s;
  }

  static Register(method: Function) {
    Expression.ExpressionClaimers.splice(0, 0, method);
  }

  static RegisterRight(method: Function){
    Expression.ExpressionRightClaimers.splice(0,0,method);
  }

  static Balance(r: Expression): Expression {
    if(!IsLeftDonor(r))return r;
    var right = r as unknown as LeftDonor;
    var l = right.Left;
    if(!IsRightDonor(l))return r;
    var left = l as unknown as RightDonor;
    if(right.Precedence > left.Precedence || (right.Precedence === left.Precedence && !right.LeftRightAssociative)){
      var lr = left.Right;
      left.Right = right as unknown as Expression;
      right.Left = lr;
      return left as unknown as Expression;
    }
    return right as unknown as Expression;
  }

  abstract Evaluate(scope: Scope): [stack: VarType[], body: string[]];
}


export interface Donor{
  Precedence: number;
  LeftRightAssociative: boolean;
}

export interface RightDonor extends Donor {
  Right: Expression|null;
}

export interface LeftDonor extends Donor {
  Left: Expression|null;
}