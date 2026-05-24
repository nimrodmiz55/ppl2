import { Exp, Program, CExp, AppExp,
         isDefineExp, isProgram,
         isNumExp, isBoolExp, isStrExp, isVarRef, isPrimOp, isLitExp,
         isAppExp, isIfExp, isProcExp } from './L3/L3-ast';
import { Result, makeOk, makeFailure, mapv, bind, mapResult } from './shared/result';
import { map } from 'ramda';

// Translate L2 primitive op name to Python equivalent
const primOpPython = (op: string): string =>
    op === "=" ? "==" :
    op;

const cexpToPython = (exp: CExp): Result<string> =>
    isNumExp(exp) ? makeOk(`${exp.val}`) :
    isBoolExp(exp) ? makeOk(exp.val ? "True" : "False") :
    isStrExp(exp) ? makeOk(`"${exp.val}"`) :
    isVarRef(exp) ? makeOk(exp.var) :
    isPrimOp(exp) ? makeOk(exp.op) :
    isIfExp(exp) ?
        bind(cexpToPython(exp.test), (cond: string) =>
        bind(cexpToPython(exp.then), (then: string) =>
        mapv(cexpToPython(exp.alt),  (alt:  string) =>
            `(${then} if ${cond} else ${alt})`))) :
    isProcExp(exp) ?
        mapv(cexpToPython(exp.body[0]), (body: string) =>
            `(lambda ${map(v => v.var, exp.args).join(",")} : ${body})`) :
    isAppExp(exp) ? appToPython(exp) :
    makeFailure(`Unsupported CExp: ${JSON.stringify(exp)}`);

const appToPython = (exp: AppExp): Result<string> => {
    if (isPrimOp(exp.rator)) {
        const op = exp.rator.op;
        if (op === "not")
            return mapv(cexpToPython(exp.rands[0]),
                        (arg: string) => `(not ${arg})`);
        // infix binary/multi-arity op
        return mapv(mapResult(cexpToPython, exp.rands),
                    (args: string[]) => `(${args.join(` ${primOpPython(op)} `)})`);
    }
    // user-defined function or lambda call: f(a,b) or (lambda ...)(a,b)
    return bind(cexpToPython(exp.rator), (rator: string) =>
           mapv(mapResult(cexpToPython, exp.rands),
                (args: string[]) => `${rator}(${args.join(",")})`));
};

/*
Purpose: Transform L2 AST to Python program string
Signature: l2ToPython(l2AST)
Type: [Parsed | Error] => Result<string>
*/
export const l2ToPython = (exp: Exp | Program): Result<string> =>
    isProgram(exp) ?
        mapv(mapResult((e: Exp) => l2ToPython(e) as Result<string>, exp.exps),
             (lines: string[]) => lines.join("\n")) :
    isDefineExp(exp) ?
        mapv(cexpToPython(exp.val), (val: string) => `${exp.var.var} = ${val}`) :
    cexpToPython(exp as CExp);
