// Local deck coordinates; the rocking deck carries both crates and their shadows.
export function crateDeckSlot(type,index,deckY=.8){
  if(type==='scapha')return{x:0,y:deckY+.05,z:index===0?-.6:.65,scale:.65};
  if(type==='barca')return{x:index%2? .65:-.65,y:deckY+.05,z:-.9,scale:1};
  if(type==='corbita')return{x:index%2? .9:-.9,y:deckY+.05,z:-2.2+Math.floor(index/2)*1.05,scale:1};
  return{x:index%2?.65:-.65,y:deckY+.05,z:2.5+Math.floor(index/2)*.9,scale:1};
}
