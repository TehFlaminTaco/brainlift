import { Claimer } from "./brainchild";
import { Token, TokenError } from "./token";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export abstract class Statement extends Token {
  static StatementClaimers: Function[] = [];
  static TopLevelStatementClaimers: Function[] = [];

  static Claim(claimer: Claimer): Statement | null {
    var s: Statement | null = null;
    var i = 0;
    while (s === null && i < Statement.StatementClaimers.length) {
      s = Statement.StatementClaimers[i++](claimer);
    }
    return s;
  }

  static ClaimTopLevel(claimer: Claimer): Statement | null {
    var s: Statement | null = null;
    var i = 0;
    while (s === null && i < Statement.TopLevelStatementClaimers.length) {
      s = Statement.TopLevelStatementClaimers[i++](claimer);
    }
    return s;
  }

  static Register(method: Function) {
    Statement.StatementClaimers.splice(0, 0, method);
  }

  static RegisterTopLevel(method: Function) {
    Statement.TopLevelStatementClaimers.splice(0, 0, method);
  }

  abstract Evaluate(scope: Scope): string[];

  TryEvaluate(scope: Scope): string[] {
    try {
      return this.Evaluate(scope);
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

  abstract DefinitelyReturns(scope: Scope): false|VarType[];
}

Statement.RegisterTopLevel(Statement.Claim);
