// Token budget: preserve legitimate distance when up to two seconds of messages arrive together.
// There is no client-supplied time or speed multiplier. Long-run speed remains server limited.
export function movementAllowance(p,time,limit){
 const elapsed=Math.max(0,time-(p.moveBudgetAt??p.lastMv??time));p.moveBudgetAt=time;
 const capacity=limit*2+.75,initial=Math.min(capacity,limit*.25+.75);
 p.moveCredit=Math.min(capacity,(p.moveCredit??initial)+limit*elapsed);return p.moveCredit;
}
