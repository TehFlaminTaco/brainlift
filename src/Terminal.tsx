const TERMINAL_WIDTH = 64;
const TERMINAL_HEIGHT = 32;

enum Style {
  None = 0,
  Bold = 1,
  Dim = 2,
  Italic = 4,
  Underline = 8,
  Striked = 16,
}

type Vector2 = [x: number, y: number];
type Color = [r: number, g: number, b: number];
type Char = [character: string, fore: Color, back: Color, style: Style];

const White: Color = [1, 1, 1];
const Black: Color = [0, 0, 0];

function Clamp(n: number, l: number, h: number): number {
  if (n < l) return l;
  if (n > h) return h;
  return n;
}

function ColorEquals(a: Color, b: Color): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export class Terminal {
  Width: typeof TERMINAL_WIDTH = TERMINAL_WIDTH;
  Height: typeof TERMINAL_HEIGHT = TERMINAL_HEIGHT;

  Cursor: Vector2 = [0, 0];

  Characters: Char[][] = [];

  EscapeBuffer: string = "";
  Escaped: boolean = false;

  CurrentFore: Color = White;
  CurrentBack: Color = Black;
  CurrentStyle: Style = Style.None;

  CursorStack: Vector2[] = [];

  constructor() {
    for (let y = 0; y < this.Height; y++) {
      this.Characters[y] = [];
      for (let x = 0; x < this.Width; x++)
        this.Characters[y][x] = [" ", White, Black, Style.None];
    }
  }

  MoveCursor(x: number, y: number) {
    this.Cursor[0] = Clamp(this.Cursor[0] + (x | 0), 0, this.Width - 1);
    this.Cursor[1] = Clamp(this.Cursor[1] + (y | 0), 0, this.Height - 1);
  }

  AdvanceLine(n: number = 1) {
    n = Math.max(n | 0, 0);
    this.Cursor[1] += n;
  }

  AdvanceCursor(n: number = 1) {
    n = Math.max(n | 0, 0);
    this.Cursor[0] += n;
    while (this.Cursor[0] >= this.Width) {
      this.AdvanceLine();
      this.Cursor[0] -= this.Width;
    }
  }

  WriteChar(char: string) {
    while (this.Cursor[1] >= this.Height) {
      this.Cursor[1]--;
      this.Characters.push(this.Characters.shift()!);
      for (let x = 0; x < this.Width; x++)
        this.Characters[this.Height - 1][x] = [
          " ",
          this.CurrentFore,
          this.CurrentBack,
          this.CurrentStyle,
        ];
    }
    if (this.Escaped) {
      this.EscapeBuffer = this.EscapeBuffer + char;
      this.EvalEscape();
      return;
    }

    if (char === "\x1b") {
      this.Escaped = true;
      this.EscapeBuffer = "";
      return;
    }

    if (char === "\r") {
      this.Cursor[0] = 0;
      return;
    }

    if (char === "\n") {
      this.AdvanceLine();
      return;
    }

    if (char === "\t") {
      this.AdvanceCursor(4 - (this.Cursor[0] % 4));
      return;
    }

    if (char === "\x08") {
      if (this.Cursor[0] === 0) {
        this.MoveCursor(0, -1);
        this.Cursor[0] = this.Width - 1;
        this.WriteChar(" ");
        this.MoveCursor(0, -1);
        this.Cursor[0] = this.Width - 1;
        return;
      }
      this.MoveCursor(-1, 0);
      this.WriteChar(" ");
      this.MoveCursor(-1, 0);
    }

    if (!char.match(/[ -~]/)) char = "?";
    if (char === "<") char = "&lt;";
    if (char === "&") char = "&amp;";
    this.Characters[this.Cursor[1]][this.Cursor[0]] = [
      char,
      this.CurrentFore,
      this.CurrentBack,
      this.CurrentStyle,
    ];
    this.AdvanceCursor();
  }

  WriteAll(chars: string) {
    for (let i = 0; i < chars.length; i++) {
      this.WriteChar(chars.charAt(i));
    }
  }

  EvalEscape() {
    if (this.EscapeBuffer.length === 1) {
      if (this.EscapeBuffer !== "[") {
        this.Escaped = false;
        this.WriteChar("?");
        this.WriteChar(this.EscapeBuffer);
      }
      return;
    }

    let CursorCode = this.EscapeBuffer.match(/^\[(\d+)*([A-G])$/);
    if (CursorCode) {
      let num = +CursorCode[1];
      switch (CursorCode[2]) {
        case "A": {
          this.MoveCursor(0, -num);
          break;
        }
        case "B": {
          this.MoveCursor(0, num);
          break;
        }
        case "C": {
          this.MoveCursor(num, 0);
          break;
        }
        case "D": {
          this.MoveCursor(-num, 0);
          break;
        }
        case "E": {
          for (let n = 0; n < num; n++) this.AdvanceLine();
          this.Cursor[0] = 0;
          break;
        }
        case "F": {
          this.MoveCursor(0, -num);
          this.Cursor[0] = 0;
          break;
        }
        case "G": {
          this.Cursor[0] = Clamp(num, 0, this.Width - 1);
          break;
        }
      }
      this.Escaped = false;
      return;
    }
    let MoveTo = this.EscapeBuffer.match(/^\[(\d+);(\d+)[Hf]$/);
    if (MoveTo) {
      let row = +MoveTo[1];
      let col = +MoveTo[2];
      this.Cursor[0] = Clamp(col, 0, this.Width - 1);
      this.Cursor[1] = Clamp(row, 0, this.Height - 1);
      this.Escaped = false;
      return;
    }
    MoveTo = this.EscapeBuffer.match(/^\[(\d+)[Hf]$/);
    if (MoveTo) {
      let row = +MoveTo[1];
      this.Cursor[1] = Clamp(row, 0, this.Height - 1);
      this.Escaped = false;
      return;
    }
    switch (this.EscapeBuffer) {
      case "[H": {
        this.Cursor = [0, 0];
        this.Escaped = false;
        return;
      }
      case "[s": {
        this.CursorStack.push([this.Cursor[0], this.Cursor[1]]);
        this.Escaped = false;
        return;
      }
      case "[u": {
        this.Cursor = this.CursorStack.pop() ?? [0, 0];
        this.Escaped = false;
        return;
      }
      case "[J":
      case "[0J": {
        let TempCursor: Vector2 = [this.Cursor[0], this.Cursor[1]];
        while (
          this.Cursor[0] !== this.Width - 1 &&
          this.Cursor[0] !== this.Height - 1
        ) {
          this.WriteChar(" ");
        }
        this.Characters[this.Cursor[1]][this.Cursor[0]] = [
          " ",
          this.CurrentFore,
          this.CurrentBack,
          this.CurrentStyle,
        ];
        this.Cursor = TempCursor;
        this.Escaped = false;
        return;
      }
      case "[1J": {
        let TempCursor: Vector2 = [this.Cursor[0], this.Cursor[1]];
        this.Cursor = [0, 0];
        while (
          this.Cursor[0] !== TempCursor[0] &&
          this.Cursor[0] !== TempCursor[1]
        ) {
          this.WriteChar(" ");
        }
        this.Characters[this.Cursor[1]][this.Cursor[0]] = [
          " ",
          this.CurrentFore,
          this.CurrentBack,
          this.CurrentStyle,
        ];
        this.Escaped = false;
        return;
      }
      case "[2J": {
        for (let y = 0; y < this.Height; y++) {
          this.Characters[y] = [];
          for (let x = 0; x < this.Width; x++)
            this.Characters[y][x] = [
              " ",
              this.CurrentFore,
              this.CurrentBack,
              this.CurrentStyle,
            ];
        }
        this.Escaped = false;
        return;
      }
      case "[3J": {
        this.Escaped = false;
        return;
      }
    }
    if (this.EscapeBuffer.match(/^\[\d+(?:;\d+)*m/)) {
      for (let code of this.EscapeBuffer.matchAll(/\d+/g)) {
        let num = +code;
        if (num === 0) {
          this.CurrentFore = White;
          this.CurrentBack = Black;
          this.CurrentStyle = Style.None;
          continue;
        }
        if (num >= 30 && num <= 37) {
          num = num - 30;
          this.CurrentFore = [num % 2, (num >> 1) % 2, (num >> 2) % 2];
          continue;
        }
        if (num >= 40 && num <= 47) {
          num = num - 40;
          this.CurrentBack = [num % 2, (num >> 1) % 2, (num >> 2) % 2];
          continue;
        }
        switch (num) {
          case 1: {
            this.CurrentStyle |= Style.Bold;
            continue;
          }
          case 22: {
            this.CurrentStyle &= ~Style.Bold;
            continue;
          }
          case 3: {
            this.CurrentStyle |= Style.Italic;
            continue;
          }
          case 23: {
            this.CurrentStyle &= ~Style.Italic;
            continue;
          }
          case 4: {
            this.CurrentStyle |= Style.Underline;
            continue;
          }
          case 24: {
            this.CurrentStyle &= ~Style.Underline;
            continue;
          }
          case 9: {
            this.CurrentStyle |= Style.Striked;
            continue;
          }
          case 29: {
            this.CurrentStyle &= ~Style.Striked;
            continue;
          }
          case 39: {
            this.CurrentFore = White;
            continue;
          }
          case 49: {
            this.CurrentBack = Black;
            continue;
          }
        }
      }
      this.Escaped = false;
      return;
    }
    if (this.EscapeBuffer.match(/[a-zA-Z]$/)) {
      this.Escaped = false;
      return;
    }
  }

  Render(): string {
    let Body: string = "";
    let LastFore: Color = [White[0], White[1], White[2]];
    let LastBack: Color = [Black[0], Black[1], Black[2]];
    let LastStyle: Style = Style.None;
    Body += `<span style="color: rgb(255,255,255); background-color: rgb(0,0,0);">`;
    for (let y = 0; y < this.Height; y++) {
      for (let x = 0; x < this.Width; x++) {
        let char = this.Characters[y][x];
        if (
          !ColorEquals(LastFore, char[1]) ||
          !ColorEquals(LastBack, char[2]) ||
          char[3] !== LastStyle
        ) {
          LastFore = char[1];
          LastBack = char[2];
          LastStyle = char[3];
          let foreColor = `color: rgb(${LastFore[0] * 255},${
            LastFore[1] * 255
          },${LastFore[2] * 255});`;
          if (LastStyle & Style.Dim)
            foreColor = `color: rgb(${LastFore[0] * 127},${LastFore[1] * 127},${
              LastFore[2] * 127
            });`;
          let backColor = `background-color: rgb(${LastBack[0] * 255},${
            LastBack[1] * 255
          },${LastBack[2] * 255});`;
          let weight = LastStyle & Style.Bold ? ` font-weight: bold;` : ``;
          let decorations = "";
          if (LastStyle & Style.Underline) decorations = " underline";
          if (LastStyle & Style.Striked) decorations += " line-through";
          if (decorations.length > 0)
            decorations = ` text-decoration:${decorations};`;
          Body += `</span><span style="${foreColor} ${backColor}${weight}${decorations}">`;
        }
        if (char[0] === " ") {
          Body += "&nbsp;";
        } else {
          Body += char[0];
        }
      }
      Body += "\n";
    }

    return Body + "</span>";
  }
}

export enum Event {
  Click = 1,
  KeyDown = 2,
  KeyUp = 3,
  Frame = 4,
}
