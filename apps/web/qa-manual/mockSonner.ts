type Toast={kind:"error"|"success";message:string};
declare global{interface Window{__qaToasts:Toast[]}}
window.__qaToasts=[];
export const toast={
  error:(message:string)=>{window.__qaToasts.push({kind:"error",message});},
  success:(message:string)=>{window.__qaToasts.push({kind:"success",message});},
};
