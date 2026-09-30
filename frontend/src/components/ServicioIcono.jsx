import {
  Bath,
  Droplets,
  Flame,
  Footprints,
  ParkingCircle,
  HelpCircle,
  Tent,
  Utensils,
  Waves,
  Zap,
} from 'lucide-react';

const ICONOS_SERVICIO = {
  agua: Droplets,
  baños: Bath,
  electricidad: Zap,
  fogata: Flame,
  senderos: Footprints,
  rio: Waves,
  carpa: Tent,
  cocina: Utensils,
  estacionamiento: ParkingCircle,
};

export default function ServicioIcono({ servicio, iconClassName = 'h-4 w-4' }) {
  const nombre = servicio?.toLocaleLowerCase('es') || '';
  const nombreCanonico = nombre === 'banos' ? 'baños' : nombre;
  const Icono = ICONOS_SERVICIO[nombreCanonico] || HelpCircle;
  const etiqueta = nombreCanonico === 'rio' ? 'río' : nombreCanonico;

  return (
    <span className="inline-flex items-center gap-1.5 capitalize">
      <Icono className={`${iconClassName} shrink-0`} aria-hidden="true" />
      {etiqueta}
    </span>
  );
}