import { Claimer } from "./brainchild";
import { Scope } from "./Scope";
import { VarType } from "./vartype";

export interface Assignable {
  Assign(scope: Scope, anyType: VarType): string[];
  GetTypes(scope: Scope): VarType[];
}

export interface SimpleAssignable {
  AssignSimple(scope: Scope, value: number): boolean;
}

export interface Readable {
  Read(scope: Scope): string[];
  GetTypes(scope: Scope): VarType[];
}

export interface Referenceable {
  GetPointer(scope: Scope): string[];
  GetReferenceTypes(scope: Scope): VarType[];
}

export function IsAssignable(A: any) {
  return "Assign" in A && "GetTypes" in A;
}
export function IsSimpleAssignable(A: any) {
  return "AssignSimple" in A;
}
export function IsReadable(A: any) {
  return "Read" in A && "GetTypes" in A;
}
export function IsReadWritable(A: any) {
  return "Read" in A && "Assign" in A && "GetTypes" in A;
}
export function IsReferenceable(A: any) {
  return "GetPointer" in A && "GetReferenceTypes" in A;
}

export interface ReadWritable extends Assignable, Readable {}

export class Variable {
  static AssignableClaimers: Function[] = [];
  static ReadableClaimers: Function[] = [];
  static ReadWritableClaimers: Function[] = [];
  static ReferenceableClaimers: Function[] = [];
  static ClaimAssignable(
    claimer: Claimer,
    allowAny: boolean = false
  ): Assignable | null {
    var a: Assignable | null = null;
    var i = 0;
    while (a === null && i < Variable.AssignableClaimers.length) {
      a = Variable.AssignableClaimers[i++](claimer, allowAny);
    }
    return a;
  }
  static ClaimReadable(claimer: Claimer): Readable | null {
    var a: Readable | null = null;
    var i = 0;
    while (a === null && i < Variable.ReadableClaimers.length) {
      a = Variable.ReadableClaimers[i++](claimer);
    }
    return a;
  }
  static ClaimReadWritable(claimer: Claimer): ReadWritable | null {
    var a: ReadWritable | null = null;
    var i = 0;
    while (a === null && i < Variable.ReadWritableClaimers.length) {
      a = Variable.ReadWritableClaimers[i++](claimer);
    }
    return a;
  }
  static ClaimReferencable(claimer: Claimer): Referenceable | null {
    var a: Referenceable | null = null;
    var i = 0;
    while (a === null && i < Variable.ReferenceableClaimers.length) {
      a = Variable.ReferenceableClaimers[i++](claimer);
    }
    return a;
  }

  static RegisterAssignable(f: Function) {
    this.AssignableClaimers.splice(0, 0, f);
  }

  static RegisterReadable(f: Function) {
    this.ReadableClaimers.splice(0, 0, f);
  }

  static RegisterReadWritable(f: Function) {
    this.AssignableClaimers.splice(0, 0, f);
    this.ReadableClaimers.splice(0, 0, f);
    this.ReadWritableClaimers.splice(0, 0, f);
  }

  static RegisterReferenceable(f: Function) {
    this.ReferenceableClaimers.splice(0, 0, f);
  }
}
