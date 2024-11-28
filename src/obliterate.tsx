import { Scope } from "./BrainChild/Scope";

type relativevalue = string;

type FileCommand = {
    shape: "FILE";
    preWhitespace?: string;
    arg?: string;
};
type LineCommand = {
    shape: "LINE";
    preWhitespace?: string;
    arg?: string;
};
type RemCommand = {
    shape: "REM";
    preWhitespace?: string;
    arg?: string;
    postWhitespace?: string;
    label?: string;
};
type CmdCommand = {
    shape: "CMD";
    preWhitespace?: string;
    command?: string;
    arg?: string;
    postWhitespace?: string;
    label?: string;
};
type DbCommand = {
    shape: "DB";
    preWhitespace?: string;
    arg?: string;
    postWhitespace?: string;
    label?: string;
};
type LabelCommand = {
    shape: "LABEL";
    preWhitespace?: string;
    label?: string;
    postWhitespace?: string;
};

let cleanup = (s:string) => {
    s=s.trim();
    if(!s.length)return undefined;
    if(s.match(/^\d+/))return s;
    return `"${s}"`
}

class MiniInterpreterState {
    rega: relativevalue = "a";
    regb: relativevalue = "b";
    xstack: relativevalue[] = [];
    ystack: relativevalue[] = [];
    xstackIndex = 0;
    ystackIndex = 0;
    xmindex = 0;
    ymindex = 0;
    static Of(cmds: CmdCommand[]): MiniInterpreterState {
        let s = new MiniInterpreterState();
        cmds.forEach(c=>NPSimpleStatments.get(c.command!)!({state: s, arg: cleanup(c.arg??"")}))
        return s;
    }
    xPush(v: relativevalue){
        if(v !== `xstack[${this.xstackIndex}]`)
            this.xstack[this.xstackIndex] = v;
        else
            delete this.xstack[this.xstackIndex];
        this.xstackIndex++;
    }
    yPush(v: relativevalue){
        if(v !== `ystack[${this.ystackIndex}]`)
            this.ystack[this.ystackIndex] = v;
        else
            delete this.ystack[this.ystackIndex];
        this.ystackIndex++;
    }
    xPop(): relativevalue {
        this.xstackIndex--;
        if(this.xstackIndex<this.xmindex)this.xmindex = this.xstackIndex;
        let old = this.xstack[this.xstackIndex] ?? `xstack[${this.xstackIndex}]`;
        delete this.xstack[this.xstackIndex];
        return old
    }
    yPop(): relativevalue {
        this.ystackIndex--;
        if(this.ystackIndex<this.ymindex)this.ymindex = this.ystackIndex;
        let old = this.ystack[this.ystackIndex] ?? `ystack[${this.ystackIndex}]`;
        delete this.ystack[this.ystackIndex];
        return old
    }
    Like(other: MiniInterpreterState){
        return this.rega === other.rega
            && this.regb === other.regb
            && JSON.stringify(this.xstack) === JSON.stringify(other.xstack)
            && JSON.stringify(this.ystack) === JSON.stringify(other.ystack)
            && this.xstackIndex === other.xstackIndex
            && this.ystackIndex === other.ystackIndex
            && this.xmindex     === other.xmindex
            && this.ymindex     === other.ymindex;
    }
}
interface InstructionState {
    state: MiniInterpreterState,
    arg?: string
}
const NPSimpleStatments: Map<string,(args:InstructionState)=>void> = new Map([
    ['seta', args=>args.state.rega = args.arg!],
    ['setb', args=>args.state.regb = args.arg!],
    ['cpyab', args=>args.state.regb = args.state.rega],
    ['cpyba', args=>args.state.rega = args.state.regb],
    // ['ptra', args=>args.state.rega = `${args.state.rega} @`],
    // ['ptrb', args=>args.state.regb = `${args.state.regb} @`],
    // ['inca', args=>args.state.rega = `${args.state.rega} 1 +`],
    // ['incb', args=>args.state.regb = `${args.state.regb} 1 +`],
    // ['deca', args=>args.state.rega = `${args.state.rega} 1 -`],
    // ['decb', args=>args.state.regb = `${args.state.regb} 1 -`],
    // ['adda', args=>args.state.rega = `${args.state.rega} ${args.arg!} +`],
    // ['addb', args=>args.state.rega = `${args.state.regb} ${args.arg!} +`],
    // ['addab', args=>{args.state.regb = `${args.state.regb} ${args.state.rega} +`;args.state.rega = `0`}],
    // ['addba', args=>{args.state.rega = `${args.state.rega} ${args.state.regb} +`;args.state.regb = `0`}],
    // ['suba', args=>args.state.rega = `${args.state.rega} ${args.arg!} -`],
    // ['subb', args=>args.state.rega = `${args.state.regb} ${args.arg!} -`],
    // ['subab', args=>{args.state.regb = `${args.state.rega} ${args.state.regb} -`;args.state.rega = `0`}],
    // ['subba', args=>{args.state.rega = `${args.state.regb} ${args.state.rega} -`;args.state.regb = `0`}],
    // ['mulab', args=>{args.state.regb = `${args.state.rega} ${args.state.regb} *`;args.state.rega = `0`}],
    // ['mulba', args=>{args.state.rega = `${args.state.regb} ${args.state.rega} *`;args.state.regb = `0`}],
    // ['divab', args=>{let a=args.state.rega; let b=args.state.regb; args.state.regb = `${a} ${b} /`;args.state.rega = `${a} ${b} %`}],
    // ['divba', args=>{let a=args.state.rega; let b=args.state.regb; args.state.rega = `${b} ${a} /`;args.state.regb = `${b} ${a} %`}],
    ['xpush', args=>{args.state.xPush(args.arg!)}],
    ['ypush', args=>{args.state.yPush(args.arg!)}],
    ['xpusha', args=>{args.state.xPush(args.state.rega)}],
    ['xpushb', args=>{args.state.xPush(args.state.regb)}],
    ['ypusha', args=>{args.state.yPush(args.state.rega)}],
    ['ypushb', args=>{args.state.yPush(args.state.regb)}],
    ['xpop', args=>{args.state.xPop()}],
    ['ypop', args=>{args.state.yPop()}],
    ['xpopa', args=>{args.state.rega = args.state.xPop()}],
    ['xpopb', args=>{args.state.regb = args.state.xPop()}],
    ['ypopa', args=>{args.state.rega = args.state.yPop()}],
    ['ypopb', args=>{args.state.regb = args.state.yPop()}],
]);

