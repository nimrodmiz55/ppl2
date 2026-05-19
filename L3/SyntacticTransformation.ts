import { ClassExp, ProcExp, Exp, Program, CExp, Binding,
         isClassExp, isProcExp, isAppExp, isIfExp, isLetExp, isDefineExp, isProgram,
         makeProgram, makeDefineExp, makeProcExp, makeAppExp, makeIfExp, makeLetExp, makeBinding,
         makeVarDecl, makeVarRef, makePrimOp, makeLitExp } from "./L3-ast";
import { makeSymbolSExp } from "./L3-value";
import { Result, makeOk, makeFailure, mapv, bind, mapResult } from "../shared/result";

/*
Purpose: Transform ClassExp to ProcExp
Signature: class2proc(classExp)
Type: ClassExp => ProcExp
*/
export const class2proc = (exp: ClassExp): ProcExp => {
    const errorLit: CExp = makeLitExp(makeSymbolSExp("error"));
    // Build nested if chain from last method to first
    const ifChain: CExp = exp.methods.reduceRight(
        (acc: CExp, b: Binding): CExp =>
            makeIfExp(
                makeAppExp(makePrimOp("eq?"), [makeVarRef("msg"), makeLitExp(makeSymbolSExp(b.var.var))]),
                isProcExp(b.val) ? b.val.body[0] : b.val,
                acc
            ),
        errorLit
    );
    return makeProcExp(exp.fields, [makeProcExp([makeVarDecl("msg")], [ifChain])]);
};

// Recursively transform all CExp nodes
const transformCExp = (exp: CExp): Result<CExp> =>
    isClassExp(exp) ? transformCExp(class2proc(exp)) :
    isProcExp(exp) ? mapv(mapResult(transformCExp, exp.body),
                         (body: CExp[]) => makeProcExp(exp.args, body)) :
    isAppExp(exp) ? bind(transformCExp(exp.rator), (rator: CExp) =>
                        mapv(mapResult(transformCExp, exp.rands),
                             (rands: CExp[]) => makeAppExp(rator, rands))) :
    isIfExp(exp) ? bind(transformCExp(exp.test), (test: CExp) =>
                       bind(transformCExp(exp.then), (then: CExp) =>
                           mapv(transformCExp(exp.alt),
                                (alt: CExp) => makeIfExp(test, then, alt)))) :
    isLetExp(exp) ? bind(
                        mapResult((b: Binding) =>
                            mapv(transformCExp(b.val), (val: CExp) => makeBinding(b.var.var, val)),
                            exp.bindings),
                        (bindings: Binding[]) =>
                            mapv(mapResult(transformCExp, exp.body),
                                 (body: CExp[]) => makeLetExp(bindings, body))) :
    makeOk(exp); // atomic: NumExp, BoolExp, StrExp, VarRef, PrimOp, LitExp

const transformExp = (exp: Exp): Result<Exp> =>
    isDefineExp(exp) ? mapv(transformCExp(exp.val), (val: CExp) => makeDefineExp(exp.var, val)) :
    transformCExp(exp as CExp);

/*
Purpose: Transform all class forms in the given AST to procs
Signature: transform(AST)
Type: [Exp | Program] => Result<Exp | Program>
*/
export const transform = (exp: Exp | Program): Result<Exp | Program> =>
    isProgram(exp) ? mapv(mapResult(transformExp, exp.exps), makeProgram) :
    transformExp(exp as Exp);
