import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getPesagemAtiva, type PesagemAtiva } from "@/lib/maisArrobasResume";

const DISMISS_KEY = "ma_pesagem_ativa_dispensada";

/** Pergunta se o usuário quer continuar uma pesagem aberta do Mais Arrobas. */
export default function PesagemEmAndamentoPrompt() {
  const location = useLocation();
  const navigate = useNavigate();
  const [ativa, setAtiva] = useState<PesagemAtiva | null>(null);

  useEffect(() => {
    const path = location.pathname;
    if (!path.startsWith("/pesador") && !path.startsWith("/pecuarista")) return setAtiva(null);
    const a = getPesagemAtiva();
    if (!a) return setAtiva(null);
    if (!path.startsWith(a.tipo === "pesador" ? "/pesador" : "/pecuarista")) return setAtiva(null);
    if (path.startsWith(a.path)) return setAtiva(null);
    if (sessionStorage.getItem(DISMISS_KEY) === a.pesagemId) return setAtiva(null);
    setAtiva(a);
  }, [location.pathname]);

  if (!ativa) return null;
  return (
    <AlertDialog open onOpenChange={(o) => !o && setAtiva(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pesagem em andamento</AlertDialogTitle>
          <AlertDialogDescription>
            Você tem uma pesagem em andamento com {ativa.label}. Continuar ou iniciar nova?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, ativa.pesagemId);
              setAtiva(null);
            }}
          >
            Iniciar nova
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setAtiva(null);
              navigate(ativa.path);
            }}
          >
            Continuar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