export function Obliterate(commands: string[]){
    // Each command is one of a couple of shapes
    // FILE [arg]
    // LINE [arg]
    // [label:] rem [arg]
    // [label:] (command) [arg]
    // [label:] db [arg]
    // [label:]

    // Each line may optionally have whitespace before or after the label

    // We'll split the commands into these shapes to make processing them easier, and we'll spew them out re-compiled.
    /*interface Command {
        shape: "FILE" | "LINE" | "REM" | "CMD" | "DB" | "LABEL";
        label?: string;
        command?: string;
        arg?: string; // We use a string because we don't want to waste time processing the args
        preWhitespace?: string;
        postWhitespace?: string;
    }*/

    type Command = FileCommand | LineCommand | RemCommand | CmdCommand | DbCommand | LabelCommand

    function rebuildCommand(command: Command): string {
        switch (command.shape) {
            case "FILE":
                return `${command.preWhitespace??""}FILE${command.arg??""}`;
            case "LINE":
                return `${command.preWhitespace??""}LINE${command.arg??""}`;
            case "REM":
                return `${command.preWhitespace??""}${command.label??""}${command.postWhitespace??""}REM${command.arg??""}`;
            case "CMD":
                return `${command.preWhitespace??""}${command.label??""}${command.postWhitespace??""}${command.command!.toLowerCase()}${command.arg??""}`;
            case "DB":
                return `${command.preWhitespace??""}${command.label??""}${command.postWhitespace??""}db${command.arg??""}`;
            case "LABEL":
                return `${command.preWhitespace??""}${command.label??""}${command.postWhitespace??""}`;
            default:
                throw new Error("Unknown command shape");
        }
    };

    const fileRegex = /^(\s*)FILE(\s*.*)$/i;
    const lineRegex = /^(\s*)LINE(\s*.*)$/i;
    const remRegex = /^(\s*)([a-z0-9_]+:)?(\s*)REM(\s*.*)$/i;
    const cmdRegex = /^(\s*)([a-z0-9_]+:)?(\s*)([a-z0-9_]+)(\s*.*)$/i;
    const dbRegex = /^(\s*)([a-z0-9_]+:)?(\s*)db(\s*.*)$/i;
    const labelRegex = /^(\s*)([a-z0-9_]+:)?(\s*)$/i;
    function parseCommand(command: string): Command {
        let match: RegExpMatchArray | null;
        if(match = command.match(fileRegex)) {
            return {
                shape: "FILE",
                preWhitespace: match[1],
                arg: match[2]
            };
        } else if(match = command.match(lineRegex)) {
            return {
                shape: "LINE",
                preWhitespace: match[1],
                arg: match[2]
            };
        } else if(match = command.match(remRegex)) {
            return {
                shape: "REM",
                preWhitespace: match[1],
                label: match[2],
                postWhitespace: match[3],
                arg: match[4]
            };
        } else if(match = command.match(dbRegex)) {
            return {
                shape: "DB",
                preWhitespace: match[1],
                label: match[2],
                postWhitespace: match[3],
                arg: match[4]
            };
        } else if(match = command.match(labelRegex)) {
            return {
                shape: "LABEL",
                preWhitespace: match[1],
                label: match[2],
                postWhitespace: match[3]
            };
        } else if(match = command.match(cmdRegex)) {
            return {
                shape: "CMD",
                preWhitespace: match[1],
                label: match[2],
                postWhitespace: match[3],
                command: match[4].toLowerCase(),
                arg: match[5]
            };
        } else {
            throw new Error(`Unable to parse command: "${command}"`);
        }
    }

    function SimplifyCommands(commands: Command[]): Command[] {
        if(commands.length <= 1)
                return commands; // No processing needed.
        // Any group of length >1 is CMD only, thankfully.
        let state: MiniInterpreterState = MiniInterpreterState.Of(commands as CmdCommand[]);
        //console.log(commands, state);
        // Find 'The cursed' instance where All A, B, X, and Y are needed in one statement.
        let txt = `${state.rega}|${state.regb}|${[...state.xstack.values()].join(',')}|${[...state.ystack.values()].join(',')}`
        txt=txt.replace(/"[^"]*"/g,"").replace(/xstack/g,"x").replace(/ystack/g,"y");
        let hasA = txt.indexOf("a")>-1;
        let hasB = txt.indexOf("b")>-1;
        let hasX = txt.indexOf("x")>-1 || [...new Array(-state.xmindex).keys()].some(c=>state.xstack[-1-c]===undefined)// || state.xstackIndex < 0 || [...state.xstack.keys()].some(c=>c<0)
        let hasY = txt.indexOf("y")>-1 || [...new Array(-state.ymindex).keys()].some(c=>state.ystack[-1-c]===undefined)// || state.ystackIndex < 0 || [...state.ystack.keys()].some(c=>c<0)
                
        if(!hasX && !hasY){
            let newCommands: string[] = [];
            for(let i=state.xmindex; i<0; i++)
                newCommands.push(`xpop`);
            for(let i=state.ymindex; i<0; i++)
                newCommands.push(`ypop`);
            for(let i=state.xmindex; i < state.xstackIndex; i++){
                switch (state.xstack[i]){
                    case 'a':
                        newCommands.push('xpusha');
                        break;
                    case 'b':
                        newCommands.push(`xpushb`)
                        break;
                    default:
                        newCommands.push(`xpush ${state.xstack[i].replaceAll('"',"")}`)
                }
            }
            for(let i=state.ymindex; i < state.ystackIndex; i++){
                switch (state.ystack[i]){
                    case 'a':
                        newCommands.push('ypusha');
                        break;
                    case 'b':
                        newCommands.push(`ypushb`)
                        break;
                    default:
                        newCommands.push(`ypush ${state.ystack[i].replaceAll('"',"")}`)
                }
            }
            if(state.rega === 'b' && state.regb === 'a'){
                newCommands.push(`xpusha`,`cpyba`,`xpopb`)
            }else{
                if(state.rega === 'b')
                    newCommands.push(`cpyba`);
                else if(state.regb === 'a')
                    newCommands.push(`cpyab`);
                if(state.rega !== 'a' && state.rega !== 'b')
                    newCommands.push(`seta ${state.rega.replaceAll('"',"")}`)
                if(state.regb !== 'a' && state.regb !== 'b')
                    newCommands.push(`setb ${state.regb.replaceAll('"',"")}`)
            }
            if(newCommands.length < commands.length){
                return newCommands.map(c=>parseCommand(c));
            }
            if(newCommands.length > commands.length)
                debugger;
            if(!state.Like(MiniInterpreterState.Of(newCommands.map(c=>parseCommand(c) as CmdCommand)))){
                console.error("Panic and catch fire!");
                debugger;
            }
            return commands;
        }
        return commands;
    }

    let parsedCommands = commands.map(parseCommand);

    // Simplest sweep, we're going to keep track of the current file and line, and when both are repeated, we'll remove the future copies.
    let currentFile: string | undefined;
    let currentLine: string | undefined;
    let newList = [];
    for(let command of parsedCommands) {
        if(command.shape === "FILE") {
            if(currentFile === command.arg) {
                continue;
            }
            currentFile = command.arg;
        } else if(command.shape === "LINE") {
            if(currentLine === command.arg) {
                continue;
            }
            currentLine = command.arg;
        }else if(command.shape === "CMD"){
            // If it's ADDA, ADDB, SUBA, SUBB and the argument is 0 or 1, we can replace with INC, DEC, or nothing.
            if(command.command === "adda" || command.command === "suba" || command.command === "addb" || command.command === "subb"){
                if(+(command.arg??"") === 0){
                    continue;
                }else if(+(command.arg??"") === 1){
                    switch (command.command) {
                        case "adda":
                            command.command = "inca";
                            break;
                        case "suba":
                            command.command = "deca";
                            break;
                        case "addb":
                            command.command = "incb";
                            break;
                        case "subb":
                            command.command = "decb";
                            break;
                    }
                    command.arg = undefined;
                }
            }
        }
        newList.push(command);
    }
    parsedCommands = newList;

    // Group all commands, splitting before any command with a label, and after any jump command
    let curGroup: Command[] = [];
    let groups: Command[][] = [];
    for(let command of parsedCommands){
        if("label" in command && command.label) {
            if(curGroup.length > 0) {
                groups.push(curGroup);
                curGroup = [];
            }
            groups.push([command])
            continue;
        }
        if(command.shape === "DB"){
            // DBs are VERY breaking, so we'll split before and after them
            if(curGroup.length > 0) {
                groups.push(curGroup);
                curGroup = [];
            }
            groups.push([command]);
            continue;
        }
        if(command.shape == "LINE" || command.shape =="FILE" || command.shape == "REM"){
            // All of these can exist in their own micro-groups. as a treat.
            groups.push([command]);
            continue;
        }
        if(command.shape !== "CMD") continue; // ???
        if(!NPSimpleStatments.has(command.command!)){
            if(curGroup.length > 0) {
                groups.push(curGroup);
                curGroup = [];
            }
            groups.push([command]);
            continue;
        }
        curGroup.push(command);
    }
    if(curGroup.length > 0) {
        groups.push(curGroup);
    }

    // Iterate through each group and clean up redundancies within them.
    groups = groups.map(SimplifyCommands);
    let preTotal = parsedCommands.length;
    parsedCommands = groups.flat();
    let recompiled = parsedCommands.map(rebuildCommand);
    console.log(`Commands Optimized: ${recompiled.length}/${preTotal} ${Math.floor((1-recompiled.length/preTotal)*100)}% (best possible: ${groups.length}/${preTotal} ${Math.floor((1-groups.length/preTotal)*100)}%)`)
    recompiled = Scope.ObliterateRedundancies(recompiled);
    console.log(`Bonus Optimization: ${recompiled.length}/${preTotal} ${Math.floor((1-recompiled.length/preTotal)*100)}% (best possible: ${groups.length}/${preTotal} ${Math.floor((1-groups.length/preTotal)*100)}%)`)
    
    return recompiled;
}