// Punto de entrada de la app: carga datos → store → pantalla.
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useStore } from 'zustand';
import { planesIniciales, claveDePlan } from '../data/repositorio.ts';
import { storeApp } from '../state/store.ts';
import { FormularioCarrera } from '../components/FormularioCarrera.tsx';
import { PensumCiclos } from '../components/PensumCiclos.tsx';
import { CumPanel } from '../components/CumPanel.tsx';
import type { Plan } from '../domain/tipos.ts';
import './estilos.css';

const planes = planesIniciales();

/** Referencia estable para "sin registros" (evita nuevos objetos por render). */
const VACIO: Record<string, number> = Object.freeze({});

// Gancho de verificación T8: /?rf3=1 monta el formulario con tipo+sede sin carreras
// (ingeniería en Antiguo Cuscatlán no existe en el fixture) para ver el estado RF-3.
const params = new URLSearchParams(window.location.search);
const estadoInicial = params.has('rf3')
  ? { tipo: 'ingenieria' as const, sede: 'antiguo-cuscatlan' as const }
  : undefined;

function App() {
  // Selectores planos (v5): devolver objetos nuevos en el selector causa re-render infinito
  // o "getSnapshot should be cached". Se suscribe a `registros` (referencia estable) y se deriva.
  const claveActiva = useStore(storeApp!, (s) => s.claveActiva);
  const todosRegistros = useStore(storeApp!, (s) => s.registros);
  // Suscripción reactiva a los registros de la carrera activa (RF-9: repintado al cambiar notas).
  const registrosMap = claveActiva ? (todosRegistros[claveActiva] ?? VACIO) : VACIO;

  // RF-13: avisar antes de cerrar/recargar si hay registros (aunque estén persistidos).
  const hayRegistros = Object.keys(todosRegistros).some(
    (clave) => Object.keys(todosRegistros[clave] ?? {}).length > 0,
  );
  useEffect(() => {
    if (!hayRegistros) return;
    const alSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [hayRegistros]);

  const planActivo: Plan | undefined = claveActiva
    ? planes.find((p) => claveDePlan(p) === claveActiva)
    : undefined;

  const registrosLista = Object.entries(registrosMap).map(([asignaturaId, nota]) => ({
    asignaturaId,
    nota,
  }));

  // RF-12: confirmar el cambio de carrera si la visible tiene datos sin "confirmar" cambios.
  const seleccionar = (plan: Plan) => {
    const nuevaClave = claveDePlan(plan);
    if (claveActiva && claveActiva !== nuevaClave) {
      const visibles = Object.keys(todosRegistros[claveActiva] ?? {}).length;
      if (visibles > 0 && !window.confirm('Tienes notas en la carrera actual. ¿Cambiar de carrera?')) {
        return;
      }
    }
    storeApp!.getState().seleccionarCarrera(nuevaClave);
  };

  return (
    <main className="contenedor">
      <h1>CalCUM UDB</h1>
      <p className="bajada">
        Calcula tu Coeficiente de Unidades de Mérito de la Universidad Don Bosco.
      </p>

      <FormularioCarrera
        planes={planes}
        estadoInicial={estadoInicial}
        onSeleccionar={seleccionar}
      />

      {planActivo && claveActiva && (
        <>
          <CumPanel plan={planActivo} registros={registrosLista} />
          <PensumCiclos
            plan={planActivo}
            registros={registrosLista}
            onGuardarNota={(id, nota) => storeApp!.getState().setearNota(claveActiva, id, nota)}
            onEliminarNota={(id) => storeApp!.getState().eliminarNota(claveActiva, id)}
          />
        </>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// RF-15: service worker solo en build de producción; en dev (Vite HMR) interfiere.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      // Fallo ruidoso pero no fatal: la app sigue funcionando online.
      console.error('No se pudo registrar el service worker', error);
    });
  });
}
