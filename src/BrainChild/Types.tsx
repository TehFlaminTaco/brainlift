import { Assignment } from "./assignment";
import { FuncType, VarType } from "./vartype";

export class TypeDefinition {
  Assignments: Assignment[] = [];
  Children: { [id: string]: [type: VarType, offset: number, initial: string] } =
    {};
  ConstantChildren: { [id: string]: [type: VarType, value: number] } = {};
  VirtualChildren: {
    [id: string]: [
      type: VarType,
      parent: TypeDefinition,
      offset: number,
      initial: string
    ];
  } = {};
  Size: number = 1;

  TypeType: TypeDefinition | null = null;
  ClassLabel: string = "";
  Name: string = "";
  Wide: boolean = false; // For structs

  WithGenerics(genericArgs: VarType[]): TypeDefinition {
    let t = this.Clone();
    t.AddGenerics(genericArgs);
    return t;
  }

  AddGenerics(genericArgs: VarType[]) {
    for (let i in this.Children) {
      if (!this.Children[i]) continue;
      if (!this.Children[i][0]) continue;
      this.Children[i][0] = this.Children[i][0].WithGenerics(genericArgs);
    }
    for (let i in this.VirtualChildren) {
      if (!this.VirtualChildren[i]) continue;
      if (!this.VirtualChildren[i][0]) continue;
      this.VirtualChildren[i][0] =
        this.VirtualChildren[i][0].WithGenerics(genericArgs);
    }
    if (this.TypeType) this.TypeType.AddGenerics(genericArgs);
  }

  Clone(): TypeDefinition {
    let t = new TypeDefinition();
    for (let i in this.Children) {
      let child = this.Children[i];
      t.Children[i] = [child[0], child[1], child[2]];
    }
    for (let i in this.VirtualChildren) {
      let child = this.VirtualChildren[i];
      t.VirtualChildren[i] = [child[0], child[1], child[2], child[3]];
    }
    t.Size = this.Size;
    if (this.TypeType) t.TypeType = this.TypeType.Clone();
    t.ClassLabel = this.ClassLabel;
    t.Name = this.Name;
    t.Wide = this.Wide;
    return t;
  }
}

export var TypeInt = new TypeDefinition();
export var TypeVoid = new TypeDefinition();
export var TypeDiscard = new TypeDefinition();
TypeVoid.TypeType = new TypeDefinition();

export function GeneratePointerType(typ: VarType): TypeDefinition {
  var t = new TypeDefinition();
  return t;
}

export function GenerateFuncType(typ: FuncType): TypeDefinition {
  var t = new TypeDefinition();
  return t;
}
TypeInt.TypeType = new TypeDefinition();


export let TypeCompiler: TypeDefinition = new TypeDefinition();
TypeCompiler.Name = "COMPILER";
TypeCompiler.Wide = true;
TypeCompiler.Size = 0;