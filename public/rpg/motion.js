// Render a short history of authoritative positions instead of repeatedly chasing the newest point.
export function pushMotion(history,sample){
 if(!Number.isFinite(sample.t))return;
 const last=history.at(-1);if(last&&sample.t<=last.t)return;
 if(last&&Math.hypot(sample.x-last.x,sample.z-last.z)>18)history.length=0;
 history.push(sample);while(history.length>16)history.shift();
}
const angle=(a,b,k)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*k;
export function sampleMotion(history,time,delay=.18,maxExtrapolation=.1){
 if(!history.length)return null;const t=time-delay;
 let a=history[0],b=a;
 for(let i=1;i<history.length;i++){b=history[i];if(b.t>=t)break;a=b;}
 if(t<=history[0].t)return{...history[0],speed:0};
 if(a===b){const last=history.at(-1),prev=history.at(-2);if(!prev)return{...last,speed:0};a=prev;b=last;}
 const span=b.t-a.t;if(span<=0||span>1)return{...b,speed:0};
 const moving=b.moving!==false,extra=moving?maxExtrapolation:0;
 const k=Math.max(0,Math.min(1+extra/span,(t-a.t)/span)),speed=Math.hypot(b.x-a.x,b.z-a.z)/span;
 return{x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k,ry:angle(a.ry,b.ry,Math.min(1,k)),speed:t>b.t+extra||!moving?0:speed};
}
