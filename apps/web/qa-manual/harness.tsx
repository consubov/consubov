import "../src/index.css";
import React from "react";
import {createRoot} from "react-dom/client";
import LancamentoManualModal from "../src/components/capataz/LancamentoManualModal";
const n=Number(new URLSearchParams(location.search).get("pastos")||"3");
const count=Number.isInteger(n)&&n>0&&n<=40?n:3;
const pastos=Array.from({length:count},(_,i)=>({
  id:"qa-"+(i+1),nome:"Pasto QA "+String(i+1).padStart(2,"0"),num_animais:20+i,
}));
function App(){
  const [open,setOpen]=React.useState(true);
  return <main className="p-3 min-h-screen">
    {!open&&<button onClick={()=>setOpen(true)}>Reabrir</button>}
    <LancamentoManualModal open={open} onOpenChange={setOpen} pastos={pastos} retiroId="qa-retiro" fazendaId="qa-fazenda"/>
  </main>;
}
createRoot(document.getElementById("root")!).render(<App/>);
