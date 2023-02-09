import { Statement } from "./statement";
import { Claimer, KnownCodes, DoParse } from "./brainchild";
import { Scope } from "./Scope";

export class Include extends Statement {
  static Parsed: { [path: string]: Statement[] } = {};
  static Evaluated: { [path: string]: boolean } = {};
  static Includes: { [path: string]: Set<string> } = {};

  Path: string = "";
  static Claim(claimer: Claimer): Include | null {
    var ic = claimer.Claim(/include\b/);
    if (!ic.Success) {
      return null;
    }
    var c = claimer.Claim(/(.*?)(;|\r?\n)/);
    if (!c.Success) {
      ic.Fail();
      return null;
    }
    var inc = new Include(claimer, ic);
    inc.Path = c.Body![1];
    if (!KnownCodes[inc.Path]) {
      DoParse(inc.Path![1]);
    }
    Include.Includes[claimer.File] ??= new Set();
    Include.Includes[claimer.File].add(inc.Path!);
    if (Include.Includes[inc.Path!]) {
      Include.Includes[inc.Path!].forEach((c) =>
        Include.Includes[claimer.File].add(c)
      );
    }
    return inc;
  }

  Evaluate(scope: Scope): string[] {
    if (this.Path === this.Claimer.File) throw new Error(`Cannot self-include`);
    if (Include.Evaluated[this.Path]) return [];
    if (!Include.Parsed[this.Path]) {
      throw new Error(`Unable to find file: ${this.Path}`);
    }
    var o: string[] = [`file ${this.Path}`];
    scope.Assembly.push(`file ${this.Path}`);
    var lastLength = scope.Assembly.length;
    let oldFile = scope.CurrentFile;
    scope.CurrentFile = this.Path;
    Include.Parsed[this.Path].forEach((c) => {
      o.push(...c.TryEvaluate(scope));
    });
    scope.CurrentFile = oldFile;
    if (o.length > 1) o.push(`file ${this.Claimer.File}`);
    else o.pop();
    if (scope.Assembly.length > lastLength)
      scope.Assembly.push(`file ${this.Claimer.File}`);
    else scope.Assembly.pop();

    return o;
  }

  DefinitelyReturns(): boolean {
    return true;
  }
}
Statement.RegisterTopLevel(Include.Claim);
