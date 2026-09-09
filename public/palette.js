import * as THREE from './vendor/three.module.js';

const response=await fetch(new URL('./theme.json',import.meta.url));
if(!response.ok)throw new Error('Unable to load shrine palette');
const {brand}=await response.json();
const base=new THREE.Color(brand);
const white=new THREE.Color(0xffffff);
// Work in linear light so the same hue is used by materials and custom shaders.
export const tone=(strength=1,tint=0)=>base.clone().lerp(white,tint).multiplyScalar(strength);
export const glslColor=(strength=1,tint=0)=>`vec3(${tone(strength,tint).toArray().map(v=>v.toFixed(6)).join(',')})`;
export const palette={
  background:tone(.003,.025),body:tone(.006,.025),edge:tone(1),
  metal:tone(.1,.035),accent:tone(.42),inner:tone(.07),
  detail:tone(.52,.05),outline:tone(.19),lamp:tone(1.3,.4),
  frame:tone(.055,.025),wood:tone(.027,.025)
};
document.documentElement.style.setProperty('--brand',brand);
export {brand};
