// Shared draw/recovery rules. Server measures preparation time; no client charge multiplier.
export const RANGED={bow:{draw:1,min:.16,speed:46,g:9,stamina:5},pilum:{draw:.65,min:.2,speed:28,g:12,stamina:10}};
export function rangedProfile(kind,held,{speed=0,running=false,mounted=false,stamina=1}={}){
 const d=RANGED[kind],power=Math.max(.15,Math.min(1,held/d.draw)),fatigue=Math.max(0,held-d.draw-2);
 const spread=(.004+(1-power)*.065+Math.min(14,speed)*.0025+(running?.03:0)+(mounted?.015:0)+fatigue*.005+(1-stamina)*.025);
 return {power,speed:d.speed*(.45+.55*power),spread,damage:.4+.6*power};
}
