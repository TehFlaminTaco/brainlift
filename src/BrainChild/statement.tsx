import { Claimer } from "./brainchild";
import { Identifier } from "./identifier";
import { Token } from "./token";
import { Expression } from "./expression";
import { Scope } from "./Scope";

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

  abstract DefinitelyReturns(): boolean;
}

Statement.RegisterTopLevel(Statement.Claim);
